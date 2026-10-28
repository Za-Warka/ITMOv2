package github

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"repo-atlas/backend/internal/cache"
)

const (
	apiVersion = "2022-11-28"
	userAgent  = "Repo-Atlas"
)

var loginPattern = regexp.MustCompile(`^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$`)

type Error struct {
	Code       string
	Status     int
	RetryAfter string
	Message    string
}

func (e *Error) Error() string { return e.Message }

type User struct {
	ID          int64  `json:"id"`
	Login       string `json:"login"`
	Name        string `json:"name"`
	AvatarURL   string `json:"avatar_url"`
	ProfileURL  string `json:"html_url"`
	PublicRepos int    `json:"public_repos"`
	Followers   int    `json:"followers"`
	Following   int    `json:"following"`
}

type Repository struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	FullName      string `json:"full_name"`
	OwnerLogin    string `json:"owner_login"`
	Description   string `json:"description"`
	Private       bool   `json:"private"`
	Fork          bool   `json:"fork"`
	Archived      bool   `json:"archived"`
	DefaultBranch string `json:"default_branch"`
	UpdatedAt     string `json:"updated_at"`
	HTMLURL       string `json:"html_url"`
}

type Page struct {
	Items   []Repository
	HasNext bool
}

type Client struct {
	BaseURL    string
	HTTPClient *http.Client
	Token      string
	Cache      *cache.Cache
}

func NewClient(token string) *Client {
	return &Client{
		BaseURL:    "https://api.github.com",
		HTTPClient: &http.Client{Timeout: 12 * time.Second},
		Token:      token,
		Cache:      cache.New(50, 15*time.Minute),
	}
}

func NormalizeLogin(raw string) (string, error) {
	login := strings.TrimSpace(raw)
	if strings.HasPrefix(login, "@") {
		login = strings.TrimPrefix(login, "@")
		if strings.HasPrefix(login, "@") {
			return "", errors.New("тег должен содержать один ведущий @")
		}
	}
	if !loginPattern.MatchString(login) {
		return "", errors.New("укажите GitHub login в формате @username")
	}
	return strings.ToLower(login), nil
}

func (c *Client) GetAuthenticatedUser(ctx context.Context, token string) (User, error) {
	var user User
	if err := c.getJSON(ctx, "/user", token, &user); err != nil {
		return User{}, err
	}
	return user, nil
}

func (c *Client) GetUser(ctx context.Context, rawLogin string) (User, error) {
	login, err := NormalizeLogin(rawLogin)
	if err != nil {
		return User{}, &Error{Code: "invalid_input", Status: http.StatusBadRequest, Message: err.Error()}
	}
	if cached, ok := c.Cache.Get("user:" + login); ok {
		if user, ok := cached.(User); ok {
			return user, nil
		}
	}
	var user User
	if err := c.getJSON(ctx, "/users/"+url.PathEscape(login), "", &user); err != nil {
		return User{}, err
	}
	c.Cache.Set("user:"+login, user)
	return user, nil
}

func (c *Client) ListPublicRepositories(ctx context.Context, rawLogin string, page, perPage int) (Page, error) {
	login, err := NormalizeLogin(rawLogin)
	if err != nil {
		return Page{}, &Error{Code: "invalid_input", Status: http.StatusBadRequest, Message: err.Error()}
	}
	if page < 1 || perPage < 1 || perPage > 100 {
		return Page{}, &Error{Code: "invalid_input", Status: http.StatusBadRequest, Message: "Некорректные параметры пагинации."}
	}
	cacheKey := fmt.Sprintf("repos:%s:%d:%d", login, page, perPage)
	if cached, ok := c.Cache.Get(cacheKey); ok {
		if result, ok := cached.(Page); ok {
			return result, nil
		}
	}
	path := "/users/" + url.PathEscape(login) + "/repos?page=" + strconv.Itoa(page) + "&per_page=" + strconv.Itoa(perPage) + "&type=all&sort=updated"
	var raw []struct {
		ID            int64  `json:"id"`
		Name          string `json:"name"`
		FullName      string `json:"full_name"`
		Description   string `json:"description"`
		Private       bool   `json:"private"`
		Fork          bool   `json:"fork"`
		Archived      bool   `json:"archived"`
		DefaultBranch string `json:"default_branch"`
		UpdatedAt     string `json:"updated_at"`
		HTMLURL       string `json:"html_url"`
		Owner         struct {
			Login string `json:"login"`
		} `json:"owner"`
	}
	response, err := c.get(ctx, path, c.Token)
	if err != nil {
		return Page{}, err
	}
	if err := json.NewDecoder(response.Body).Decode(&raw); err != nil {
		response.Body.Close()
		return Page{}, c.decodeError(err)
	}
	response.Body.Close()
	items := make([]Repository, 0, len(raw))
	for _, item := range raw {
		if item.Private {
			continue
		}
		items = append(items, Repository{
			ID: item.ID, Name: item.Name, FullName: item.FullName, OwnerLogin: item.Owner.Login,
			Description: item.Description, Private: item.Private, Fork: item.Fork,
			Archived: item.Archived, DefaultBranch: item.DefaultBranch, UpdatedAt: item.UpdatedAt, HTMLURL: item.HTMLURL,
		})
	}
	result := Page{Items: items, HasNext: strings.Contains(response.Header.Get("Link"), `rel="next"`)}
	c.Cache.Set(cacheKey, result)
	return result, nil
}

func (c *Client) getJSON(ctx context.Context, path, token string, target any) error {
	response, err := c.get(ctx, path, token)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if err := json.NewDecoder(response.Body).Decode(target); err != nil {
		return c.decodeError(err)
	}
	return nil
}

func (c *Client) get(ctx context.Context, path, token string) (*http.Response, error) {
	base := strings.TrimRight(c.BaseURL, "/")
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, base+path, nil)
	if err != nil {
		return nil, &Error{Code: "github_unavailable", Status: http.StatusBadGateway, Message: "Не удалось подготовить запрос к GitHub."}
	}
	request.Header.Set("Accept", "application/vnd.github+json")
	request.Header.Set("X-GitHub-Api-Version", apiVersion)
	request.Header.Set("User-Agent", userAgent)
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	response, err := c.HTTPClient.Do(request)
	if err != nil {
		return nil, &Error{Code: "github_unavailable", Status: http.StatusBadGateway, Message: "GitHub временно недоступен."}
	}
	if response.StatusCode >= 200 && response.StatusCode < 300 {
		return response, nil
	}
	defer response.Body.Close()
	_, _ = io.Copy(io.Discard, response.Body)
	return nil, mapHTTPError(response)
}

func mapHTTPError(response *http.Response) *Error {
	result := &Error{Status: http.StatusBadGateway, Code: "github_unavailable", Message: "GitHub временно недоступен."}
	switch response.StatusCode {
	case http.StatusNotFound:
		result.Status, result.Code, result.Message = http.StatusNotFound, "user_not_found", "Пользователь GitHub не найден."
	case http.StatusUnauthorized:
		result.Status, result.Code, result.Message = http.StatusBadGateway, "github_unavailable", "GitHub не подтвердил доступ."
	case http.StatusForbidden, http.StatusTooManyRequests:
		result.Status, result.Code, result.Message = http.StatusTooManyRequests, "github_rate_limit", "GitHub временно ограничил запросы."
		result.RetryAfter = response.Header.Get("Retry-After")
	}
	return result
}

func (c *Client) decodeError(err error) *Error {
	return &Error{Code: "github_unavailable", Status: http.StatusBadGateway, Message: fmt.Sprintf("GitHub вернул некорректные данные: %v", err)}
}

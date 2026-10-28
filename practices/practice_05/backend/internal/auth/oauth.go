package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"repo-atlas/backend/internal/github"
	"repo-atlas/backend/internal/store"
)

var ErrOAuthState = errors.New("invalid or expired oauth state")

type OAuthService struct {
	Store             *store.Store
	Sessions          *SessionManager
	ClientID          string
	ClientSecret      string
	RedirectURL       string
	FrontendURL       string
	HTTPClient        *http.Client
	ExchangeToken     func(context.Context, string) (string, error)
	AuthenticatedUser func(context.Context, string) (github.User, error)
	Now               func() time.Time
}

func NewOAuthService(database *store.Store, sessions *SessionManager, clientID, clientSecret, redirectURL, frontendURL string) *OAuthService {
	service := &OAuthService{
		Store: database, Sessions: sessions, ClientID: clientID, ClientSecret: clientSecret,
		RedirectURL: redirectURL, FrontendURL: frontendURL, HTTPClient: &http.Client{Timeout: 12 * time.Second}, Now: time.Now,
	}
	service.ExchangeToken = service.exchangeToken
	service.AuthenticatedUser = func(ctx context.Context, token string) (github.User, error) {
		return github.NewClient("").GetAuthenticatedUser(ctx, token)
	}
	return service
}

func (s *OAuthService) AuthorizationURL(ctx context.Context) (string, error) {
	if s.ClientID == "" || s.RedirectURL == "" {
		return "", errors.New("GitHub OAuth is not configured")
	}
	state, err := randomState()
	if err != nil {
		return "", err
	}
	if err := s.Store.SaveOAuthState(ctx, state, s.Now().Add(10*time.Minute)); err != nil {
		return "", err
	}
	query := url.Values{
		"client_id":    {s.ClientID},
		"redirect_uri": {s.RedirectURL},
		"scope":        {"read:user"},
		"state":        {state},
	}
	return "https://github.com/login/oauth/authorize?" + query.Encode(), nil
}

func (s *OAuthService) Complete(ctx context.Context, code, state, oauthError string) (store.User, error) {
	if oauthError != "" {
		return store.User{}, fmt.Errorf("github authorization denied: %s", oauthError)
	}
	if strings.TrimSpace(code) == "" || strings.TrimSpace(state) == "" {
		return store.User{}, ErrOAuthState
	}
	valid, err := s.Store.ConsumeOAuthState(ctx, state, s.Now())
	if err != nil {
		return store.User{}, err
	}
	if !valid {
		return store.User{}, ErrOAuthState
	}
	token, err := s.ExchangeToken(ctx, code)
	if err != nil {
		return store.User{}, err
	}
	profile, err := s.AuthenticatedUser(ctx, token)
	if err != nil {
		return store.User{}, err
	}
	name := profile.Name
	if name == "" {
		name = profile.Login
	}
	user := store.User{
		ID: fmt.Sprintf("github-%d", profile.ID), GitHubID: profile.ID, Login: profile.Login,
		DisplayName: name, AvatarURL: profile.AvatarURL, ProfileURL: profile.ProfileURL,
	}
	if err := s.Store.UpsertUser(ctx, user); err != nil {
		return store.User{}, err
	}
	return user, nil
}

func (s *OAuthService) exchangeToken(ctx context.Context, code string) (string, error) {
	form := url.Values{"client_id": {s.ClientID}, "client_secret": {s.ClientSecret}, "code": {code}, "redirect_uri": {s.RedirectURL}}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://github.com/login/oauth/access_token", strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response, err := s.HTTPClient.Do(request)
	if err != nil {
		return "", errors.New("GitHub OAuth недоступен")
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return "", errors.New("GitHub не подтвердил OAuth-код")
	}
	var body struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
	}
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil || body.AccessToken == "" {
		return "", errors.New("GitHub вернул некорректный OAuth-ответ")
	}
	return body.AccessToken, nil
}

func randomState() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", errors.New("generate oauth state")
	}
	return hex.EncodeToString(bytes), nil
}

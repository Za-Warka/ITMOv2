package github

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripper func(*http.Request) (*http.Response, error)

func (f roundTripper) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func response(status int, body string, headers map[string]string) *http.Response {
	result := &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}
	for key, value := range headers {
		result.Header.Set(key, value)
	}
	return result
}

func TestClientSetsGitHubHeadersAndDecodesUser(t *testing.T) {
	client := NewClient("")
	client.BaseURL = "https://api.example.test"
	client.HTTPClient = &http.Client{Transport: roundTripper(func(req *http.Request) (*http.Response, error) {
		if req.URL.Path != "/users/octocat" || req.Header.Get("X-GitHub-Api-Version") != apiVersion || req.Header.Get("User-Agent") != userAgent {
			t.Fatalf("unexpected request: %s headers=%v", req.URL, req.Header)
		}
		return response(http.StatusOK, `{"id":1,"login":"octocat","name":"The Octocat","html_url":"https://github.com/octocat"}`, nil), nil
	})}
	user, err := client.GetUser(context.Background(), "@octocat")
	if err != nil || user.ID != 1 || user.Login != "octocat" {
		t.Fatalf("unexpected user: %+v, %v", user, err)
	}
}

func TestListRepositoriesFiltersPrivateAndReadsPagination(t *testing.T) {
	client := NewClient("server-token")
	client.BaseURL = "https://api.example.test"
	client.HTTPClient = &http.Client{Transport: roundTripper(func(req *http.Request) (*http.Response, error) {
		if req.Header.Get("Authorization") != "Bearer server-token" || !strings.Contains(req.URL.RawQuery, "per_page=30") {
			t.Fatalf("unexpected request: %s auth=%s", req.URL, req.Header.Get("Authorization"))
		}
		return response(http.StatusOK, `[
          {"id":1,"name":"public","full_name":"octocat/public","private":false,"owner":{"login":"octocat"}},
          {"id":2,"name":"secret","full_name":"octocat/secret","private":true,"owner":{"login":"octocat"}}
        ]`, map[string]string{"Link": `<https://api.example.test/next>; rel="next"`}), nil
	})}
	page, err := client.ListPublicRepositories(context.Background(), "octocat", 1, 30)
	if err != nil || len(page.Items) != 1 || page.Items[0].FullName != "octocat/public" || !page.HasNext {
		t.Fatalf("unexpected page: %+v, %v", page, err)
	}
}

func TestNormalizeLoginRejectsUnsafeInput(t *testing.T) {
	for _, input := range []string{"", "@@octocat", "octocat/name", "octocat?x=1", "-bad"} {
		if _, err := NormalizeLogin(input); err == nil {
			t.Fatalf("expected invalid login: %q", input)
		}
	}
	got, err := NormalizeLogin("@OctoCat")
	if err != nil || got != "octocat" {
		t.Fatalf("unexpected normalized login: %q, %v", got, err)
	}
}

func TestGitHubErrorsAreStable(t *testing.T) {
	client := NewClient("")
	client.BaseURL = "https://api.example.test"
	client.HTTPClient = &http.Client{Transport: roundTripper(func(*http.Request) (*http.Response, error) {
		return response(http.StatusTooManyRequests, `{}`, map[string]string{"Retry-After": "60"}), nil
	})}
	_, err := client.GetUser(context.Background(), "octocat")
	var githubErr *Error
	if !errors.As(err, &githubErr) || githubErr.Code != "github_rate_limit" || githubErr.RetryAfter != "60" {
		t.Fatalf("unexpected GitHub error: %v", err)
	}
}

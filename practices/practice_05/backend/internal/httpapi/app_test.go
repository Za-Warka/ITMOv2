package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"repo-atlas/backend/internal/auth"
	"repo-atlas/backend/internal/github"
	"repo-atlas/backend/internal/store"
)

func testApp(t *testing.T) (*App, *store.Store) {
	t.Helper()
	database, err := store.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	sessions := auth.NewSessionManager(database, true)
	oauth := auth.NewOAuthService(database, sessions, "client-id", "secret", "http://localhost:8080/auth/github/callback", "http://localhost:3000")
	oauth.Now = func() time.Time { return time.Unix(1_700_000_000, 0) }
	client := github.NewClient("")
	return &App{OAuth: oauth, Sessions: sessions, GitHub: client}, database
}

func TestBeginGitHubRedirectsAndSessionIsAnonymous(t *testing.T) {
	app, database := testApp(t)
	defer database.Close()
	handler := NewApp(app.OAuth, app.Sessions, app.GitHub)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/auth/github", nil))
	if response.Code != http.StatusFound {
		t.Fatalf("unexpected auth status: %d", response.Code)
	}
	location, err := url.Parse(response.Header().Get("Location"))
	if err != nil || location.Query().Get("state") == "" || location.Query().Get("scope") != "read:user" {
		t.Fatalf("unexpected auth redirect: %s", response.Header().Get("Location"))
	}
	status := httptest.NewRecorder()
	handler.ServeHTTP(status, httptest.NewRequest(http.MethodGet, "/api/session", nil))
	var body map[string]any
	if err := json.NewDecoder(status.Body).Decode(&body); err != nil || body["authenticated"] != false {
		t.Fatalf("unexpected anonymous session: %s", status.Body.String())
	}
}

func TestOAuthCallbackCreatesSessionAndLogoutClearsIt(t *testing.T) {
	app, database := testApp(t)
	defer database.Close()
	app.OAuth.ExchangeToken = func(context.Context, string) (string, error) { return "temporary", nil }
	app.OAuth.AuthenticatedUser = func(context.Context, string) (github.User, error) {
		return github.User{ID: 99, Login: "octocat", Name: "The Octocat", ProfileURL: "https://github.com/octocat"}, nil
	}
	handler := NewApp(app.OAuth, app.Sessions, app.GitHub)
	stateURL, err := app.OAuth.AuthorizationURL(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	state := mustQuery(t, stateURL, "state")
	callback := httptest.NewRecorder()
	handler.ServeHTTP(callback, httptest.NewRequest(http.MethodGet, "/auth/github/callback?code=code&state="+url.QueryEscape(state), nil))
	if callback.Code != http.StatusFound || len(callback.Result().Cookies()) != 1 {
		t.Fatalf("unexpected callback: %d cookies=%v", callback.Code, callback.Result().Cookies())
	}
	cookie := callback.Result().Cookies()[0]
	statusRequest := httptest.NewRequest(http.MethodGet, "/api/session", nil)
	statusRequest.AddCookie(cookie)
	status := httptest.NewRecorder()
	handler.ServeHTTP(status, statusRequest)
	if status.Code != http.StatusOK || !strings.Contains(status.Body.String(), `"authenticated":true`) {
		t.Fatalf("unexpected authenticated session: %s", status.Body.String())
	}
	logoutRequest := httptest.NewRequest(http.MethodPost, "/auth/logout", nil)
	logoutRequest.AddCookie(cookie)
	logout := httptest.NewRecorder()
	handler.ServeHTTP(logout, logoutRequest)
	if logout.Code != http.StatusOK {
		t.Fatalf("unexpected logout: %d %s", logout.Code, logout.Body.String())
	}
}

func TestProtectedRepositoriesRejectAnonymousRequest(t *testing.T) {
	app, database := testApp(t)
	defer database.Close()
	handler := NewApp(app.OAuth, app.Sessions, app.GitHub)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/me/repositories", nil))
	if response.Code != http.StatusUnauthorized || !strings.Contains(response.Body.String(), `"code":"unauthorized"`) {
		t.Fatalf("unexpected protected response: %d %s", response.Code, response.Body.String())
	}
}

func mustQuery(t *testing.T, raw, key string) string {
	t.Helper()
	parsed, err := url.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	return parsed.Query().Get(key)
}

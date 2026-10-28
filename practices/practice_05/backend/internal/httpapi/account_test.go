package httpapi

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"repo-atlas/backend/internal/store"
)

type accountRoundTripper func(*http.Request) (*http.Response, error)

func (f accountRoundTripper) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func accountResponse(status int, body string, headers map[string]string) *http.Response {
	response := &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}
	for key, value := range headers {
		response.Header.Set(key, value)
	}
	return response
}

func TestMyRepositoriesReturnsPaginatedPublicItems(t *testing.T) {
	app, database := testApp(t)
	defer database.Close()
	user := store.User{ID: "github-7", GitHubID: 7, Login: "octocat", DisplayName: "Octocat", ProfileURL: "https://github.com/octocat"}
	if err := database.UpsertUser(context.Background(), user); err != nil {
		t.Fatal(err)
	}
	if err := database.SaveSession(context.Background(), "session", user.ID, time.Now().Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	app.GitHub.HTTPClient = &http.Client{Transport: accountRoundTripper(func(req *http.Request) (*http.Response, error) {
		if req.URL.Path != "/users/octocat/repos" || req.URL.Query().Get("page") != "2" {
			t.Fatalf("unexpected repository request: %s", req.URL)
		}
		return accountResponse(http.StatusOK, `[{"id":1,"name":"atlas","full_name":"octocat/atlas","private":false,"owner":{"login":"octocat"}}]`, map[string]string{"Link": `<next>; rel="next"`}), nil
	})}
	request := httptest.NewRequest(http.MethodGet, "/api/me/repositories?page=2&perPage=10", nil)
	request.AddCookie(&http.Cookie{Name: "repo_atlas_session", Value: "session"})
	response := httptest.NewRecorder()
	NewApp(app.OAuth, app.Sessions, app.GitHub).ServeHTTP(response, request)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"hasNext":true`) || !strings.Contains(response.Body.String(), `"fullName":"octocat/atlas"`) {
		t.Fatalf("unexpected repositories response: %d %s", response.Code, response.Body.String())
	}
}

func TestUserSearchReturnsProfileAndFiltersPrivateRepositories(t *testing.T) {
	app, database := testApp(t)
	defer database.Close()
	app.GitHub.HTTPClient = &http.Client{Transport: accountRoundTripper(func(req *http.Request) (*http.Response, error) {
		switch req.URL.Path {
		case "/users/octocat":
			return accountResponse(http.StatusOK, `{"id":1,"login":"octocat","name":"The Octocat","html_url":"https://github.com/octocat","public_repos":1}`, nil), nil
		case "/users/octocat/repos":
			return accountResponse(http.StatusOK, `[{"id":1,"name":"public","full_name":"octocat/public","private":false,"owner":{"login":"octocat"}},{"id":2,"name":"secret","full_name":"octocat/secret","private":true,"owner":{"login":"octocat"}}]`, nil), nil
		default:
			t.Fatalf("unexpected search request: %s", req.URL)
			return nil, nil
		}
	})}
	response := httptest.NewRecorder()
	NewApp(app.OAuth, app.Sessions, app.GitHub).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/users/@octocat", nil))
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"githubLogin":"octocat"`) || strings.Contains(response.Body.String(), "secret") {
		t.Fatalf("unexpected search response: %d %s", response.Code, response.Body.String())
	}
}

func TestUserSearchRejectsUnsafePath(t *testing.T) {
	app, database := testApp(t)
	defer database.Close()
	response := httptest.NewRecorder()
	NewApp(app.OAuth, app.Sessions, app.GitHub).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/users/@@octocat", nil))
	if response.Code != http.StatusBadRequest || !strings.Contains(response.Body.String(), `"code":"invalid_input"`) {
		t.Fatalf("unexpected unsafe path response: %d %s", response.Code, response.Body.String())
	}
}

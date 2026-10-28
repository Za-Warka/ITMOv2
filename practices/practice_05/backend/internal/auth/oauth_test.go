package auth

import (
	"context"
	"net/url"
	"strings"
	"testing"
	"time"

	"repo-atlas/backend/internal/github"
	"repo-atlas/backend/internal/store"
)

func TestAuthorizationURLPersistsStateAndMinimalScope(t *testing.T) {
	database, err := store.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	service := NewOAuthService(database, nil, "client-id", "secret", "http://localhost/callback", "http://localhost:3000")
	service.Now = func() time.Time { return time.Unix(1_700_000_000, 0) }
	value, err := service.AuthorizationURL(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.Host != "github.com" || parsed.Path != "/login/oauth/authorize" {
		t.Fatalf("unexpected authorization URL: %s", value)
	}
	if parsed.Query().Get("scope") != "read:user" || parsed.Query().Get("state") == "" {
		t.Fatalf("unexpected OAuth query: %s", parsed.RawQuery)
	}
	valid, err := database.ConsumeOAuthState(context.Background(), parsed.Query().Get("state"), service.Now())
	if err != nil || !valid {
		t.Fatalf("state was not persisted: %v %v", valid, err)
	}
}

func TestCompleteRejectsReusedStateAndStoresProfile(t *testing.T) {
	database, err := store.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	service := NewOAuthService(database, nil, "client-id", "secret", "http://localhost/callback", "http://localhost:3000")
	service.Now = func() time.Time { return time.Unix(1_700_000_000, 0) }
	service.ExchangeToken = func(context.Context, string) (string, error) { return "temporary-token", nil }
	service.AuthenticatedUser = func(context.Context, string) (github.User, error) {
		return github.User{ID: 42, Login: "octocat", ProfileURL: "https://github.com/octocat"}, nil
	}
	state, err := randomState()
	if err != nil {
		t.Fatal(err)
	}
	if err := database.SaveOAuthState(context.Background(), state, service.Now().Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	user, err := service.Complete(context.Background(), "code", state, "")
	if err != nil || user.ID != "github-42" || user.DisplayName != "octocat" {
		t.Fatalf("unexpected completed user: %+v, %v", user, err)
	}
	if _, err := service.Complete(context.Background(), "code", state, ""); err == nil || !strings.Contains(err.Error(), "state") {
		t.Fatalf("expected reused state error, got %v", err)
	}
}

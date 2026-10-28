package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"repo-atlas/backend/internal/store"
)

func TestSessionCookieIsOpaqueAndSecure(t *testing.T) {
	database, err := store.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	user := store.User{ID: "usr_cookie", GitHubID: 12, Login: "cookie", DisplayName: "Cookie", ProfileURL: "https://github.com/cookie"}
	if err := database.UpsertUser(context.Background(), user); err != nil {
		t.Fatal(err)
	}
	manager := NewSessionManager(database, true)
	manager.Now = func() time.Time { return time.Unix(1_700_000_000, 0) }
	response := httptest.NewRecorder()
	if err := manager.Create(response, user.ID); err != nil {
		t.Fatal(err)
	}
	cookie := response.Result().Cookies()[0]
	if cookie.Name != SessionCookieName || cookie.Value == "" || !cookie.HttpOnly || !cookie.Secure || cookie.SameSite != http.SameSiteLaxMode {
		t.Fatalf("unexpected cookie: %+v", cookie)
	}
	if cookie.Value == "github-token" {
		t.Fatal("cookie must not contain a GitHub token")
	}
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(cookie)
	got, err := manager.User(req)
	if err != nil || got.ID != user.ID {
		t.Fatalf("unexpected session user: %+v, %v", got, err)
	}
}

func TestClearSessionExpiresCookie(t *testing.T) {
	database, err := store.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	manager := NewSessionManager(database, false)
	request := httptest.NewRequest(http.MethodPost, "/auth/logout", nil)
	response := httptest.NewRecorder()
	if err := manager.Clear(response, request); err != nil {
		t.Fatal(err)
	}
	cookie := response.Result().Cookies()[0]
	if cookie.MaxAge >= 0 || cookie.Value != "" {
		t.Fatalf("expected expired cookie: %+v", cookie)
	}
}

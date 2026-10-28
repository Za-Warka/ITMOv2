package store

import (
	"context"
	"database/sql"
	"testing"
	"time"
)

func TestMigrateAndUserSessionLifecycle(t *testing.T) {
	store, err := Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	ctx := context.Background()
	user := User{ID: "usr_1", GitHubID: 42, Login: "octocat", DisplayName: "The Octocat", ProfileURL: "https://github.com/octocat"}
	if err := store.UpsertUser(ctx, user); err != nil {
		t.Fatal(err)
	}
	if err := store.UpsertUser(ctx, User{ID: "ignored", GitHubID: 42, Login: "updated", DisplayName: "Updated", ProfileURL: "https://github.com/updated"}); err != nil {
		t.Fatal(err)
	}
	got, err := store.UserByID(ctx, user.ID)
	if err != nil || got.Login != "updated" {
		t.Fatalf("unexpected user: %+v, %v", got, err)
	}

	if err := store.SaveSession(ctx, "raw-session", user.ID, time.Now().Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if _, err := store.UserBySession(ctx, "raw-session", time.Now()); err != nil {
		t.Fatal(err)
	}
	if _, err := store.UserBySession(ctx, "wrong-session", time.Now()); err != sql.ErrNoRows {
		t.Fatalf("expected unknown session, got %v", err)
	}
	if err := store.DeleteSession(ctx, "raw-session"); err != nil {
		t.Fatal(err)
	}
}

func TestOAuthStateIsSingleUseAndExpires(t *testing.T) {
	store, err := Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	now := time.Unix(1_700_000_000, 0)
	if err := store.SaveOAuthState(context.Background(), "state", now.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	valid, err := store.ConsumeOAuthState(context.Background(), "state", now)
	if err != nil || !valid {
		t.Fatalf("expected valid state: %v %v", valid, err)
	}
	valid, err = store.ConsumeOAuthState(context.Background(), "state", now)
	if err != nil || valid {
		t.Fatalf("expected state to be single-use: %v %v", valid, err)
	}
	if err := store.SaveOAuthState(context.Background(), "expired", now.Add(-time.Minute)); err != nil {
		t.Fatal(err)
	}
	valid, err = store.ConsumeOAuthState(context.Background(), "expired", now)
	if err != nil || valid {
		t.Fatalf("expected expired state: %v %v", valid, err)
	}
}

func TestCleanupExpiredRemovesExpiredStateAndSessions(t *testing.T) {
	store, err := Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	ctx := context.Background()
	user := User{ID: "usr_cleanup", GitHubID: 7, Login: "cleanup", DisplayName: "Cleanup", ProfileURL: "https://github.com/cleanup"}
	if err := store.UpsertUser(ctx, user); err != nil {
		t.Fatal(err)
	}
	now := time.Unix(1_700_000_000, 0)
	if err := store.SaveOAuthState(ctx, "expired-state", now.Add(-time.Minute)); err != nil {
		t.Fatal(err)
	}
	if err := store.SaveSession(ctx, "expired-session", user.ID, now.Add(-time.Minute)); err != nil {
		t.Fatal(err)
	}
	if err := store.CleanupExpired(ctx, now); err != nil {
		t.Fatal(err)
	}
	if valid, err := store.ConsumeOAuthState(ctx, "expired-state", now); err != nil || valid {
		t.Fatalf("expired state was not cleaned: %v %v", valid, err)
	}
	if _, err := store.UserBySession(ctx, "expired-session", now); err != sql.ErrNoRows {
		t.Fatalf("expired session was not cleaned: %v", err)
	}
}

package store

import (
	"context"
	"crypto/sha256"
	"database/sql"
	_ "embed"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

//go:embed schema.sql
var schema string

type User struct {
	ID          string
	GitHubID    int64
	Login       string
	DisplayName string
	AvatarURL   string
	ProfileURL  string
}

type Store struct {
	db *sql.DB
}

func Open(path string) (*Store, error) {
	if path != ":memory:" {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return nil, fmt.Errorf("create database directory: %w", err)
		}
	}
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	if path == ":memory:" {
		db.SetMaxOpenConns(1)
	}
	store := &Store{db: db}
	if err := store.Migrate(context.Background()); err != nil {
		db.Close()
		return nil, err
	}
	return store, nil
}

func (s *Store) Migrate(ctx context.Context) error {
	if _, err := s.db.ExecContext(ctx, "PRAGMA foreign_keys = ON"); err != nil {
		return fmt.Errorf("enable sqlite foreign keys: %w", err)
	}
	if _, err := s.db.ExecContext(ctx, schema); err != nil {
		return fmt.Errorf("apply sqlite migrations: %w", err)
	}
	return nil
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) UpsertUser(ctx context.Context, user User) error {
	now := time.Now().Unix()
	_, err := s.db.ExecContext(ctx, `
        INSERT INTO users (id, github_id, login, display_name, avatar_url, profile_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(github_id) DO UPDATE SET
          login=excluded.login,
          display_name=excluded.display_name,
          avatar_url=excluded.avatar_url,
          profile_url=excluded.profile_url,
          updated_at=excluded.updated_at`,
		user.ID, user.GitHubID, user.Login, user.DisplayName, user.AvatarURL, user.ProfileURL, now, now)
	return err
}

func (s *Store) UserByID(ctx context.Context, id string) (User, error) {
	var user User
	err := s.db.QueryRowContext(ctx, `SELECT id, github_id, login, display_name, avatar_url, profile_url FROM users WHERE id = ?`, id).
		Scan(&user.ID, &user.GitHubID, &user.Login, &user.DisplayName, &user.AvatarURL, &user.ProfileURL)
	return user, err
}

func hashSecret(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func (s *Store) SaveOAuthState(ctx context.Context, state string, expiresAt time.Time) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO oauth_states (state_hash, expires_at) VALUES (?, ?)`, hashSecret(state), expiresAt.Unix())
	return err
}

func (s *Store) ConsumeOAuthState(ctx context.Context, state string, now time.Time) (bool, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return false, err
	}
	defer tx.Rollback()
	var expiresAt int64
	err = tx.QueryRowContext(ctx, `SELECT expires_at FROM oauth_states WHERE state_hash = ?`, hashSecret(state)).Scan(&expiresAt)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM oauth_states WHERE state_hash = ?`, hashSecret(state)); err != nil {
		return false, err
	}
	if err := tx.Commit(); err != nil {
		return false, err
	}
	return expiresAt >= now.Unix(), nil
}

func (s *Store) SaveSession(ctx context.Context, rawID, userID string, expiresAt time.Time) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO sessions (id_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`, hashSecret(rawID), userID, expiresAt.Unix(), time.Now().Unix())
	return err
}

func (s *Store) UserBySession(ctx context.Context, rawID string, now time.Time) (User, error) {
	var user User
	err := s.db.QueryRowContext(ctx, `
        SELECT u.id, u.github_id, u.login, u.display_name, u.avatar_url, u.profile_url
        FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.id_hash = ? AND s.expires_at >= ?`, hashSecret(rawID), now.Unix()).
		Scan(&user.ID, &user.GitHubID, &user.Login, &user.DisplayName, &user.AvatarURL, &user.ProfileURL)
	return user, err
}

func (s *Store) DeleteSession(ctx context.Context, rawID string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM sessions WHERE id_hash = ?`, hashSecret(rawID))
	return err
}

func (s *Store) CleanupExpired(ctx context.Context, now time.Time) error {
	for _, table := range []string{"sessions", "oauth_states", "repository_cache"} {
		if _, err := s.db.ExecContext(ctx, "DELETE FROM "+table+" WHERE expires_at < ?", now.Unix()); err != nil {
			return err
		}
	}
	return nil
}

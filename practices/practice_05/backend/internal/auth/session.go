package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
	"time"

	"repo-atlas/backend/internal/store"
)

const SessionCookieName = "repo_atlas_session"

type SessionManager struct {
	Store        *store.Store
	CookieSecure bool
	SessionTTL   time.Duration
	Now          func() time.Time
}

func NewSessionManager(database *store.Store, secure bool) *SessionManager {
	return &SessionManager{Store: database, CookieSecure: secure, SessionTTL: 24 * time.Hour, Now: time.Now}
}

func (m *SessionManager) Create(w http.ResponseWriter, userID string) error {
	raw, err := randomID()
	if err != nil {
		return err
	}
	expiresAt := m.Now().Add(m.SessionTTL)
	if err := m.Store.SaveSession(context.Background(), raw, userID, expiresAt); err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    raw,
		Path:     "/",
		Expires:  expiresAt,
		MaxAge:   int(m.SessionTTL.Seconds()),
		HttpOnly: true,
		Secure:   m.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
	return nil
}

func (m *SessionManager) User(r *http.Request) (store.User, error) {
	cookie, err := r.Cookie(SessionCookieName)
	if err != nil {
		return store.User{}, err
	}
	return m.Store.UserBySession(r.Context(), cookie.Value, m.Now())
}

func (m *SessionManager) Clear(w http.ResponseWriter, r *http.Request) error {
	if cookie, err := r.Cookie(SessionCookieName); err == nil {
		if err := m.Store.DeleteSession(r.Context(), cookie.Value); err != nil {
			return err
		}
	}
	http.SetCookie(w, &http.Cookie{Name: SessionCookieName, Value: "", Path: "/", MaxAge: -1, HttpOnly: true, Secure: m.CookieSecure, SameSite: http.SameSiteLaxMode})
	return nil
}

func randomID() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", errors.New("generate session id")
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

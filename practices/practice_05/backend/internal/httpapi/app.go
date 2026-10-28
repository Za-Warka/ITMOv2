package httpapi

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"repo-atlas/backend/internal/auth"
	"repo-atlas/backend/internal/github"
	"repo-atlas/backend/internal/store"
)

type App struct {
	OAuth    *auth.OAuthService
	Sessions *auth.SessionManager
	GitHub   *github.Client
}

func NewApp(oauth *auth.OAuthService, sessions *auth.SessionManager, client *github.Client) http.Handler {
	app := &App{OAuth: oauth, Sessions: sessions, GitHub: client}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", app.health)
	mux.HandleFunc("GET /auth/github", app.beginGitHub)
	mux.HandleFunc("GET /auth/github/callback", app.completeGitHub)
	mux.HandleFunc("POST /auth/logout", app.logout)
	mux.HandleFunc("GET /api/session", app.sessionStatus)
	mux.Handle("GET /api/me/repositories", app.requireAuth(http.HandlerFunc(app.myRepositories)))
	mux.HandleFunc("GET /api/users/{login}", app.userSearch)
	mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
		WriteError(w, http.StatusNotFound, "not_found", "Маршрут не найден.")
	})
	return mux
}

func NewServer() http.Handler {
	return NewApp(nil, nil, nil)
}

func (a *App) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (a *App) beginGitHub(w http.ResponseWriter, r *http.Request) {
	if a.OAuth == nil {
		WriteError(w, http.StatusServiceUnavailable, "oauth_unavailable", "Вход через GitHub пока не настроен.")
		return
	}
	target, err := a.OAuth.AuthorizationURL(r.Context())
	if err != nil {
		WriteError(w, http.StatusServiceUnavailable, "oauth_unavailable", "Вход через GitHub пока не настроен.")
		return
	}
	http.Redirect(w, r, target, http.StatusFound)
}

func (a *App) completeGitHub(w http.ResponseWriter, r *http.Request) {
	if a.OAuth == nil || a.Sessions == nil {
		WriteError(w, http.StatusServiceUnavailable, "oauth_unavailable", "Вход через GitHub пока не настроен.")
		return
	}
	query := r.URL.Query()
	user, err := a.OAuth.Complete(r.Context(), query.Get("code"), query.Get("state"), query.Get("error"))
	if err != nil {
		if errors.Is(err, auth.ErrOAuthState) {
			WriteError(w, http.StatusBadRequest, "oauth_failed", "Сессия входа истекла. Начните вход заново.")
			return
		}
		WriteError(w, http.StatusBadGateway, "oauth_failed", "Не удалось завершить вход через GitHub.")
		return
	}
	if err := a.Sessions.Create(w, user.ID); err != nil {
		WriteError(w, http.StatusInternalServerError, "session_failed", "Не удалось создать сессию.")
		return
	}
	redirect := strings.TrimRight(a.OAuth.FrontendURL, "/") + "/account"
	http.Redirect(w, r, redirect, http.StatusFound)
}

func (a *App) logout(w http.ResponseWriter, r *http.Request) {
	if a.Sessions == nil {
		WriteError(w, http.StatusServiceUnavailable, "auth_unavailable", "Авторизация пока не настроена.")
		return
	}
	if err := a.Sessions.Clear(w, r); err != nil {
		WriteError(w, http.StatusInternalServerError, "session_failed", "Не удалось завершить сессию.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *App) sessionStatus(w http.ResponseWriter, r *http.Request) {
	if a.Sessions == nil {
		writeJSON(w, http.StatusOK, map[string]any{"authenticated": false, "user": nil})
		return
	}
	user, err := a.Sessions.User(r)
	if err != nil {
		if errors.Is(err, http.ErrNoCookie) || errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusOK, map[string]any{"authenticated": false, "user": nil})
			return
		}
		WriteError(w, http.StatusInternalServerError, "session_failed", "Не удалось проверить сессию.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"authenticated": true, "user": publicUserFromStore(user)})
}

func (a *App) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if a.Sessions == nil {
			WriteError(w, http.StatusUnauthorized, "unauthorized", "Войдите через GitHub.")
			return
		}
		user, err := a.Sessions.User(r)
		if err != nil {
			WriteError(w, http.StatusUnauthorized, "unauthorized", "Войдите через GitHub.")
			return
		}
		next.ServeHTTP(w, r.WithContext(withUser(r.Context(), user)))
	})
}

type userContextKey struct{}

func withUser(ctx context.Context, user store.User) context.Context {
	return context.WithValue(ctx, userContextKey{}, user)
}

func userFromContext(ctx context.Context) store.User {
	user, _ := ctx.Value(userContextKey{}).(store.User)
	return user
}

func (a *App) myRepositories(w http.ResponseWriter, r *http.Request) {
	if a.GitHub == nil {
		WriteError(w, http.StatusServiceUnavailable, "github_unavailable", "GitHub API пока не настроен.")
		return
	}
	page, perPage, ok := pagination(r)
	if !ok {
		WriteError(w, http.StatusBadRequest, "invalid_input", "Некорректные параметры пагинации.")
		return
	}
	user := userFromContext(r.Context())
	result, err := a.GitHub.ListPublicRepositories(r.Context(), user.Login, page, perPage)
	if err != nil {
		writeGitHubError(w, err)
		return
	}
	items := make([]publicRepository, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, publicRepositoryFromGitHub(item))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "page": page, "perPage": perPage, "hasNext": result.HasNext})
}

func (a *App) userSearch(w http.ResponseWriter, r *http.Request) {
	if a.GitHub == nil {
		WriteError(w, http.StatusServiceUnavailable, "github_unavailable", "GitHub API пока не настроен.")
		return
	}
	login := r.PathValue("login")
	profile, err := a.GitHub.GetUser(r.Context(), login)
	if err != nil {
		writeGitHubError(w, err)
		return
	}
	result, err := a.GitHub.ListPublicRepositories(r.Context(), profile.Login, 1, 30)
	if err != nil {
		writeGitHubError(w, err)
		return
	}
	items := make([]publicRepository, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, publicRepositoryFromGitHub(item))
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"user": publicGitHubUser(profile), "repositories": items, "hasNext": result.HasNext,
	})
}

func pagination(r *http.Request) (int, int, bool) {
	page, perPage := 1, 30
	var err error
	if raw := r.URL.Query().Get("page"); raw != "" {
		page, err = strconv.Atoi(raw)
		if err != nil || page < 1 {
			return 0, 0, false
		}
	}
	if raw := r.URL.Query().Get("perPage"); raw != "" {
		perPage, err = strconv.Atoi(raw)
		if err != nil || perPage < 1 || perPage > 100 {
			return 0, 0, false
		}
	}
	return page, perPage, true
}

type publicUserDTO struct {
	ID          string `json:"id"`
	GitHubID    int64  `json:"githubId"`
	Login       string `json:"githubLogin"`
	Name        string `json:"name"`
	AvatarURL   string `json:"avatarUrl"`
	ProfileURL  string `json:"profileUrl"`
	PublicRepos int    `json:"publicRepositories,omitempty"`
	Followers   int    `json:"followers,omitempty"`
	Following   int    `json:"following,omitempty"`
}

type publicRepository struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	FullName      string `json:"fullName"`
	OwnerLogin    string `json:"ownerLogin"`
	Description   string `json:"description"`
	Private       bool   `json:"private"`
	Fork          bool   `json:"fork"`
	Archived      bool   `json:"archived"`
	DefaultBranch string `json:"defaultBranch"`
	UpdatedAt     string `json:"updatedAt"`
	HTMLURL       string `json:"htmlUrl"`
}

func publicUserFromStore(user store.User) publicUserDTO {
	return publicUserDTO{ID: user.ID, GitHubID: user.GitHubID, Login: user.Login, Name: user.DisplayName, AvatarURL: user.AvatarURL, ProfileURL: user.ProfileURL}
}

func publicGitHubUser(user github.User) publicUserDTO {
	name := user.Name
	if name == "" {
		name = user.Login
	}
	return publicUserDTO{GitHubID: user.ID, Login: user.Login, Name: name, AvatarURL: user.AvatarURL, ProfileURL: user.ProfileURL, PublicRepos: user.PublicRepos, Followers: user.Followers, Following: user.Following}
}

func publicRepositoryFromGitHub(repo github.Repository) publicRepository {
	return publicRepository{ID: repo.ID, Name: repo.Name, FullName: repo.FullName, OwnerLogin: repo.OwnerLogin, Description: repo.Description, Private: repo.Private, Fork: repo.Fork, Archived: repo.Archived, DefaultBranch: repo.DefaultBranch, UpdatedAt: repo.UpdatedAt, HTMLURL: repo.HTMLURL}
}

func writeGitHubError(w http.ResponseWriter, err error) {
	var githubErr *github.Error
	if errors.As(err, &githubErr) {
		if githubErr.RetryAfter != "" {
			w.Header().Set("Retry-After", githubErr.RetryAfter)
		}
		WriteError(w, githubErr.Status, githubErr.Code, githubErr.Message)
		return
	}
	WriteError(w, http.StatusBadGateway, "github_unavailable", "GitHub временно недоступен.")
}

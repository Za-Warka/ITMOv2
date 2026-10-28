package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	GitHubClientID     string
	GitHubClientSecret string
	GitHubRedirectURL  string
	SessionSecret      string
	DatabasePath       string
	FrontendURL        string
	Port               int
	SecureCookies      bool
}

func Load(getenv func(string) string) (Config, error) {
	cfg := Config{
		GitHubClientID:     strings.TrimSpace(getenv("GITHUB_CLIENT_ID")),
		GitHubClientSecret: strings.TrimSpace(getenv("GITHUB_CLIENT_SECRET")),
		GitHubRedirectURL:  strings.TrimSpace(getenv("GITHUB_REDIRECT_URL")),
		SessionSecret:      getenv("SESSION_SECRET"),
		DatabasePath:       strings.TrimSpace(getenv("DATABASE_PATH")),
		FrontendURL:        strings.TrimSpace(getenv("FRONTEND_URL")),
		Port:               8080,
	}
	if cfg.DatabasePath == "" {
		cfg.DatabasePath = "./data/repo-atlas.db"
	}
	if cfg.FrontendURL == "" {
		cfg.FrontendURL = "http://127.0.0.1:3000"
	}
	if raw := strings.TrimSpace(getenv("PORT")); raw != "" {
		port, err := strconv.Atoi(raw)
		if err != nil || port < 1 || port > 65535 {
			return Config{}, fmt.Errorf("PORT must be an integer from 1 to 65535")
		}
		cfg.Port = port
	}
	if raw := strings.TrimSpace(getenv("SECURE_COOKIES")); raw != "" {
		secure, err := strconv.ParseBool(raw)
		if err != nil {
			return Config{}, fmt.Errorf("SECURE_COOKIES must be true or false")
		}
		cfg.SecureCookies = secure
	}
	return cfg, nil
}

func (c Config) ValidateOAuth() error {
	missing := make([]string, 0, 4)
	if c.GitHubClientID == "" {
		missing = append(missing, "GITHUB_CLIENT_ID")
	}
	if c.GitHubClientSecret == "" {
		missing = append(missing, "GITHUB_CLIENT_SECRET")
	}
	if c.GitHubRedirectURL == "" {
		missing = append(missing, "GITHUB_REDIRECT_URL")
	}
	if c.SessionSecret == "" {
		missing = append(missing, "SESSION_SECRET")
	}
	if len(missing) > 0 {
		return errors.New("missing OAuth configuration: " + strings.Join(missing, ", "))
	}
	return nil
}

func FromEnvironment() (Config, error) {
	return Load(os.Getenv)
}

package config

import "testing"

func env(values map[string]string) func(string) string {
	return func(key string) string { return values[key] }
}

func TestLoadUsesSafeNonSecretDefaults(t *testing.T) {
	cfg, err := Load(env(map[string]string{}))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Port != 8080 || cfg.DatabasePath != "./data/repo-atlas.db" {
		t.Fatalf("unexpected defaults: %+v", cfg)
	}
	if cfg.SessionSecret != "" || cfg.GitHubClientSecret != "" {
		t.Fatal("secret values must not have defaults")
	}
}

func TestLoadParsesEnvironment(t *testing.T) {
	cfg, err := Load(env(map[string]string{
		"GITHUB_CLIENT_ID":     "client",
		"GITHUB_CLIENT_SECRET": "secret",
		"GITHUB_REDIRECT_URL":  "http://localhost:8080/auth/github/callback",
		"SESSION_SECRET":       "session-secret",
		"DATABASE_PATH":        "/tmp/atlas.db",
		"FRONTEND_URL":         "http://localhost:3000",
		"PORT":                 "9090",
		"SECURE_COOKIES":       "true",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Port != 9090 || !cfg.SecureCookies || cfg.DatabasePath != "/tmp/atlas.db" {
		t.Fatalf("unexpected parsed config: %+v", cfg)
	}
	if err := cfg.ValidateOAuth(); err != nil {
		t.Fatalf("expected valid OAuth config: %v", err)
	}
}

func TestLoadRejectsInvalidPort(t *testing.T) {
	if _, err := Load(env(map[string]string{"PORT": "70000"})); err == nil {
		t.Fatal("expected invalid port error")
	}
}

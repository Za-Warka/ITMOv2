package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"repo-atlas/backend/internal/auth"
	"repo-atlas/backend/internal/config"
	"repo-atlas/backend/internal/github"
	"repo-atlas/backend/internal/httpapi"
	"repo-atlas/backend/internal/store"
)

func main() {
	cfg, err := config.FromEnvironment()
	if err != nil {
		log.Fatal(err)
	}
	database, err := store.Open(cfg.DatabasePath)
	if err != nil {
		log.Fatal(err)
	}
	defer database.Close()
	sessions := auth.NewSessionManager(database, cfg.SecureCookies)
	oauth := auth.NewOAuthService(database, sessions, cfg.GitHubClientID, cfg.GitHubClientSecret, cfg.GitHubRedirectURL, cfg.FrontendURL)
	client := github.NewClient(os.Getenv("GITHUB_TOKEN"))
	server := &http.Server{
		Addr:              ":" + strconv.Itoa(cfg.Port),
		Handler:           httpapi.NewApp(oauth, sessions, client),
		ReadHeaderTimeout: 5 * time.Second,
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		log.Printf("Repo Atlas API listening on %s", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("shutdown failed: %v", err)
	}
}

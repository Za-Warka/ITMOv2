package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthz(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	res := httptest.NewRecorder()
	NewServer().ServeHTTP(res, req)
	if res.Code != http.StatusOK || res.Header().Get("Content-Type") == "" {
		t.Fatalf("unexpected response: %d %s", res.Code, res.Body.String())
	}
}

func TestNotFoundUsesStableError(t *testing.T) {
	res := httptest.NewRecorder()
	NewServer().ServeHTTP(res, httptest.NewRequest(http.MethodGet, "/missing", nil))
	var body ErrorBody
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if res.Code != http.StatusNotFound || body.Error.Code != "not_found" {
		t.Fatalf("unexpected error response: %d %+v", res.Code, body)
	}
}

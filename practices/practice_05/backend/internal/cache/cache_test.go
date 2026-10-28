package cache

import (
	"testing"
	"time"
)

func TestCacheReusesValuesAndExpiresThem(t *testing.T) {
	clock := time.Unix(1_700_000_000, 0)
	c := New(2, time.Minute)
	c.now = func() time.Time { return clock }
	c.Set("repo", "snapshot")
	if value, ok := c.Get("repo"); !ok || value != "snapshot" {
		t.Fatalf("expected cached value, got %v %v", value, ok)
	}
	clock = clock.Add(time.Minute)
	if _, ok := c.Get("repo"); ok {
		t.Fatal("expected value to expire")
	}
}

func TestCacheEvictsOldestValueAtLimit(t *testing.T) {
	clock := time.Unix(1_700_000_000, 0)
	c := New(1, time.Hour)
	c.now = func() time.Time { return clock }
	c.Set("old", 1)
	clock = clock.Add(time.Second)
	c.Set("new", 2)
	if _, ok := c.Get("old"); ok {
		t.Fatal("expected oldest item to be evicted")
	}
	if value, ok := c.Get("new"); !ok || value != 2 {
		t.Fatalf("expected newest item, got %v %v", value, ok)
	}
}

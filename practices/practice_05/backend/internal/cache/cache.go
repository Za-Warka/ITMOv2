package cache

import (
	"sync"
	"time"
)

type entry struct {
	value     any
	expiresAt time.Time
	createdAt time.Time
}

type Cache struct {
	mu       sync.Mutex
	items    map[string]entry
	maxItems int
	ttl      time.Duration
	now      func() time.Time
}

func New(maxItems int, ttl time.Duration) *Cache {
	if maxItems < 1 {
		maxItems = 1
	}
	return &Cache{items: make(map[string]entry), maxItems: maxItems, ttl: ttl, now: time.Now}
}

func (c *Cache) Get(key string) (any, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	item, ok := c.items[key]
	if !ok {
		return nil, false
	}
	if !c.now().Before(item.expiresAt) {
		delete(c.items, key)
		return nil, false
	}
	return item.value, true
}

func (c *Cache) Set(key string, value any) {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := c.now()
	c.items[key] = entry{value: value, createdAt: now, expiresAt: now.Add(c.ttl)}
	for len(c.items) > c.maxItems {
		oldestKey := ""
		var oldest time.Time
		for candidate, item := range c.items {
			if oldestKey == "" || item.createdAt.Before(oldest) {
				oldestKey, oldest = candidate, item.createdAt
			}
		}
		delete(c.items, oldestKey)
	}
}

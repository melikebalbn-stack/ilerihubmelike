/**
 * FIX #22: Basit in-memory cache utility
 * TTL ve max entry limiti desteği
 */

interface CacheEntry<T> {
  data: T
  expiry: number
}

class SimpleCache {
  private store = new Map<string, CacheEntry<unknown>>()
  private maxEntries: number

  constructor(maxEntries: number = 500) {
    this.maxEntries = maxEntries
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiry) {
      this.store.delete(key)
      return null
    }
    return entry.data as T
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    // Önce stale entry'leri temizle
    this.cleanup()

    // Max size kontrolü - en eski entry'leri sil
    if (this.store.size >= this.maxEntries) {
      const entries = [...this.store.entries()]
        .sort((a, b) => a[1].expiry - b[1].expiry)

      const toDelete = entries.slice(0, Math.floor(this.maxEntries * 0.2))
      for (const [k] of toDelete) {
        this.store.delete(k)
      }
    }

    this.store.set(key, { data, expiry: Date.now() + ttlMs })
  }

  invalidate(key: string): void {
    this.store.delete(key)
  }

  invalidatePattern(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key)
      }
    }
  }

  // Memory leak önleme - stale entry temizliği
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiry) {
        this.store.delete(key)
      }
    }
  }

  // Cache boyutunu al
  size(): number {
    return this.store.size
  }

  // Tüm cache'i temizle
  clear(): void {
    this.store.clear()
  }
}

// Global app cache instance
export const appCache = new SimpleCache(500)

// Dakikada bir otomatik temizlik (server-side only)
if (typeof setInterval !== 'undefined') {
  setInterval(() => appCache.cleanup(), 60_000)
}

// Cache key'leri
export const CACHE_KEYS = {
  SUGGESTION_CATEGORIES: 'suggestion_categories',
  LDAP_ALL_USERS: 'ldap_all_users',
  LDAP_USER_PREFIX: 'ldap_user_',
} as const

// Cache TTL'leri (ms)
export const CACHE_TTL = {
  SHORT: 1 * 60 * 1000,      // 1 dakika
  MEDIUM: 5 * 60 * 1000,     // 5 dakika
  LONG: 10 * 60 * 1000,      // 10 dakika
  HOUR: 60 * 60 * 1000,      // 1 saat
} as const

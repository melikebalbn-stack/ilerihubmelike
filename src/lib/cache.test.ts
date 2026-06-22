import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { appCache, CACHE_KEYS, CACHE_TTL } from './cache'

describe('SimpleCache', () => {
  beforeEach(() => {
    appCache.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('get ve set', () => {
    it('cache değeri kaydedilip okunabilmeli', () => {
      appCache.set('test-key', { data: 'value' }, CACHE_TTL.SHORT)

      const result = appCache.get<{ data: string }>('test-key')
      expect(result).toEqual({ data: 'value' })
    })

    it('olmayan key null dönmeli', () => {
      const result = appCache.get('nonexistent')
      expect(result).toBeNull()
    })

    it('farklı tiplerde veri saklanabilmeli', () => {
      appCache.set('string', 'test', CACHE_TTL.SHORT)
      appCache.set('number', 42, CACHE_TTL.SHORT)
      appCache.set('array', [1, 2, 3], CACHE_TTL.SHORT)
      appCache.set('object', { key: 'value' }, CACHE_TTL.SHORT)

      expect(appCache.get('string')).toBe('test')
      expect(appCache.get('number')).toBe(42)
      expect(appCache.get('array')).toEqual([1, 2, 3])
      expect(appCache.get('object')).toEqual({ key: 'value' })
    })
  })

  describe('TTL (Time To Live)', () => {
    it('TTL süresi dolmadan veri okunabilmeli', () => {
      appCache.set('test', 'value', 5000)

      const result = appCache.get('test')
      expect(result).toBe('value')
    })

    it('TTL süresi dolduktan sonra null dönmeli', () => {
      vi.useFakeTimers()

      appCache.set('test', 'value', 1000)

      vi.advanceTimersByTime(1001)

      const result = appCache.get('test')
      expect(result).toBeNull()

      vi.useRealTimers()
    })
  })

  describe('invalidate', () => {
    it('tek key invalidate edilebilmeli', () => {
      appCache.set('key1', 'value1', CACHE_TTL.SHORT)
      appCache.set('key2', 'value2', CACHE_TTL.SHORT)

      appCache.invalidate('key1')

      expect(appCache.get('key1')).toBeNull()
      expect(appCache.get('key2')).toBe('value2')
    })

    it('pattern ile invalidate edilebilmeli', () => {
      appCache.set('user_1', 'data1', CACHE_TTL.SHORT)
      appCache.set('user_2', 'data2', CACHE_TTL.SHORT)
      appCache.set('settings_1', 'settings', CACHE_TTL.SHORT)

      appCache.invalidatePattern('user_')

      expect(appCache.get('user_1')).toBeNull()
      expect(appCache.get('user_2')).toBeNull()
      expect(appCache.get('settings_1')).toBe('settings')
    })
  })

  describe('size ve clear', () => {
    it('cache boyutu doğru raporlanmalı', () => {
      expect(appCache.size()).toBe(0)

      appCache.set('key1', 'value1', CACHE_TTL.SHORT)
      expect(appCache.size()).toBe(1)

      appCache.set('key2', 'value2', CACHE_TTL.SHORT)
      expect(appCache.size()).toBe(2)
    })

    it('clear tüm cache temizlemeli', () => {
      appCache.set('key1', 'value1', CACHE_TTL.SHORT)
      appCache.set('key2', 'value2', CACHE_TTL.SHORT)

      appCache.clear()

      expect(appCache.size()).toBe(0)
      expect(appCache.get('key1')).toBeNull()
    })
  })

  describe('cleanup', () => {
    it('cleanup expired entry silmeli', () => {
      vi.useFakeTimers()

      appCache.set('expired', 'value', 1000)
      appCache.set('valid', 'value', 10000)

      vi.advanceTimersByTime(2000)

      appCache.cleanup()

      expect(appCache.get('expired')).toBeNull()
      expect(appCache.get('valid')).toBe('value')

      vi.useRealTimers()
    })
  })
})

describe('CACHE_KEYS', () => {
  it('tanımlı cache key sabitleri olmalı', () => {
    expect(CACHE_KEYS.SUGGESTION_CATEGORIES).toBe('suggestion_categories')
    expect(CACHE_KEYS.LDAP_ALL_USERS).toBe('ldap_all_users')
    expect(CACHE_KEYS.LDAP_USER_PREFIX).toBe('ldap_user_')
  })
})

describe('CACHE_TTL', () => {
  it('TTL sabitleri doğru olmalı', () => {
    expect(CACHE_TTL.SHORT).toBe(60 * 1000)
    expect(CACHE_TTL.MEDIUM).toBe(5 * 60 * 1000)
    expect(CACHE_TTL.LONG).toBe(10 * 60 * 1000)
    expect(CACHE_TTL.HOUR).toBe(60 * 60 * 1000)
  })
})

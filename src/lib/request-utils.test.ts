import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getClientIp, hashIp, getUserAgent, getRequestMetadata } from './request-utils'

describe('getClientIp', () => {
  const createMockRequest = (headers: Record<string, string>): Request => {
    return {
      headers: {
        get: (name: string) => headers[name] || null
      }
    } as unknown as Request
  }

  it('x-forwarded-for header varsa ilk IP döndürmeli', () => {
    const request = createMockRequest({
      'x-forwarded-for': '192.168.1.1, 10.0.0.1, 172.16.0.1'
    })

    expect(getClientIp(request)).toBe('192.168.1.1')
  })

  it('x-forwarded-for tek IP içeriyorsa o IP döndürmeli', () => {
    const request = createMockRequest({
      'x-forwarded-for': '192.168.1.100'
    })

    expect(getClientIp(request)).toBe('192.168.1.100')
  })

  it('x-real-ip fallback olarak kullanılmalı', () => {
    const request = createMockRequest({
      'x-real-ip': '10.0.0.5'
    })

    expect(getClientIp(request)).toBe('10.0.0.5')
  })

  it('header yoksa unknown döndürmeli', () => {
    const request = createMockRequest({})

    expect(getClientIp(request)).toBe('unknown')
  })

  it('x-forwarded-for öncelikli olmalı', () => {
    const request = createMockRequest({
      'x-forwarded-for': '192.168.1.1',
      'x-real-ip': '10.0.0.5'
    })

    expect(getClientIp(request)).toBe('192.168.1.1')
  })

  it('IP whitespace trim edilmeli', () => {
    const request = createMockRequest({
      'x-forwarded-for': '  192.168.1.1  '
    })

    expect(getClientIp(request)).toBe('192.168.1.1')
  })
})

describe('hashIp', () => {
  beforeEach(() => {
    vi.stubEnv('NEXTAUTH_SECRET', 'test-secret')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('IP hash edilmeli', () => {
    const hash = hashIp('192.168.1.1')

    expect(hash).toBeTruthy()
    expect(hash).not.toBe('192.168.1.1')
  })

  it('hash 16 karakter olmalı', () => {
    const hash = hashIp('192.168.1.1')

    expect(hash.length).toBe(16)
  })

  it('aynı IP aynı hash üretmeli', () => {
    const hash1 = hashIp('192.168.1.1')
    const hash2 = hashIp('192.168.1.1')

    expect(hash1).toBe(hash2)
  })

  it('farklı IP farklı hash üretmeli', () => {
    const hash1 = hashIp('192.168.1.1')
    const hash2 = hashIp('192.168.1.2')

    expect(hash1).not.toBe(hash2)
  })

  it('hash hexadecimal olmalı', () => {
    const hash = hashIp('192.168.1.1')

    expect(hash).toMatch(/^[0-9a-f]+$/)
  })
})

describe('getUserAgent', () => {
  const createMockRequest = (userAgent?: string): Request => {
    return {
      headers: {
        get: (name: string) => name === 'user-agent' ? userAgent || null : null
      }
    } as unknown as Request
  }

  it('user-agent header döndürmeli', () => {
    const request = createMockRequest('Mozilla/5.0 Chrome/120.0.0.0')

    expect(getUserAgent(request)).toBe('Mozilla/5.0 Chrome/120.0.0.0')
  })

  it('header yoksa unknown döndürmeli', () => {
    const request = createMockRequest()

    expect(getUserAgent(request)).toBe('unknown')
  })
})

describe('getRequestMetadata', () => {
  const createMockRequest = (headers: Record<string, string>): Request => {
    return {
      headers: {
        get: (name: string) => headers[name] || null
      }
    } as unknown as Request
  }

  beforeEach(() => {
    vi.stubEnv('NEXTAUTH_SECRET', 'test-secret')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('tüm metadata döndürmeli', () => {
    const request = createMockRequest({
      'x-forwarded-for': '192.168.1.1',
      'user-agent': 'Mozilla/5.0'
    })

    const metadata = getRequestMetadata(request)

    expect(metadata.ipHash).toBeTruthy()
    expect(metadata.ipHash.length).toBe(16)
    expect(metadata.userAgent).toBe('Mozilla/5.0')
    expect(metadata.timestamp).toBeTruthy()
  })

  it('userAgent 255 karaktere kısaltılmalı', () => {
    const longUserAgent = 'A'.repeat(300)
    const request = createMockRequest({
      'user-agent': longUserAgent
    })

    const metadata = getRequestMetadata(request)

    expect(metadata.userAgent.length).toBe(255)
  })

  it('timestamp ISO format olmalı', () => {
    const request = createMockRequest({})

    const metadata = getRequestMetadata(request)

    expect(() => new Date(metadata.timestamp)).not.toThrow()
    expect(metadata.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

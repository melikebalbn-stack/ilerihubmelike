import { describe, it, expect } from 'vitest'
import { validatePinStrength, hashPin, verifyPin } from './pin-utils'

describe('validatePinStrength', () => {
  describe('uzunluk kontrolü', () => {
    it('6 karakterden kısa PIN reddedilmeli', () => {
      const result = validatePinStrength('12345')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('6 karakter')
    })

    it('boş PIN reddedilmeli', () => {
      const result = validatePinStrength('')
      expect(result.isValid).toBe(false)
    })

    it('20 karakterden uzun PIN reddedilmeli', () => {
      const result = validatePinStrength('123456789012345678901')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('20 karakter')
    })

    it('6-20 karakter arası PIN kabul edilmeli', () => {
      const result = validatePinStrength('secure123pin')
      expect(result.isValid).toBe(true)
    })
  })

  describe('zayıf PIN kontrolü', () => {
    it('123456 reddedilmeli', () => {
      const result = validatePinStrength('123456')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('zayıf')
    })

    it('111111 reddedilmeli', () => {
      const result = validatePinStrength('111111')
      expect(result.isValid).toBe(false)
    })

    it('qwerty reddedilmeli', () => {
      const result = validatePinStrength('qwerty')
      expect(result.isValid).toBe(false)
    })

    it('abc123 reddedilmeli', () => {
      const result = validatePinStrength('abc123')
      expect(result.isValid).toBe(false)
    })
  })

  describe('ardışık sayı kontrolü', () => {
    it('ardışık artan sayılar reddedilmeli (1234xx)', () => {
      const result = validatePinStrength('1234ab')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('ardışık')
    })

    it('ardışık azalan sayılar reddedilmeli (4321xx)', () => {
      const result = validatePinStrength('4321ab')
      expect(result.isValid).toBe(false)
    })

    it('3 ardışık sayı kabul edilmeli', () => {
      const result = validatePinStrength('123abc')
      expect(result.isValid).toBe(true)
    })
  })

  describe('tekrarlayan karakter kontrolü', () => {
    it('4+ aynı karakter reddedilmeli', () => {
      const result = validatePinStrength('aaaabb')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('4+ kez')
    })

    it('3 aynı karakter kabul edilmeli', () => {
      const result = validatePinStrength('aaabbb')
      expect(result.isValid).toBe(true)
    })
  })

  describe('geçerli PIN', () => {
    it('güçlü PIN kabul edilmeli', () => {
      const result = validatePinStrength('MySecure123')
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })
  })
})

describe('hashPin ve verifyPin', () => {
  it('PIN hash edilmeli ve doğrulanabilmeli', async () => {
    const pin = 'TestPin123'
    const hashedPin = await hashPin(pin)

    expect(hashedPin).not.toBe(pin)
    expect(hashedPin.length).toBeGreaterThan(0)

    const isValid = await verifyPin(pin, hashedPin)
    expect(isValid).toBe(true)
  })

  it('yanlış PIN doğrulanmamalı', async () => {
    const pin = 'TestPin123'
    const hashedPin = await hashPin(pin)

    const isValid = await verifyPin('WrongPin', hashedPin)
    expect(isValid).toBe(false)
  })

  it('her hash benzersiz olmalı (salt)', async () => {
    const pin = 'TestPin123'
    const hash1 = await hashPin(pin)
    const hash2 = await hashPin(pin)

    expect(hash1).not.toBe(hash2)
  })
})

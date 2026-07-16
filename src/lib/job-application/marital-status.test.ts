import { describe, it, expect } from 'vitest'
import { normalizeMaritalStatus, ALLOWED_MARITAL_STATUS } from './marital-status'

describe('normalizeMaritalStatus (allow-list)', () => {
  it('izinli değerler aynen döner', () => {
    expect(normalizeMaritalStatus('SINGLE')).toBe('SINGLE')
    expect(normalizeMaritalStatus('MARRIED')).toBe('MARRIED')
  })

  it('artık kaldırılan değerler (DIVORCED/WIDOWED) → null', () => {
    expect(normalizeMaritalStatus('DIVORCED')).toBeNull()
    expect(normalizeMaritalStatus('WIDOWED')).toBeNull()
  })

  it('boş / geçersiz / farklı tip → null', () => {
    expect(normalizeMaritalStatus('')).toBeNull()
    expect(normalizeMaritalStatus('single')).toBeNull() // case-sensitive
    expect(normalizeMaritalStatus(null)).toBeNull()
    expect(normalizeMaritalStatus(undefined)).toBeNull()
    expect(normalizeMaritalStatus(123)).toBeNull()
  })

  it('allow-list yalnız iki değer içerir', () => {
    expect([...ALLOWED_MARITAL_STATUS]).toEqual(['SINGLE', 'MARRIED'])
  })
})

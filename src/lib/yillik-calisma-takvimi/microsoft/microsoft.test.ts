import { describe, expect, it } from 'vitest'
import { buildYctMicrosoftEvent, microsoftTransactionId, resolveMicrosoftIdentity } from './payload'
import { classifyMicrosoftError, microsoftBackoffMs, MICROSOFT_MAX_ATTEMPTS, safeMicrosoftLogContext } from './reliability'

const base = {
  id: 'record-1', anaKonu: 'İnsan Varlıkları', surec: 'Yıllık değerlendirme', kisaBaslik: 'Değerlendirme',
  kayitTuru: 'TOPLANTI', tumGunMu: true, nihaiSonTarih: new Date('2026-08-09T00:00:00.000Z'),
  appBaseUrl: 'https://hub.example.test/path',
}

describe('Microsoft identity', () => {
  it('azureAdId değerini doğrulanmış e-postadan önce kullanır', () => {
    expect(resolveMicrosoftIdentity({ azureAdId: 'object-1', email: 'user@example.com', emailVerified: new Date() }, ['example.com'])).toEqual({ available: true, identity: { kind: 'azureAdId', value: 'object-1' } })
  })
  it('yalnız doğrulanmış kurumsal e-postaya fallback yapar', () => {
    expect(resolveMicrosoftIdentity({ email: 'USER@EXAMPLE.COM', emailVerified: new Date() }, ['example.com'])).toEqual({ available: true, identity: { kind: 'email', value: 'user@example.com' } })
    expect(resolveMicrosoftIdentity({ email: 'user@outside.test', emailVerified: new Date() }, ['example.com'])).toEqual({ available: false, reason: 'MICROSOFT_IDENTITY_UNAVAILABLE' })
  })
  it('güvenilir identity yoksa tahmin yürütmez', () => {
    expect(resolveMicrosoftIdentity({ email: 'user@example.com', emailVerified: null }, ['example.com'])).toEqual({ available: false, reason: 'MICROSOFT_IDENTITY_UNAVAILABLE' })
  })
})

describe('YCT Microsoft event payload', () => {
  it('tarih-only kaydı İstanbul all-day ve exclusive bitişle üretir', () => {
    const payload = buildYctMicrosoftEvent(base)
    expect(payload).toMatchObject({ subject: 'Değerlendirme', isAllDay: true, start: { dateTime: '2026-08-09T00:00:00', timeZone: 'Europe/Istanbul' }, end: { dateTime: '2026-08-10T00:00:00', timeZone: 'Europe/Istanbul' } })
  })
  it('saatli eventte İstanbul saatini kaydırmadan kullanır', () => {
    const payload = buildYctMicrosoftEvent({ ...base, tumGunMu: false, baslangicTarihi: new Date('2026-08-09T07:00:00Z'), bitisTarihi: new Date('2026-08-09T08:30:00Z') })
    expect(payload.start.dateTime).toBe('2026-08-09T10:00:00'); expect(payload.end.dateTime).toBe('2026-08-09T11:30:00')
  })
  it('normal event ile Teams eventini tek calendar payloadında ayırır', () => {
    expect(buildYctMicrosoftEvent(base)).not.toHaveProperty('isOnlineMeeting')
    expect(buildYctMicrosoftEvent({ ...base, kayitTuru: 'TEAMS_TOPLANTISI' })).toMatchObject({ isOnlineMeeting: true, onlineMeetingProvider: 'teamsForBusiness' })
  })
  it('yalnız minimum alanları taşır ve hassas YCT alanlarını sızdırmaz', () => {
    const payload = buildYctMicrosoftEvent({ ...base, attendeeEmails: ['person@example.com'], lokasyon: 'Toplantı Odası', ...({ aciklama: 'HASSAS', checklist: ['GIZLI'], audit: 'SECRET', gerceklesmemeNedeni: 'PII', saklamaYolu: '/private/file' } as object) })
    const serialized = JSON.stringify(payload)
    for (const forbidden of ['HASSAS', 'GIZLI', 'SECRET', 'PII', '/private/file', 'record-1']) expect(serialized).not.toContain(forbidden)
    expect(payload.attendees).toEqual([{ emailAddress: { address: 'person@example.com' }, type: 'required' }])
  })
  it('geçersiz saat aralığını reddeder', () => {
    expect(() => buildYctMicrosoftEvent({ ...base, tumGunMu: false, baslangicTarihi: new Date('2026-08-09T08:00:00Z'), bitisTarihi: new Date('2026-08-09T07:00:00Z') })).toThrow('başlangıç ve bitiş')
  })
  it('transactionId deterministik, girdiyi açığa çıkarmayan sabit uzunlukta hash üretir', () => {
    const first = microsoftTransactionId('record-1', 'v3')
    expect(first).toBe(microsoftTransactionId('record-1', 'v3')); expect(first).not.toContain('record-1'); expect(first).toHaveLength(64)
    expect(first).not.toBe(microsoftTransactionId('record-1', 'v4'))
  })
})

describe('Microsoft hata ve retry politikası', () => {
  it('401/403 kalıcı yetki, 404 remote missing sınıflandırır', () => {
    expect(classifyMicrosoftError({ status: 401 })).toMatchObject({ category: 'AUTH_PERMISSION', retryable: false })
    expect(classifyMicrosoftError({ status: 403 })).toMatchObject({ category: 'AUTH_PERMISSION', retryable: false })
    expect(classifyMicrosoftError({ status: 404 })).toMatchObject({ category: 'REMOTE_MISSING', retryable: false })
  })
  it('429 Retry-After, 5xx ve network hatasını retryable sınıflandırır', () => {
    expect(classifyMicrosoftError({ status: 429, retryAfter: '12' })).toEqual({ category: 'RATE_LIMIT', retryable: true, retryAfterMs: 12000 })
    expect(classifyMicrosoftError({ status: 503 })).toMatchObject({ category: 'SERVER', retryable: true })
    expect(classifyMicrosoftError({ networkError: true })).toMatchObject({ category: 'NETWORK', retryable: true })
  })
  it('diğer 4xx hataları kalıcı request error kabul eder', () => {
    expect(classifyMicrosoftError({ status: 400 })).toEqual({ category: 'REQUEST', retryable: false, retryAfterMs: null })
  })
  it('exponential backoff sınırlıdır ve maksimum denemede durur', () => {
    expect([1, 2, 3, 4].map(attempt => microsoftBackoffMs(attempt))).toEqual([1000, 2000, 4000, 8000])
    expect(microsoftBackoffMs(MICROSOFT_MAX_ATTEMPTS)).toBeNull(); expect(microsoftBackoffMs(1, 9999999)).toBe(300000)
  })
  it('güvenli log bağlamı raw hata, token veya e-posta içermez', () => {
    const context = safeMicrosoftLogContext('create', classifyMicrosoftError({ status: 429, retryAfter: '10' }))
    expect(context).toEqual({ operation: 'create', category: 'RATE_LIMIT', retryable: true })
    expect(JSON.stringify(context)).not.toMatch(/token|email|body|secret/i)
  })
})

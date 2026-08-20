import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bildirimTetigiEslesir, BildirimKuraliCreateSchema } from './notification-validators'
import { deadlineDifference, istanbulToday, runYillikTakvimNotifications } from './notifications'

const sendEmail = vi.hoisted(() => vi.fn())
vi.mock('@/lib/email', () => ({ sendEmail }))

beforeEach(() => { sendEmail.mockReset() })

describe('Yıllık Takvim bildirim kuralları', () => {
  it('yaklaşan, son gün ve geciken tetiklerini eşler', () => {
    expect(bildirimTetigiEslesir('gun_kala:15', 15)).toBe(true)
    expect(bildirimTetigiEslesir('son_gun', 0)).toBe(true)
    expect(bildirimTetigiEslesir('gun_gecikme:7', -7)).toBe(true)
    expect(bildirimTetigiEslesir('gun_kala:15', 14)).toBe(false)
  })
  it('boş rol/kanal ve sınırsız gün değerini reddeder', () => {
    expect(BildirimKuraliCreateSchema.safeParse({ tetik: 'gun_kala:0', aliciRoller: ['ANA_SORUMLU'], kanal: ['HUB'] }).success).toBe(false)
    expect(BildirimKuraliCreateSchema.safeParse({ tetik: 'gun_kala:30', aliciRoller: [], kanal: ['HUB'] }).success).toBe(false)
  })
  it('İstanbul gününü UTC tarih-only olarak ve gün farkını kaymasız hesaplar', () => {
    const today = istanbulToday(new Date('2026-01-31T22:30:00Z'))
    expect(today.toISOString()).toBe('2026-02-01T00:00:00.000Z')
    expect(deadlineDifference(new Date('2026-02-16T00:00:00.000Z'), today)).toBe(15)
  })
})

const user = { id: 'user-1', name: 'Örnek', email: 'private@example.com', isActive: true }
const record = (overrides: Record<string, unknown> = {}) => ({
  id: 'record-1', surec: 'Süreç', kisaBaslik: 'Başlık', nihaiSonTarih: new Date('2026-02-16T00:00:00Z'),
  katilimcilar: [{ rol: 'ANA_SORUMLU', user }],
  onayAdimlari: [],
  bildirimKurallari: [{ id: 'rule-1', tetik: 'gun_kala:15', aliciRoller: ['ANA_SORUMLU'], kanal: ['HUB'], aktif: true }],
  ...overrides,
})
function db(records: unknown[], existing: unknown = null, escalation: unknown = null) {
  return {
    yillikTakvimKaydi: { findMany: vi.fn().mockResolvedValue(records) },
    yillikTakvimOnayKademesi: { findFirst: vi.fn().mockResolvedValue(escalation) },
    yillikTakvimBildirimLog: { findUnique: vi.fn().mockResolvedValue(existing), upsert: vi.fn() },
    notification: { create: vi.fn() },
  }
}
describe('Yıllık Takvim dry-run motoru', () => {
  it('yaklaşan kaydı PII içermeyen özetle planlar ve write yapmaz', async () => {
    const mockDb = db([record()])
    const result = await runYillikTakvimNotifications({ dryRun: true, now: new Date('2026-02-01T12:00:00Z'), db: mockDb as never })
    expect(result).toMatchObject({ evaluatedRecordCount: 1, candidateCount: 1, skippedDuplicateCount: 0 })
    expect(JSON.stringify(result)).not.toContain('private@example.com'); expect(JSON.stringify(result)).not.toContain('Örnek')
    expect(mockDb.notification.create).not.toHaveBeenCalled(); expect(mockDb.yillikTakvimBildirimLog.upsert).not.toHaveBeenCalled()
  })
  it('mükerrer logu atlanmış sayar', async () => {
    const result = await runYillikTakvimNotifications({ dryRun: true, now: new Date('2026-02-01T12:00:00Z'), db: db([record()], { id: 'log-1', sonuc: 'GONDERILDI' }) as never })
    expect(result.skippedDuplicateCount).toBe(1); expect(result.candidates[0].duplicate).toBe(true)
  })
  it('ONAYLAYAN rolü için birinci snapshot adımının aktif kullanıcısını alıcıya ekler', async () => {
    const approver = { id: 'approver-1', name: 'Onaylayan', email: 'approver@example.com', isActive: true }
    const approvalRecord = record({
      katilimcilar: [],
      onayAdimlari: [{ adimSira: 1, onaylayan: approver }],
      bildirimKurallari: [{ id: 'rule-1', tetik: 'gun_kala:15', aliciRoller: ['ONAYLAYAN'], kanal: ['HUB'], aktif: true }],
    })

    const result = await runYillikTakvimNotifications({ dryRun: true, now: new Date('2026-02-01T12:00:00Z'), db: db([approvalRecord]) as never })

    expect(result.candidates[0].targetUserCount).toBe(1)
    expect(result.missingRecipientCount).toBe(0)
  })
  it('eskalasyonda yalnız aktif ikinci kademeyi ekler; yoksa alıcı uydurmaz', async () => {
    const overdue = record({ nihaiSonTarih: new Date('2026-01-25T00:00:00Z'), katilimcilar: [], bildirimKurallari: [{ id: 'r', tetik: 'gun_gecikme:7', aliciRoller: ['ANA_SORUMLU'], kanal: ['HUB'], aktif: true }] })
    const missing = await runYillikTakvimNotifications({ dryRun: true, now: new Date('2026-02-01T12:00:00Z'), db: db([overdue]) as never })
    expect(missing.missingRecipientCount).toBe(1); expect(missing.candidates[0].targetUserCount).toBe(0)
    const found = await runYillikTakvimNotifications({ dryRun: true, now: new Date('2026-02-01T12:00:00Z'), db: db([overdue], null, { user }) as never })
    expect(found.candidates[0].targetUserCount).toBe(1)
  })
  it('gerçek gönderim yolunda Hub write ve ardından dedup log oluşturur', async () => {
    const mockDb = db([record()])
    mockDb.notification.create.mockResolvedValue({ id: 'notification-1' })
    mockDb.yillikTakvimBildirimLog.upsert.mockResolvedValue({ id: 'log-1' })
    const result = await runYillikTakvimNotifications({ dryRun: false, now: new Date('2026-02-01T12:00:00Z'), db: mockDb as never })
    expect(mockDb.notification.create).toHaveBeenCalledWith({ data: expect.objectContaining({ link: '/strategic-hr/yillik-calisma-takvimi' }) })
    expect(mockDb.yillikTakvimBildirimLog.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ kanal: 'HUB', sonuc: 'GONDERILDI' }) })); expect(result.sentCount).toBe(1)
  })
  it('Hub başarılı ve e-posta başarısız olduğunda kanal sonuçlarını ayrı loglar', async () => {
    sendEmail.mockResolvedValueOnce({ success: false, error: 'SMTP kapalı' })
    const mockDb = db([record({ bildirimKurallari: [{ id: 'rule-1', tetik: 'gun_kala:15', aliciRoller: ['ANA_SORUMLU'], kanal: ['HUB', 'EPOSTA'], aktif: true }] })])
    mockDb.notification.create.mockResolvedValue({ id: 'notification-1' })
    mockDb.yillikTakvimBildirimLog.upsert.mockResolvedValue({ id: 'log-1' })

    const result = await runYillikTakvimNotifications({ dryRun: false, now: new Date('2026-02-01T12:00:00Z'), db: mockDb as never })

    expect(mockDb.yillikTakvimBildirimLog.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ kanal: 'HUB', sonuc: 'GONDERILDI' }) }))
    expect(mockDb.yillikTakvimBildirimLog.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ kanal: 'EPOSTA', sonuc: 'HATA', hataMesaji: 'SMTP kapalı' }) }))
    expect(result).toMatchObject({ sentCount: 1, errorCount: 1 })
  })
  it('sonraki çalıştırmada başarılı Hub kanalını atlar ve hatalı e-postayı yeniden dener', async () => {
    sendEmail.mockResolvedValueOnce({ success: true })
    const mockDb = db([record({ bildirimKurallari: [{ id: 'rule-1', tetik: 'gun_kala:15', aliciRoller: ['ANA_SORUMLU'], kanal: ['HUB', 'EPOSTA'], aktif: true }] })])
    mockDb.yillikTakvimBildirimLog.findUnique.mockImplementation(({ where }: { where: { kayitId_tetik_aliciEposta_gonderimGunu_kanal: { kanal: string } } }) => Promise.resolve(where.kayitId_tetik_aliciEposta_gonderimGunu_kanal.kanal === 'HUB' ? { sonuc: 'GONDERILDI' } : { sonuc: 'HATA' }))
    mockDb.yillikTakvimBildirimLog.upsert.mockResolvedValue({ id: 'email-log' })

    const result = await runYillikTakvimNotifications({ dryRun: false, now: new Date('2026-02-01T12:00:00Z'), db: mockDb as never })

    expect(mockDb.notification.create).not.toHaveBeenCalled()
    expect(sendEmail).toHaveBeenCalledOnce()
    expect(mockDb.yillikTakvimBildirimLog.upsert).toHaveBeenCalledTimes(1)
    expect(mockDb.yillikTakvimBildirimLog.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ kanal: 'EPOSTA', sonuc: 'GONDERILDI' }) }))
    expect(result).toMatchObject({ sentCount: 1, skippedDuplicateCount: 1, errorCount: 0 })
  })
})

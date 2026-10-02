import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * fifKullaniciyaBildir — TEK giriş noktası: in-app + push + mail BAĞIMSIZ kanallar.
 * Biri hata verirse diğerleri yine çalışır; sentetik bluecollar adreste mail atlanır.
 */

const notificationCreate = vi.fn()
const pushCount = vi.fn()
const userFindFirst = vi.fn()
const sendPushToUser = vi.fn()
const sendEmail = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: { create: (...a: unknown[]) => notificationCreate(...a) },
    pushSubscription: { count: (...a: unknown[]) => pushCount(...a) },
    user: { findFirst: (...a: unknown[]) => userFindFirst(...a) },
  },
}))
vi.mock('@/lib/push-notifications', () => ({ sendPushToUser: (...a: unknown[]) => sendPushToUser(...a) }))
vi.mock('@/lib/email', () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }))
vi.mock('@/lib/bluecollar-email', () => ({ sentetikMailMi: (e: string) => e.endsWith('@bluecollar.local') }))
vi.mock('@/lib/email-templates/layout', () => ({
  renderEmail: (i: { title: string }) => ({ html: `<h1>${i.title}</h1>`, text: i.title }),
  p: (s: string) => s,
  esc: (s: string) => s,
  logoAttachments: () => undefined,
}))
vi.mock('@/lib/quality/fif-zincir', () => ({ acaninBolumMuduru: vi.fn(), kssKoltukKullanicilari: vi.fn() }))
import { fifKullaniciyaBildir, fifDurumBildir, fifFaaliyetAtamaBildir, fifIzlemeSorumlusuBildir } from './fif-bildirim'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  notificationCreate.mockResolvedValue({ id: 'n1' })
  pushCount.mockResolvedValue(1)
  sendPushToUser.mockResolvedValue(1)
  userFindFirst.mockResolvedValue({ email: 'ali@ilerigroup.com', name: 'Ali', personnel: null })
  sendEmail.mockResolvedValue({ success: true })
})

describe('fifKullaniciyaBildir — üç kanal', () => {
  it('in-app + push + mail gider; mail şablonu başlık ve link taşır', async () => {
    const r = await fifKullaniciyaBildir('u1', '[FİF FIF-2026-001] Kapandı', 'FİF kapandı.', '/kalite/fif/f1')
    expect(r).toEqual({ inApp: true, push: 1, mail: 'gitti' })
    expect(notificationCreate).toHaveBeenCalledTimes(1)
    expect(sendPushToUser).toHaveBeenCalledWith(expect.anything(), 'u1', expect.objectContaining({ url: '/kalite/fif/f1', data: { link: '/kalite/fif/f1' } }))
    const [alicilar, konu] = sendEmail.mock.calls[0]
    expect(alicilar).toEqual([{ name: 'Ali', email: 'ali@ilerigroup.com' }])
    expect(konu).toBe('[FİF FIF-2026-001] Kapandı')
  })

  it('sentetik bluecollar adreste mail ATLANIR; in-app + push yine gider', async () => {
    userFindFirst.mockResolvedValue({ email: 'x@bluecollar.local', name: 'X', personnel: null })
    const r = await fifKullaniciyaBildir('u1', 'k', 'g', '/kalite/fif/f1')
    expect(r).toEqual({ inApp: true, push: 1, mail: 'atlandi' })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('e-postası olmayan kullanıcı: mail "yok", diğer kanallar etkilenmez', async () => {
    userFindFirst.mockResolvedValue({ email: null, name: 'Y', personnel: null })
    expect(await fifKullaniciyaBildir('u1', 'k', 'g', '/l')).toEqual({ inApp: true, push: 1, mail: 'yok' })
  })

  it('mail HATASI in-app ve push\'u engellemez (başarısız gönderim + fırlatan gönderim)', async () => {
    sendEmail.mockResolvedValue({ success: false, error: 'SMTP' })
    expect(await fifKullaniciyaBildir('u1', 'k', 'g', '/l')).toEqual({ inApp: true, push: 1, mail: 'hata' })
    sendEmail.mockRejectedValue(new Error('baglanti'))
    expect(await fifKullaniciyaBildir('u1', 'k', 'g', '/l')).toEqual({ inApp: true, push: 1, mail: 'hata' })
  })

  it('in-app ve push HATASI mail\'i engellemez', async () => {
    notificationCreate.mockRejectedValue(new Error('db'))
    sendPushToUser.mockRejectedValue(new Error('push'))
    expect(await fifKullaniciyaBildir('u1', 'k', 'g', '/l')).toEqual({ inApp: false, push: 0, mail: 'gitti' })
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it('push aboneliği yoksa push atlanır (0), mail + in-app gider', async () => {
    pushCount.mockResolvedValue(0)
    expect(await fifKullaniciyaBildir('u1', 'k', 'g', '/l')).toEqual({ inApp: true, push: 0, mail: 'gitti' })
    expect(sendPushToUser).not.toHaveBeenCalled()
  })
})

describe('fifDurumBildir — Paket 4 alıcıları', () => {
  const fif = {
    id: 'fif1', kayitNo: 'FIF-2026-007', durum: 'KSS_KAYIT_BEKLIYOR' as const, sorumluBolumId: 'd1',
    hazirlayanUserId: 'uAcan', createdById: 'uAcan', yayinlayanOnaylayanUserId: 'uYayin',
    sorumluOnaylayanUserId: 'uMudur', izlemeSorumlusuUserId: null, uygunsuzlukTanimi: 'Tespit metni',
  }
  const alicilar = () => notificationCreate.mock.calls.map((c) => c[0].data.userId)
  beforeEach(() => {
    userFindFirst.mockImplementation(async ({ where }: { where: { id: string } }) => ({ id: where.id, email: null, name: where.id, personnel: null }))
  })

  it('SORUMLU_ATAMA_BEKLIYOR → sorumlu bölüm müdürüne (snapshot) "Sorumlu bölüm onayınız bekleniyor"', async () => {
    const r = await fifDurumBildir(fif, 'SORUMLU_ATAMA_BEKLIYOR')
    expect(alicilar()).toEqual(['uMudur'])
    expect(notificationCreate.mock.calls[0][0].data.title).toBe('[FİF FIF-2026-007] Sorumlu bölüm onayınız bekleniyor')
    expect(notificationCreate.mock.calls[0][0].data.link).toBe('/kalite/fif/fif1')
    expect(r.hedefSayisi).toBe(1)
  })
  it('Sorumlu Bölüm Onayı (SORUMLU_ATAMA → FAALIYET) → YALNIZ seçilen izleme sorumlusuna', async () => {
    await fifDurumBildir(
      { ...fif, durum: 'SORUMLU_ATAMA_BEKLIYOR', izlemeSorumlusuUserId: 'uIzleme', faaliyetSorumluIdleri: ['uS1'] },
      'FAALIYET',
    )
    expect(alicilar()).toEqual(['uIzleme'])
    expect(notificationCreate.mock.calls[0][0].data.title).toContain('Faaliyet izleme sorumlusu olarak atandınız')
  })
})

describe('fifFaaliyetAtamaBildir — Paket 4: uygulama sorumlusu ataması', () => {
  beforeEach(() => {
    userFindFirst.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === 'uPasif' ? null : ({ id: where.id, email: null, name: where.id, personnel: null }))
  })
  it('kişi başına TEK bildirim, satırlar listelenir; pasif kullanıcı atlanır', async () => {
    const n = await fifFaaliyetAtamaBildir({ id: 'fif1', kayitNo: 'FIF-2026-007' }, [
      { sira: 1, aciklama: 'Kalibrasyon', hedefTarih: new Date('2026-11-01T00:00:00Z'), sorumluUserId: 'uA' },
      { sira: 3, aciklama: 'Eğitim', hedefTarih: null, sorumluUserId: 'uA' },
      { sira: 2, aciklama: 'Talimat', hedefTarih: null, sorumluUserId: 'uPasif' },
    ])
    expect(n).toBe(1)
    expect(notificationCreate).toHaveBeenCalledTimes(1)
    const d = notificationCreate.mock.calls[0][0].data
    expect(d.userId).toBe('uA')
    expect(d.title).toBe('[FİF FIF-2026-007] Size faaliyet atandı')
    expect(d.message).toContain('#1 Kalibrasyon')
    expect(d.message).toContain('#3 Eğitim (hedef: hedef tarih girilmedi)')
  })
})

describe('fifIzlemeSorumlusuBildir — Paket 4: izleme sorumlusu değişince', () => {
  it('yeni kişiye tek bildirim; pasif kullanıcıya gitmez', async () => {
    userFindFirst.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === 'uPasif' ? null : ({ id: where.id, email: null, name: where.id, personnel: null }))
    expect(await fifIzlemeSorumlusuBildir({ id: 'fif1', kayitNo: 'FIF-2026-007' }, 'uYeni')).toBe(true)
    expect(notificationCreate).toHaveBeenCalledTimes(1)
    expect(notificationCreate.mock.calls[0][0].data).toMatchObject({
      userId: 'uYeni', title: '[FİF FIF-2026-007] Faaliyet izleme sorumlusu olarak atandınız', link: '/kalite/fif/fif1',
    })
    expect(await fifIzlemeSorumlusuBildir({ id: 'fif1', kayitNo: 'FIF-2026-007' }, 'uPasif')).toBe(false)
    expect(notificationCreate).toHaveBeenCalledTimes(1)
  })
})

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
import { fifKullaniciyaBildir } from './fif-bildirim'

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

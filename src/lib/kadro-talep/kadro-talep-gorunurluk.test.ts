import { describe, it, expect } from 'vitest'
import { kadroTalepGorunurluk, kadroTalepGorebilirMi } from './kadro-talep-gorunurluk'

// Kadro talep erişim daraltma (19.09.2026): yetkisiz kişi kendi kaydını bile görmez.
const oturum = (perms: string[]) => ({ user: { email: 'a@x', department: 'D', permissions: perms } })
const sp = new URLSearchParams()

describe('kadroTalepGorunurluk — ön kapı', () => {
  it('erişim yok → hiçbir kayıt (imkânsız id), gorebilirMi false (sahibi olsa da)', () => {
    const k = kadroTalepGorunurluk(oturum([]), sp, { erisebilir: false })
    expect(k.erisebilir).toBe(false)
    expect(k.where).toEqual({ id: '__erisim_yok__' })
    expect(kadroTalepGorebilirMi(k, { requesterEmail: 'a@x', department: 'D' })).toBe(false)
  })
  it('koltuk / kadro.talep.ac (izinsiz ama erişebilir) → yalnız kendi açtıkları', () => {
    const k = kadroTalepGorunurluk(oturum([]), sp, { erisebilir: true })
    expect(k.where).toEqual({ requesterEmail: 'a@x' })
    expect(kadroTalepGorebilirMi(k, { requesterEmail: 'a@x', department: 'D' })).toBe(true)
    expect(kadroTalepGorebilirMi(k, { requesterEmail: 'b@x', department: 'D' })).toBe(false)
  })
  it('recruitment.view → kendi departmanı + kendi açtıkları', () => {
    const k = kadroTalepGorunurluk(oturum(['recruitment.view']), sp, { erisebilir: true })
    expect(k.where).toEqual({ OR: [{ department: 'D' }, { requesterEmail: 'a@x' }] })
    expect(kadroTalepGorebilirMi(k, { requesterEmail: 'b@x', department: 'D' })).toBe(true)
  })
  it('recruitment.admin → filtre yok', () => {
    const k = kadroTalepGorunurluk(oturum(['recruitment.admin']), sp, { erisebilir: true })
    expect(k.where).toEqual({})
  })
})

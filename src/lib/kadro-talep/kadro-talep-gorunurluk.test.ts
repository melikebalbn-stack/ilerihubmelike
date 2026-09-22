import { describe, it, expect } from 'vitest'
import { kadroTalepGorunurluk, kadroTalepGorebilirMi } from './kadro-talep-gorunurluk'

// Kadro talep görünürlüğü (21.09.2026 — koltuk kapsamı): LDAP department metni YOK;
// kapsam = koltuk bölümlerinin personeli (requesterIdler) ∪ kendi ∪ atanmış onaycı.
const oturum = (perms: string[]) => ({ user: { id: 'u1', email: 'a@x', permissions: perms } })
const sp = new URLSearchParams()

describe('kadroTalepGorunurluk', () => {
  it('erişim yok → hiçbir kayıt (imkânsız id), gorebilirMi false (sahibi bile)', () => {
    const k = kadroTalepGorunurluk(oturum([]), sp, { erisebilir: false, requesterIdler: [] })
    expect(k.where).toEqual({ id: '__erisim_yok__' })
    expect(kadroTalepGorebilirMi(k, { requesterEmail: 'a@x', requesterId: 'u1' })).toBe(false)
  })
  it('koltuk kapsamı → requesterId IN ∪ kendi ∪ onaycı', () => {
    const k = kadroTalepGorunurluk(oturum(['recruitment.view']), sp, { erisebilir: true, requesterIdler: ['p1', 'p2'] })
    expect(k.where).toEqual({ silindiMi: false, OR: [{ requesterId: { in: ['p1', 'p2'] } }, { requesterEmail: 'a@x' }, { approvals: { some: { approverId: 'u1' } } }] })
    expect(kadroTalepGorebilirMi(k, { requesterEmail: 'b@x', requesterId: 'p2' })).toBe(true)
    expect(kadroTalepGorebilirMi(k, { requesterEmail: 'b@x', requesterId: 'p9' })).toBe(false)
  })
  it('kapsam boş (koltuksuz / kadro.talep.ac) → yalnız kendi + onaycı', () => {
    const k = kadroTalepGorunurluk(oturum([]), sp, { erisebilir: true, requesterIdler: [] })
    expect(k.where).toEqual({ silindiMi: false, OR: [{ requesterEmail: 'a@x' }, { approvals: { some: { approverId: 'u1' } } }] })
  })
  it('atanmış onaycı → kapsam dışı talebi de görür (Orkun senaryosu)', () => {
    const k = kadroTalepGorunurluk(oturum(['recruitment.view']), sp, { erisebilir: true, requesterIdler: ['p1'] })
    expect(kadroTalepGorebilirMi(k, { requesterEmail: 'm@x', requesterId: 'p9', approvals: [{ approverId: 'u1' }, { approverId: 'gm' }] })).toBe(true)
  })
  it('recruitment.admin → filtre yok, her kaydı görür', () => {
    const k = kadroTalepGorunurluk(oturum(['recruitment.admin']), sp, { erisebilir: true, requesterIdler: [] })
    expect(k.where).toEqual({ silindiMi: false })
    expect(kadroTalepGorebilirMi(k, { requesterEmail: 'z@x', requesterId: 'p9' })).toBe(true)
  })
  it('LDAP department metni artık KULLANILMAZ (where içinde department yok)', () => {
    const k = kadroTalepGorunurluk({ user: { id: 'u1', email: 'a@x', permissions: ['recruitment.view'] } }, sp, { erisebilir: true, requesterIdler: ['p1'] })
    expect(JSON.stringify(k.where)).not.toContain('"department"')
  })
})

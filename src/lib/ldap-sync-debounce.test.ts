import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'

// ── Mock'lar (sync'in çektiği LDAP + email katmanları) ──
const mockUsers: { value: unknown[] } = { value: [] }
vi.mock('./ldap', () => ({
  getAllLDAPUsers: vi.fn(async () => mockUsers.value),
  determineUserRole: vi.fn(() => 'EMPLOYEE'),
  getEmailFromDN: vi.fn(async () => null),
}))
vi.mock('./email', () => ({
  sendEmail: vi.fn(async () => ({ success: true })),
}))

import { prisma } from './prisma'
import { syncLDAPUsersToDb, computeActivityFields } from './ldap-sync'
import { sendEmail } from './email'
import { getAllLDAPUsers } from './ldap'

function mkLdapUser(username: string, disabled: boolean) {
  return {
    username,
    displayName: username,
    email: `${username}@ilerigroup.com`,
    department: 'Test',
    title: 'Tester',
    distinguishedName: `CN=${username},OU=Test,DC=ilerigroup,DC=com`,
    memberOf: [],
    ou: 'Test',
    managerDN: null,
    ipPhone: null,
    disabled,
  }
}

const PFX = 'debounce_test_'
const cleanup = () => prisma.user.deleteMany({ where: { id: { startsWith: `ad_${PFX}` } } })

// ── (1) BİRİM: debounce karar mantığı (saf fonksiyon) ──
describe('computeActivityFields (debounce N=3)', () => {
  it('disabled=false → streak 0, isActive true, aday değil', () => {
    expect(computeActivityFields(false, 2, true)).toEqual({
      fields: { disabledStreak: 0, isActive: true },
      candidate: false,
    })
  })
  it('disabled=true tur1/tur2 → streak artar, isActive YAZILMAZ, aday değil', () => {
    const t1 = computeActivityFields(true, 0, true)
    expect(t1.fields.disabledStreak).toBe(1)
    expect(t1.fields.isActive).toBeUndefined() // isActive'e dokunulmaz
    expect(t1.candidate).toBe(false)
    const t2 = computeActivityFields(true, 1, true)
    expect(t2.fields.disabledStreak).toBe(2)
    expect(t2.candidate).toBe(false)
  })
  it('disabled=true tur3 (eşik) + hâlâ aktif → ADAY, isActive yine yazılmaz', () => {
    const t3 = computeActivityFields(true, 2, true)
    expect(t3.fields.disabledStreak).toBe(3)
    expect(t3.fields.isActive).toBeUndefined()
    expect(t3.candidate).toBe(true)
  })
  it('zaten pasif (prevActive=false) eşikte → aday DEĞİL (tekrar geçiş yok)', () => {
    expect(computeActivityFields(true, 5, false).candidate).toBe(false)
  })
})

// ── (2) ENTEGRASYON: gerçek dev DB + mock LDAP ──
describe('syncLDAPUsersToDb debounce/güvenlik ağı (dev DB)', () => {
  beforeEach(async () => {
    await cleanup()
    vi.clearAllMocks()
  })
  afterAll(async () => {
    await cleanup()
    await prisma.$disconnect()
  })

  it('DEBOUNCE: 3 ardışık disabled turda pasifleşir; arada disabled=false reset', async () => {
    const u = `${PFX}flap`
    mockUsers.value = [mkLdapUser(u, true)]

    await syncLDAPUsersToDb()
    let row = await prisma.user.findUnique({ where: { id: `ad_${u}` } })
    expect(row?.disabledStreak).toBe(1)
    expect(row?.isActive).toBe(true) // 1. turda pasifleşmez

    await syncLDAPUsersToDb()
    row = await prisma.user.findUnique({ where: { id: `ad_${u}` } })
    expect(row?.disabledStreak).toBe(2)
    expect(row?.isActive).toBe(true) // 2. turda da değil

    await syncLDAPUsersToDb()
    row = await prisma.user.findUnique({ where: { id: `ad_${u}` } })
    expect(row?.disabledStreak).toBe(3)
    expect(row?.isActive).toBe(false) // 3. turda pasif

    mockUsers.value = [mkLdapUser(u, false)] // AD'de tekrar aktif
    await syncLDAPUsersToDb()
    row = await prisma.user.findUnique({ where: { id: `ad_${u}` } })
    expect(row?.disabledStreak).toBe(0)
    expect(row?.isActive).toBe(true) // reset + aktif
  })

  it('GÜVENLİK AĞI: >5 aday → tümü ABORT, isActive korunur, alarm maili çağrılır', async () => {
    const ids: string[] = []
    for (let i = 0; i < 6; i++) {
      const u = `${PFX}bulk${i}`
      ids.push(`ad_${u}`)
      await prisma.user.create({
        data: { id: `ad_${u}`, email: `${u}@ilerigroup.com`, isActive: true, disabledStreak: 2 },
      })
    }
    mockUsers.value = ids.map((_, i) => mkLdapUser(`${PFX}bulk${i}`, true)) // 6 → her biri 3'e ulaşır

    await syncLDAPUsersToDb()

    const rows = await prisma.user.findMany({ where: { id: { in: ids } } })
    expect(rows.length).toBe(6)
    expect(rows.every((r) => r.isActive === true)).toBe(true) // ABORT → hiçbiri pasifleşmedi
    expect(rows.every((r) => r.disabledStreak === 3)).toBe(true) // streak yine yazıldı
    expect(sendEmail).toHaveBeenCalled() // güvenlik ağı alarmı
  })

  it('TEK-UÇUŞ: eşzamanlı iki sync → işi yalnız biri çalıştırır (in-memory guard)', async () => {
    const u = `${PFX}concurrent`
    mockUsers.value = [mkLdapUser(u, false)]

    await Promise.all([syncLDAPUsersToDb(), syncLDAPUsersToDb()])

    // İkinci çağrı guard'a takılıp işi çalıştırmaz → getAllLDAPUsers tam 1 kez çağrılır.
    expect(getAllLDAPUsers).toHaveBeenCalledTimes(1)
    const row = await prisma.user.findUnique({ where: { id: `ad_${u}` } })
    expect(row).not.toBeNull()
  })

  it('REGRESYON: normal kullanıcı aktif+streak0; tek-tük leaver (eşik) pasifleşir', async () => {
    const ok = `${PFX}normal`
    const leaver = `${PFX}leaver`
    await prisma.user.create({
      data: { id: `ad_${leaver}`, email: `${leaver}@ilerigroup.com`, isActive: true, disabledStreak: 2 },
    })
    mockUsers.value = [mkLdapUser(ok, false), mkLdapUser(leaver, true)] // 1 aday → <5 → pasifleşir

    await syncLDAPUsersToDb()

    const okRow = await prisma.user.findUnique({ where: { id: `ad_${ok}` } })
    expect(okRow?.isActive).toBe(true)
    expect(okRow?.disabledStreak).toBe(0)
    const leaverRow = await prisma.user.findUnique({ where: { id: `ad_${leaver}` } })
    expect(leaverRow?.isActive).toBe(false) // gerçek ayrılan doğru pasifleşir
    expect(leaverRow?.disabledStreak).toBe(3)
    expect(sendEmail).not.toHaveBeenCalled() // güvenlik ağı tetiklenmedi
  })
})

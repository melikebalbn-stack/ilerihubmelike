// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * İzin Faz 3 — talep / onay AKIŞI, servis düzeyinde (bellek içi sahte Prisma). Sabitlenen kurallar:
 *  - önizleme = İV onayı sonucu (günler + gün sayısı + KULLANIM aynı fonksiyondan, donmuş)
 *  - "adına" talep: yöneticinin açtığı doğrudan İV'ye (yönetici kademesi ONAY izi); İV'nin açtığı normal akış
 *  - kendi talebini onaylama YOK (yönetici ve İV)
 *  - red gerekçesi zorunlu
 *  - onaylı iznin iptali IPTAL_IADE; bekleyen geri çekme deftere dokunmaz; talep silinmez
 *  - geçiş tarihi yoksa yıllık izin AÇILMAZ, diğer türler açılır
 *  - yönetici kalemi / mailinde TÜR YOK
 */

type Row = Record<string, unknown>
const db = vi.hoisted(() => ({
  t: {} as Record<string, Row[]>,
  seq: 0,
  mailler: [] as { fn: string; args: unknown[] }[],
  pdks: [] as { personnelId: string; bas: string; bit: string }[],
}))

vi.mock('@/lib/prisma', () => {
  const tarihMi = (x: unknown): x is Date => x instanceof Date
  const esit = (a: unknown, b: unknown) => (tarihMi(a) && tarihMi(b) ? a.getTime() === b.getTime() : a === b)
  const kiyas = (a: unknown, b: unknown) => (tarihMi(a) ? a.getTime() : (a as number)) - (tarihMi(b) ? b.getTime() : (b as number))
  const OPS = ['in', 'not', 'gt', 'gte', 'lt', 'lte', 'contains', 'some']
  const uyar = (row: Row, where: Row | undefined): boolean => {
    if (!where) return true
    return Object.entries(where).every(([k, v]) => {
      if (k === 'OR') return (v as Row[]).some((w) => uyar(row, w))
      if (k === 'AND') return (v as Row[]).every((w) => uyar(row, w))
      const x = row[k]
      if (v && typeof v === 'object' && !tarihMi(v) && !Array.isArray(v)) {
        const o = v as Row
        if (Object.keys(o).some((kk) => OPS.includes(kk))) {
          if ('in' in o && !(o.in as unknown[]).some((y) => esit(x, y))) return false
          if ('not' in o && (o.not === null ? x === null || x === undefined : esit(x, o.not))) return false
          if ('gt' in o && !(x !== null && x !== undefined && kiyas(x, o.gt) > 0)) return false
          if ('gte' in o && !(x !== null && x !== undefined && kiyas(x, o.gte) >= 0)) return false
          if ('lt' in o && !(x !== null && x !== undefined && kiyas(x, o.lt) < 0)) return false
          if ('lte' in o && !(x !== null && x !== undefined && kiyas(x, o.lte) <= 0)) return false
          if ('some' in o && !((x as Row[]) ?? []).some((y) => uyar(y, o.some as Row))) return false
          return true
        }
        return x && typeof x === 'object' ? uyar(x as Row, o) : false
      }
      return esit(x ?? null, v ?? null)
    })
  }
  const zengin: Record<string, (r: Row) => Row> = {
    izinTalep: (r) => ({
      ...r,
      tur: db.t.izinTuru.find((x) => x.id === r.turId),
      personnel: (() => {
        const p = db.t.personnel.find((x) => x.id === r.personnelId)!
        return { ...p, department: null, user: db.t.user.find((u) => u.personnelId === p.id) ?? null }
      })(),
      onaylar: db.t.izinOnay.filter((o) => o.talepId === r.id).sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime()),
    }),
    izinOnay: (r) => ({ ...r, talep: zengin.izinTalep(db.t.izinTalep.find((t) => t.id === r.talepId)!) }),
    personnel: (r) => ({
      ...r, department: null, user: db.t.user.find((u) => u.personnelId === r.id) ?? null,
      employmentPeriods: [], izinBakiyeHareketleri: db.t.izinBakiyeHareketi.filter((h) => h.personnelId === r.id),
    }),
  }
  const oku = (m: string, r: Row) => (zengin[m] ? zengin[m](r) : r)
  const model = (m: string) => ({
    findUnique: async ({ where }: { where: Row }) => { const r = (db.t[m] ?? []).find((x) => uyar(x, where)); return r ? oku(m, r) : null },
    findUniqueOrThrow: async ({ where }: { where: Row }) => { const r = (db.t[m] ?? []).find((x) => uyar(x, where)); if (!r) throw new Error(`${m} yok`); return oku(m, r) },
    findFirst: async ({ where }: { where?: Row } = {}) => { const r = (db.t[m] ?? []).find((x) => uyar(x, where)); return r ? oku(m, r) : null },
    findMany: async ({ where }: { where?: Row } = {}) => (db.t[m] ?? []).filter((x) => uyar(x, where)).map((r) => oku(m, r)),
    count: async ({ where }: { where?: Row } = {}) => (db.t[m] ?? []).filter((x) => uyar(x, where)).length,
    create: async ({ data }: { data: Row }) => { const r = { id: `${m}-${++db.seq}`, createdAt: new Date(Date.now() + db.seq), ...data }; (db.t[m] ??= []).push(r); return r },
    createMany: async ({ data }: { data: Row[] }) => { for (const d of data) (db.t[m] ??= []).push({ id: `${m}-${++db.seq}`, createdAt: new Date(), ...d }); return { count: data.length } },
    updateMany: async ({ where, data }: { where: Row; data: Row }) => { const rs = (db.t[m] ?? []).filter((x) => uyar(x, where)); rs.forEach((r) => Object.assign(r, data)); return { count: rs.length } },
    // Defter ve talep için DELETE YOK (trigger / kural) — sahte istemcide de tanımlanmaz.
  })
  const prisma: Record<string, unknown> = {}
  for (const m of ['user', 'personnel', 'personnelSensitive', 'izinTuru', 'izinTalep', 'izinOnay', 'izinTalepGun', 'izinBakiyeHareketi', 'systemSetting', 'iproTatil']) prisma[m] = model(m)
  prisma.$transaction = async (fn: (tx: unknown) => unknown) => fn(prisma)
  return { prisma }
})
vi.mock('@/lib/audit-log', () => ({ logAuditEvent: async () => ({ ok: true }), SISTEM_AKTOR_ID: 'sistem' }))
vi.mock('@/lib/pdks/puantaj-servis', () => ({ bugunStr: () => '2026-10-01', gunuHesapla: async () => ({ yazilan: 0, kilitliAtlanan: 0 }) }))
vi.mock('@/lib/auth/get-user-permissions', () => ({ getUserPermissions: async () => new Set() }))
vi.mock('@/lib/onay/muafiyet', () => ({ selfEntryOnaydanMuafMi: async () => false }))
vi.mock('@/lib/onay/yonetici-cozumu', () => ({
  // çalışan p-c'nin yöneticisi u-m (p-m); p-m'nin yöneticisi yok (sahipsiz)
  resolveApprovers: async (pid: string) => (pid === 'p-c' || pid === 'p-d' ? { approverId: 'u-m', approverId2: null, approverId3: null } : { approverId: null, approverId2: null, approverId3: null }),
  getManagedPersonnelIds: async (pid: string) => (pid === 'p-m' ? ['p-c', 'p-d'] : []),
}))
vi.mock('./mail', () => {
  const kaydet = (fn: string) => async (...args: unknown[]) => { db.mailler.push({ fn, args }) }
  return { yoneticiyeTalep: kaydet('yoneticiyeTalep'), iveTalep: kaydet('iveTalep'), calisanaSonuc: kaydet('calisanaSonuc'), yoneticiyeBilgi: kaydet('yoneticiyeBilgi'), iptalBildir: kaydet('iptalBildir') }
})
vi.mock('./talep-ortak', async (orj) => {
  const gercek = await orj<typeof import('./talep-ortak')>()
  return {
    ...gercek,
    puantajYenidenHesapla: async (personnelId: string, bas: string, bit: string) => { db.pdks.push({ personnelId, bas, bit }); return { hesaplanan: 0, kilitli: [] } },
  }
})

import { geriCek, ivIptal, onizlemeHesapla, talepOlustur } from './talep-servis'
import { kararVer, onayListesi } from './onay-servis'
import { turSiziyorMu } from './gorunum'
import type { Baglam } from './talep-ortak'

const tur = (kod: string, o: Row = {}) => ({
  id: `t-${kod}`, kod, ad: kod === 'YILLIK' ? 'Yıllık izin' : kod === 'EVLILIK' ? 'Evlilik izni' : kod, yasal: true, bakiyeli: kod === 'YILLIK', sabitGun: null,
  gunSayimi: 'IS_GUNU', ucretli: true, yarimGunOlur: kod === 'YILLIK', onayAkisi: 'YONETICI_IV', belgeZorunlu: false, ozelNitelikli: false,
  pdksEtiketi: 'İzinli', kosul: null, aktif: true, sira: 0, ...o,
})
const ctx = (userId: string, personnelId: string | null, ivMi = false): Baglam => ({ userId, personnelId, ivMi, bakiyeAdmin: false })
const CALISAN = ctx('u-c', 'p-c')
const YONETICI = ctx('u-m', 'p-m')
const IV = ctx('u-iv', 'p-iv', true)
const d = (s: string) => new Date(`${s}T00:00:00Z`)

beforeEach(() => {
  db.seq = 0
  db.mailler = []
  db.pdks = []
  db.t = {
    user: [{ id: 'u-c', personnelId: 'p-c' }, { id: 'u-m', personnelId: 'p-m' }, { id: 'u-iv', personnelId: 'p-iv' }],
    personnel: ['p-c', 'p-d', 'p-m', 'p-iv'].map((id) => ({
      id, adSoyad: id.toUpperCase(), sicilNo: id, aktif: true, departmentId: 'dep', iseGirisTarihi: d('2020-01-01'), bolum: 'Kaynak',
    })),
    personnelSensitive: [],
    izinTuru: [tur('YILLIK'), tur('EVLILIK', { sabitGun: 3 }), tur('RAPOR', { ozelNitelikli: true, belgeZorunlu: true, onayAkisi: 'YALNIZ_IV' })],
    izinTalep: [], izinOnay: [], izinTalepGun: [],
    izinBakiyeHareketi: [{ id: 'h0', personnelId: 'p-c', turId: 't-YILLIK', hareket: 'ACILIS', gun: 12, tarih: d('2026-09-20') }],
    systemSetting: [{ key: 'izin_gecis_tarihi', value: '2026-09-20' }],
    // 28 Ekim 2026 yarım gün (arefe), 29 Ekim tatil — plan §3.2 senaryosu
    iproTatil: [{ tarih: d('2026-10-28'), tip: 'YARIM', aciklama: 'Cumhuriyet Bayramı arefesi' }, { tarih: d('2026-10-29'), tip: 'TATIL', aciklama: 'Cumhuriyet Bayramı' }],
  }
})

const YILLIK_26_30 = { turId: 't-YILLIK', baslangic: '2026-10-26', bitis: '2026-10-30' }

describe('önizleme = onay sonucu', () => {
  it('26–30 Ekim: önizleme 3,5 gün + notlar; İV onayında aynı günler donar, KULLANIM −3,5, puantaj tetiklenir', async () => {
    const on = await onizlemeHesapla(CALISAN, YILLIK_26_30)
    expect(on.hesap.toplam).toBe(3.5)
    expect(on.hesap.notlar).toEqual(['28 Ekim Cumhuriyet Bayramı arefesi · yarım gün', '29 Ekim Cumhuriyet Bayramı · düşülmedi'])
    expect(on.bakiye).toMatchObject({ kalan: 12, sonrasi: 8.5, yeterli: true })

    const { id, durum } = await talepOlustur(CALISAN, YILLIK_26_30)
    expect(durum).toBe('BEKLIYOR_YONETICI')
    // rezerv: ikinci önizlemede kalan 12 − 3,5
    expect((await onizlemeHesapla(CALISAN, { turId: 't-YILLIK', baslangic: '2026-11-02', bitis: '2026-11-02' })).bakiye).toMatchObject({ kalan: 8.5, sonrasi: 7.5 })

    await kararVer(YONETICI, id, { karar: 'ONAY' })
    const r = await kararVer(IV, id, { karar: 'ONAY' })
    expect(r.durum).toBe('ONAYLANDI')
    const gunler = db.t.izinTalepGun.filter((g) => g.talepId === id).map((g) => [(g.tarih as Date).toISOString().slice(0, 10), g.pay, g.yarim])
    expect(gunler).toEqual(on.hesap.gunler.map((g) => [g.tarih, g.pay, g.yarim]))
    expect(db.t.izinTalep.find((t) => t.id === id)!.gunSayisi).toBe(on.hesap.toplam)
    expect(db.t.izinBakiyeHareketi.filter((h) => h.talepId === id)).toMatchObject([{ hareket: 'KULLANIM', gun: -3.5, anahtar: `KULLANIM:${id}` }])
    expect(db.pdks).toEqual([{ personnelId: 'p-c', bas: '2026-10-26', bit: '2026-10-30' }])
  })

  it('yetersiz bakiyede talep açılmaz', async () => {
    await expect(talepOlustur(CALISAN, { turId: 't-YILLIK', baslangic: '2026-11-02', bitis: '2026-11-20' })).rejects.toThrow(/Yetersiz bakiye/)
  })
})

describe('geçiş tarihi (açılış aktarımı) yok kapısı', () => {
  it('yıllık izin AÇILMAZ; evlilik izni açılır', async () => {
    db.t.systemSetting = []
    await expect(talepOlustur(CALISAN, YILLIK_26_30)).rejects.toThrow('İzin bakiyeleri henüz yüklenmedi')
    await expect(talepOlustur(CALISAN, { turId: 't-EVLILIK', baslangic: '2026-11-02', bitis: '2026-11-04' })).resolves.toMatchObject({ durum: 'BEKLIYOR_YONETICI' })
  })
  it('RAPOR bu fazda formdan açılamaz', async () => {
    await expect(talepOlustur(CALISAN, { turId: 't-RAPOR', baslangic: '2026-11-02', bitis: '2026-11-02' })).rejects.toThrow(/talep edilemez/)
  })
})

describe('adına talep', () => {
  it('yöneticinin ekibi adına açtığı talep doğrudan İV\'ye gider; yönetici kademesi ONAY izi kalır', async () => {
    const { id, durum } = await talepOlustur(YONETICI, { turId: 't-EVLILIK', baslangic: '2026-11-02', bitis: '2026-11-04', personnelId: 'p-d' })
    expect(durum).toBe('BEKLIYOR_IV')
    expect(db.t.izinTalep.find((t) => t.id === id)).toMatchObject({ personnelId: 'p-d', talepEdenId: 'u-m' })
    expect(db.t.izinOnay.filter((o) => o.talepId === id)).toMatchObject([{ kademe: 'YONETICI', karar: 'ONAY', onaylayanId: 'u-m' }])
    expect(db.mailler.map((m) => m.fn)).toEqual(['iveTalep'])
  })
  it('İV\'nin açtığı talep normal akış (önce yönetici)', async () => {
    const { durum } = await talepOlustur(IV, { turId: 't-EVLILIK', baslangic: '2026-11-02', bitis: '2026-11-04', personnelId: 'p-c' })
    expect(durum).toBe('BEKLIYOR_YONETICI')
  })
  it('yetkisiz kişi başkası adına açamaz; yöneticisi çözülemeyen kişinin talebi sahipsiz → İV', async () => {
    await expect(talepOlustur(CALISAN, { turId: 't-EVLILIK', baslangic: '2026-11-02', bitis: '2026-11-04', personnelId: 'p-d' })).rejects.toThrow(/yetkiniz yok/)
    const { id, durum } = await talepOlustur(YONETICI, { turId: 't-EVLILIK', baslangic: '2026-11-02', bitis: '2026-11-04' })
    expect(durum).toBe('BEKLIYOR_IV')
    expect(db.t.izinOnay.filter((o) => o.talepId === id)).toMatchObject([{ karar: 'ATLANDI', onaylayanId: 'sistem' }])
  })
})

describe('onay kuralları', () => {
  it('kendi talebini onaylama YOK — İV kendi talebini İV kademesinde onaylayamaz', async () => {
    db.t.izinTalep.push({ id: 'k1', personnelId: 'p-iv', turId: 't-EVLILIK', durum: 'BEKLIYOR_IV', baslangic: d('2026-11-02'), bitis: d('2026-11-04'), baslangicYarim: null, bitisYarim: null, gunSayisi: 3, onayci1Id: null, onayci2Id: null, onayci3Id: null, talepEdenId: 'u-iv', createdAt: new Date() })
    await expect(kararVer(IV, 'k1', { karar: 'ONAY' })).rejects.toThrow('Kendi izin talebinizi onaylayamazsınız')
    expect((await onayListesi(IV, 'bekleyen')).kalemler.map((k) => k.id)).not.toContain('k1')
  })
  it('red gerekçesi zorunlu; gerekçeyle red çalışana gerekçeli mail', async () => {
    const { id } = await talepOlustur(CALISAN, { turId: 't-EVLILIK', baslangic: '2026-11-02', bitis: '2026-11-04' })
    await expect(kararVer(YONETICI, id, { karar: 'RED' })).rejects.toThrow('Red gerekçesi zorunlu')
    await expect(kararVer(YONETICI, id, { karar: 'RED', gerekce: 'yok' })).rejects.toThrow('Red gerekçesi zorunlu')
    await kararVer(YONETICI, id, { karar: 'RED', gerekce: 'Sevkiyat haftası' })
    expect(db.t.izinTalep.find((t) => t.id === id)!.durum).toBe('REDDEDILDI')
    expect(db.mailler.at(-1)).toMatchObject({ fn: 'calisanaSonuc', args: [expect.anything(), 'u-c', { karar: 'RED', kademe: 'YONETICI', gerekce: 'Sevkiyat haftası' }] })
  })
  it('onaycı olmayan yönetici kademesinde onaylayamaz; İV yönetici kademesini atlayamaz', async () => {
    const { id } = await talepOlustur(CALISAN, { turId: 't-EVLILIK', baslangic: '2026-11-02', bitis: '2026-11-04' })
    await expect(kararVer(IV, id, { karar: 'ONAY' })).rejects.toThrow('onaycısı değilsiniz')
  })
})

describe('geri çekme / iptal', () => {
  it('bekleyen talep geri çekilir (IPTAL, deftere dokunmaz); onaylı izin İV iptalinde IPTAL_IADE', async () => {
    const a = await talepOlustur(CALISAN, { turId: 't-YILLIK', baslangic: '2026-11-02', bitis: '2026-11-03' })
    await geriCek(CALISAN, a.id)
    expect(db.t.izinTalep.find((t) => t.id === a.id)!.durum).toBe('IPTAL')
    expect(db.t.izinBakiyeHareketi).toHaveLength(1) // yalnız açılış

    const b = await talepOlustur(CALISAN, YILLIK_26_30)
    await kararVer(YONETICI, b.id, { karar: 'ONAY' })
    await kararVer(IV, b.id, { karar: 'ONAY' })
    await expect(geriCek(CALISAN, b.id)).rejects.toThrow(/Yalnız onay bekleyen/)
    await expect(ivIptal(IV, b.id, { gerekce: 'kısa' })).rejects.toThrow(/gerekçesi zorunlu/)
    await ivIptal(IV, b.id, { gerekce: 'Proje ertelendi, izin iptal' })
    const h = db.t.izinBakiyeHareketi.filter((x) => x.talepId === b.id).map((x) => [x.hareket, x.gun])
    expect(h).toEqual([['KULLANIM', -3.5], ['IPTAL_IADE', 3.5]])
    expect(db.t.izinTalep.map((t) => t.id)).toEqual([a.id, b.id]) // talep SİLİNMEDİ
    expect(db.pdks.at(-1)).toEqual({ personnelId: 'p-c', bas: '2026-10-26', bit: '2026-10-30' })
  })
})

describe('tür sızıntısı — yönetici kalemi ve maili', () => {
  it('yöneticinin bekleyen/karar listesinde tür ve açıklama YOK; İV kaleminde var', async () => {
    const { id } = await talepOlustur(CALISAN, { turId: 't-EVLILIK', baslangic: '2026-11-02', bitis: '2026-11-04', aciklama: 'düğün' })
    const y = await onayListesi(YONETICI, 'bekleyen')
    expect(y.kalemler).toHaveLength(1)
    expect(turSiziyorMu(y)).toBeNull()
    expect(JSON.stringify(y)).not.toMatch(/EVLILIK|Evlilik|düğün/)
    await kararVer(YONETICI, id, { karar: 'ONAY' })
    expect(turSiziyorMu(await onayListesi(YONETICI, 'karar'))).toBeNull()
    const iv = await onayListesi(IV, 'bekleyen')
    expect(iv.kalemler[0]).toMatchObject({ kademe: 'IV', iv: { turAd: 'Evlilik izni', not: 'düğün' } })
  })
})

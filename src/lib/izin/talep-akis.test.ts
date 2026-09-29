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
  izinler: {} as Record<string, string[]>,
  dosyalar: new Map<string, Uint8Array>(),
}))

vi.mock('@/lib/prisma', () => {
  const tarihMi = (x: unknown): x is Date => x instanceof Date
  const esit = (a: unknown, b: unknown) => (tarihMi(a) && tarihMi(b) ? a.getTime() === b.getTime() : a === b)
  const kiyas = (a: unknown, b: unknown) => (tarihMi(a) ? a.getTime() : (a as number)) - (tarihMi(b) ? b.getTime() : (b as number))
  const OPS = ['in', 'not', 'gt', 'gte', 'lt', 'lte', 'contains', 'some', 'has']
  const uyar = (row: Row, where: Row | undefined): boolean => {
    if (!where) return true
    return Object.entries(where).every(([k, v]) => {
      if (k === 'OR') return (v as Row[]).some((w) => uyar(row, w))
      if (k === 'AND') return (v as Row[]).every((w) => uyar(row, w))
      if (k === 'NOT') return !uyar(row, v as Row)
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
          if ('has' in o && !((x as unknown[]) ?? []).includes(o.has)) return false
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
      belgeler: (db.t.izinBelge ?? []).filter((b) => b.talepId === r.id),
      gunler: (db.t.izinTalepGun ?? []).filter((g) => g.talepId === r.id),
      erkenDonus: (db.t.izinErkenDonus ?? []).find((e) => e.talepId === r.id) ?? null,
      hatirlatmalar: (db.t.izinHatirlatma ?? []).filter((h) => h.talepId === r.id),
      _count: { belgeler: (db.t.izinBelge ?? []).filter((b) => b.talepId === r.id).length },
    }),
    izinTalepGun: (r) => ({ ...r, talep: zengin.izinTalep(db.t.izinTalep.find((t) => t.id === r.talepId)!) }),
    izinBelge: (r) => ({ ...r, talep: zengin.izinTalep(db.t.izinTalep.find((t) => t.id === r.talepId)!) }),
    izinErkenDonus: (r) => ({
      ...r, personnel: db.t.personnel.find((p) => p.id === r.personnelId), talep: zengin.izinTalep(db.t.izinTalep.find((t) => t.id === r.talepId)!),
      hatirlatmalar: (db.t.izinHatirlatma ?? []).filter((h) => h.erkenDonusId === r.id),
    }),
    pdksPuantajGun: (r) => ({ ...r, izinTalep: r.izinTalepId ? zengin.izinTalep(db.t.izinTalep.find((t) => t.id === r.izinTalepId)!) : null }),
    izinOnay: (r) => ({ ...r, talep: zengin.izinTalep(db.t.izinTalep.find((t) => t.id === r.talepId)!) }),
    personnel: (r) => ({
      ...r, department: null, user: db.t.user.find((u) => u.personnelId === r.id) ?? null,
      employmentPeriods: [], izinBakiyeHareketleri: db.t.izinBakiyeHareketi.filter((h) => h.personnelId === r.id),
    }),
  }
  const oku = (m: string, r: Row) => (zengin[m] ? zengin[m](r) : r)
  // Eşleşme ZENGİN satır üzerinde (ilişki filtreleri: talep: {durum}, NOT: {tur: {kod}}); dönüş de zengin.
  const es = (m: string, x: Row, w?: Row) => uyar(oku(m, x), w)
  const model = (m: string) => ({
    findUnique: async ({ where }: { where: Row }) => { const r = (db.t[m] ?? []).find((x) => es(m, x, where)); return r ? oku(m, r) : null },
    findUniqueOrThrow: async ({ where }: { where: Row }) => { const r = (db.t[m] ?? []).find((x) => es(m, x, where)); if (!r) throw new Error(`${m} yok`); return oku(m, r) },
    findFirst: async ({ where }: { where?: Row } = {}) => { const r = (db.t[m] ?? []).find((x) => es(m, x, where)); return r ? oku(m, r) : null },
    findMany: async ({ where }: { where?: Row } = {}) => (db.t[m] ?? []).filter((x) => es(m, x, where)).map((r) => oku(m, r)),
    count: async ({ where }: { where?: Row } = {}) => (db.t[m] ?? []).filter((x) => es(m, x, where)).length,
    create: async ({ data }: { data: Row }) => {
      // izin_hatirlatma.anahtar UNIQUE (Faz 6) — gerçek DB gibi P2002
      if (m === 'izinHatirlatma' && (db.t[m] ?? []).some((x) => x.anahtar === data.anahtar)) throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
      const r = { id: `${m}-${++db.seq}`, createdAt: new Date(Date.now() + db.seq), ...data }; (db.t[m] ??= []).push(r); return r
    },
    update: async ({ where, data }: { where: Row; data: Row }) => { const r = (db.t[m] ?? []).find((x) => es(m, x, where)); if (!r) throw new Error(`${m} yok`); Object.assign(r, data); return r },
    createMany: async ({ data, skipDuplicates }: { data: Row[]; skipDuplicates?: boolean }) => {
      let n = 0
      for (const d of data) {
        if (skipDuplicates && m === 'izinErkenDonus' && (db.t[m] ?? []).some((x) => x.talepId === d.talepId)) continue
        ;(db.t[m] ??= []).push({ id: `${m}-${++db.seq}`, createdAt: new Date(), ...d })
        n++
      }
      return { count: n }
    },
    updateMany: async ({ where, data }: { where: Row; data: Row }) => { const rs = (db.t[m] ?? []).filter((x) => es(m, x, where)); rs.forEach((r) => Object.assign(r, data)); return { count: rs.length } },
    // Defter ve talep için DELETE YOK (trigger / kural) — sahte istemcide de tanımlanmaz.
  })
  const prisma: Record<string, unknown> = {}
  for (const m of [
    'user', 'personnel', 'personnelSensitive', 'izinTuru', 'izinTalep', 'izinOnay', 'izinTalepGun', 'izinBakiyeHareketi', 'systemSetting', 'iproTatil',
    'izinBelge', 'izinErkenDonus', 'pdksPuantajGun', 'personnelAccessLog', 'permissionAuditLog', 'izinHatirlatma',
  ]) prisma[m] = model(m)
  prisma.$transaction = async (a: unknown) => (Array.isArray(a) ? Promise.all(a) : (a as (tx: unknown) => unknown)(prisma))
  return { prisma }
})
vi.mock('@/lib/audit-log', () => ({ logAuditEvent: async () => ({ ok: true }), SISTEM_AKTOR_ID: 'sistem' }))
vi.mock('@/lib/pdks/puantaj-servis', () => ({ bugunStr: () => '2026-10-01', gunuHesapla: async () => ({ yazilan: 0, kilitliAtlanan: 0 }) }))
vi.mock('@/lib/auth/get-user-permissions', () => ({ getUserPermissions: async (id: string) => new Set(db.izinler[id] ?? []) }))
vi.mock('./belge-depo', async (orj) => ({
  ...(await orj<typeof import('./belge-depo')>()),
  belgeYaz: (talepId: string, icerik: Uint8Array, uzanti: string) => {
    const dosyaAdi = `${talepId}-${String(db.dosyalar.size).padStart(16, '0')}.${uzanti}`
    db.dosyalar.set(dosyaAdi, icerik)
    return { dosyaAdi, sha256: 'x'.repeat(64), boyut: icerik.length }
  },
  belgeOku: (ad: string) => Buffer.from(db.dosyalar.get(ad) ?? new Uint8Array()),
  belgeGeriAl: (ad: string) => { db.dosyalar.delete(ad) },
}))
vi.mock('@/lib/onay/muafiyet', () => ({ selfEntryOnaydanMuafMi: async () => false }))
vi.mock('@/lib/onay/yonetici-cozumu', () => ({
  // çalışan p-c'nin yöneticisi u-m (p-m); p-m'nin yöneticisi yok (sahipsiz)
  resolveApprovers: async (pid: string) => (pid === 'p-c' || pid === 'p-d' ? { approverId: 'u-m', approverId2: null, approverId3: null } : { approverId: null, approverId2: null, approverId3: null }),
  getManagedPersonnelIds: async (pid: string) => (pid === 'p-m' ? ['p-c', 'p-d'] : []),
}))
vi.mock('./mail', () => {
  const kaydet = (fn: string) => async (...args: unknown[]) => { db.mailler.push({ fn, args }); return 1 }
  return {
    yoneticiyeTalep: kaydet('yoneticiyeTalep'), iveTalep: kaydet('iveTalep'), calisanaSonuc: kaydet('calisanaSonuc'), yoneticiyeBilgi: kaydet('yoneticiyeBilgi'),
    iptalBildir: kaydet('iptalBildir'), erkenDonusBildir: kaydet('erkenDonusBildir'),
    yoneticiyeHatirlatma: kaydet('yoneticiyeHatirlatma'), iveHatirlatma: kaydet('iveHatirlatma'), erkenDonusHatirlatma: kaydet('erkenDonusHatirlatma'),
  }
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
import { belgeAc } from './belge-servis'
import { erkenDonusKarar, erkenDonusListesi, erkenDonusTara } from './erken-donus'
import { IzinYetkiHatasi } from './gun-sayimi'
import { hatirlatmaIsi } from './hatirlatma'

const tur = (kod: string, o: Row = {}) => ({
  id: `t-${kod}`, kod, ad: kod === 'YILLIK' ? 'Yıllık izin' : kod === 'EVLILIK' ? 'Evlilik izni' : kod, yasal: true, bakiyeli: kod === 'YILLIK', sabitGun: null,
  gunSayimi: 'IS_GUNU', ucretli: true, yarimGunOlur: kod === 'YILLIK', onayAkisi: 'YONETICI_IV', belgeZorunlu: false, ozelNitelikli: false,
  pdksEtiketi: 'İzinli', kosul: null, aktif: true, sira: 0, birim: 'GUN', yillikKotaDakika: null, yakaKisiti: null, ...o,
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
  db.izinler = { 'u-iv': ['izin.admin'] }
  db.dosyalar = new Map()
  db.t = {
    user: [{ id: 'u-c', personnelId: 'p-c' }, { id: 'u-m', personnelId: 'p-m' }, { id: 'u-iv', personnelId: 'p-iv' }],
    personnel: ['p-c', 'p-d', 'p-m', 'p-iv'].map((id) => ({
      id, adSoyad: id.toUpperCase(), sicilNo: id, aktif: true, departmentId: 'dep', iseGirisTarihi: d('2020-01-01'), bolum: 'Kaynak',
      yakaRengi: id === 'p-d' ? 'MAVI' : 'BEYAZ',
    })),
    personnelSensitive: [],
    izinTuru: [tur('YILLIK'), tur('EVLILIK', { sabitGun: 3 }), tur('RAPOR', { ozelNitelikli: true, belgeZorunlu: true, onayAkisi: 'YALNIZ_IV' })],
    izinTalep: [], izinOnay: [], izinTalepGun: [], izinBelge: [], izinErkenDonus: [], pdksPuantajGun: [], personnelAccessLog: [], permissionAuditLog: [],
    izinHatirlatma: [],
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
  it('Faz 4: RAPOR formdan açılır ama BELGESİZ gönderilemez', async () => {
    await expect(talepOlustur(CALISAN, { turId: 't-RAPOR', baslangic: '2026-11-02', bitis: '2026-11-02' })).rejects.toThrow(/belge yüklemek zorunlu/)
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

// ═══════════════════════════════ İZİN FAZ 4 (İV kuralları 28.09) ═══════════════════════════════

const PDF = { icerik: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]), ad: 'nikah-cuzdani.pdf' }
const sabitTur = (kod: string, sabitGun: number) => ({ gunSayimi: 'PZT_CMT', belgeZorunlu: true, sabitGun, ad: kod === 'EVLILIK' ? 'Evlilik izni' : kod })
const onayla = async (id: string) => {
  await kararVer(YONETICI, id, { karar: 'ONAY' })
  return kararVer(IV, id, { karar: 'ONAY' })
}

describe('Faz 4 — sabit süreli izin Pzt–Cmt (Pazar sayılmaz)', () => {
  beforeEach(() => {
    db.t.izinTuru = [tur('YILLIK'), tur('EVLILIK', sabitTur('EVLILIK', 3)), tur('RAPOR', { ozelNitelikli: true, belgeZorunlu: true, onayAkisi: 'YALNIZ_IV' })]
  })
  it('Cuma → Pazartesi = 3 gün (Cumartesi sayılır, Pazar sayılmaz)', async () => {
    const on = await onizlemeHesapla(CALISAN, { turId: 't-EVLILIK', baslangic: '2026-10-30', bitis: '2026-11-02' })
    expect(on.hesap.toplam).toBe(3)
    expect(on.hesap.notlar).toContain('1 Pazar günü sayılmadı')
  })
  it('resmi tatil: ayar false (varsayılan) sayılmaz, true sayılır', async () => {
    const r = { turId: 't-EVLILIK', baslangic: '2026-10-29', bitis: '2026-10-31' } // Per tatil, Cum, Cmt
    expect((await onizlemeHesapla(CALISAN, r)).hesap.toplam).toBe(2)
    db.t.systemSetting.push({ key: 'izin_sabit_tatil_sayilir', value: 'true' })
    expect((await onizlemeHesapla(CALISAN, r)).hesap.toplam).toBe(3)
  })
})

describe('Faz 4 — belge zorunlu + erişim', () => {
  beforeEach(() => {
    db.t.izinTuru = [tur('YILLIK'), tur('EVLILIK', sabitTur('EVLILIK', 3)), tur('RAPOR', { ozelNitelikli: true, belgeZorunlu: true, onayAkisi: 'YALNIZ_IV' })]
  })
  const EVL = { turId: 't-EVLILIK', baslangic: '2026-11-02', bitis: '2026-11-04' }

  it('belgesiz gönderilemez; PDF ile açılır (imhaAt = +15 yıl); PDF/JPG/PNG dışı reddedilir', async () => {
    await expect(talepOlustur(CALISAN, EVL)).rejects.toThrow('belge yüklemek zorunlu')
    await expect(talepOlustur(CALISAN, EVL, { icerik: new TextEncoder().encode('merhaba'), ad: 'x.txt' })).rejects.toThrow(/PDF, JPG ya da PNG/)
    expect(db.dosyalar.size).toBe(0)
    const { id } = await talepOlustur(CALISAN, EVL, PDF)
    const b = db.t.izinBelge.find((x) => x.talepId === id)!
    expect(b).toMatchObject({ mime: 'application/pdf', orijinalAd: 'nikah-cuzdani.pdf', yukleyenId: 'u-c' })
    expect((b.imhaAt as Date).getUTCFullYear() - new Date().getUTCFullYear()).toBe(15)
  })

  it('belgeyi çalışan + İV görür, YÖNETİCİ göremez; her açılış denetime yazılır', async () => {
    const { id } = await talepOlustur(CALISAN, EVL, PDF)
    const bid = db.t.izinBelge.find((x) => x.talepId === id)!.id as string
    await expect(belgeAc(YONETICI, bid, null)).rejects.toBeInstanceOf(IzinYetkiHatasi)
    expect((await belgeAc(CALISAN, bid, '10.0.0.1')).mime).toBe('application/pdf')
    expect((await belgeAc(IV, bid, null)).ad).toBe('nikah-cuzdani.pdf')
    expect(db.t.personnelAccessLog.map((x) => [x.accessedBy, x.accessType])).toEqual([['u-c', 'IZIN_BELGE'], ['u-iv', 'IZIN_BELGE']])
    expect(db.t.permissionAuditLog.filter((x) => x.action === 'IZIN_BELGE_ACILDI')).toHaveLength(2)
    // yöneticinin onay kaleminde belge listesi YOK
    expect(JSON.stringify(await onayListesi(YONETICI, 'bekleyen'))).not.toMatch(/nikah|belgeler/)
  })

  it('RAPOR belgesi: izin.admin YETMEZ, izin.rapor.gor gerekir', async () => {
    const { id } = await talepOlustur(CALISAN, { turId: 't-RAPOR', baslangic: '2026-11-02', bitis: '2026-11-03' }, { ...PDF, ad: 'rapor.pdf' })
    const bid = db.t.izinBelge.find((x) => x.talepId === id)!.id as string
    await expect(belgeAc(IV, bid, null)).rejects.toBeInstanceOf(IzinYetkiHatasi)
    db.izinler['u-iv'] = ['izin.admin', 'izin.rapor.gor']
    await belgeAc(IV, bid, null)
    expect(db.t.personnelAccessLog.at(-1)).toMatchObject({ accessType: 'IZIN_RAPOR_BELGE' })
  })
})

describe('Faz 4 — rapor, onaylı yıllık izinle çakışırsa yıllık günleri iade', () => {
  it('yıllık 26–30 Eki onaylı; rapor 27–28 İV onayı → 1,5 gün IPTAL_IADE (RAPOR:<rapor>:<yıllık>), gün satırları kalır, not düşer', async () => {
    const y = await talepOlustur(CALISAN, YILLIK_26_30)
    await onayla(y.id)
    const r = await talepOlustur(CALISAN, { turId: 't-RAPOR', baslangic: '2026-10-27', bitis: '2026-10-28' }, PDF)
    expect(r.durum).toBe('BEKLIYOR_IV') // YALNIZ_IV; yıllıkla çakışma engeli rapora uygulanmaz
    const k = await kararVer(IV, r.id, { karar: 'ONAY' })
    expect(k.uyari).toMatch(/1,5 gün bakiyeye iade/)
    const yGun = db.t.izinTalepGun.filter((x) => x.talepId === y.id)
    expect(yGun.filter((x) => x.iadeAt).map((x) => [(x.tarih as Date).toISOString().slice(8, 10), x.iadeNedeni, x.iadeTalepId])).toEqual([['27', 'RAPOR', r.id], ['28', 'RAPOR', r.id]])
    expect(yGun).toHaveLength(5) // silinmedi
    expect(db.t.izinBakiyeHareketi.filter((h) => h.anahtar === `RAPOR:${r.id}:${y.id}`)).toMatchObject([{ hareket: 'IPTAL_IADE', gun: 1.5, talepId: y.id }])
    expect(db.t.izinOnay.find((o) => o.talepId === y.id && o.kademe === 'SISTEM')!.gerekce).toBe('rapor nedeniyle kısaldı (1,5 gün iade)')
  })
})

describe('Faz 4 — mazeret izni (saatlik, 54 saat, yalnız beyaz yaka)', () => {
  beforeEach(() => {
    db.t.izinTuru.push(tur('MAZERET', { ad: 'Mazeret izni (saatlik)', birim: 'SAAT', yillikKotaDakika: 3240, yakaKisiti: 'BEYAZ' }))
  })
  const MZ = (o: Row = {}) => ({ turId: 't-MAZERET', baslangic: '2026-11-03', baslangicSaat: '08:00', bitisSaat: '10:00', ...o })

  it('mavi yaka talep edemez', async () => {
    await expect(talepOlustur(YONETICI, MZ({ personnelId: 'p-d' }))).rejects.toThrow('yalnız beyaz yaka')
  })
  it('54 saat sınırı: 53 saat kullanılmışken 2 saat reddedilir, 1 saat açılır (gün 0, dakika 60)', async () => {
    db.t.izinTalep.push({ id: 'eski', personnelId: 'p-c', turId: 't-MAZERET', durum: 'ONAYLANDI', baslangic: d('2026-03-02'), bitis: d('2026-03-02'), dakika: 3180, gunSayisi: 0 })
    await expect(talepOlustur(CALISAN, MZ())).rejects.toThrow(/kotası yetersiz: kalan 1 sa, talep 2 sa/)
    const { id } = await talepOlustur(CALISAN, MZ({ bitisSaat: '09:00' }))
    expect(db.t.izinTalep.find((t) => t.id === id)).toMatchObject({ dakika: 60, gunSayisi: 0, baslangicSaat: '08:00', bitisSaat: '09:00' })
    // geçen yılın kullanımı dönemi etkilemez (takvim yılı)
    db.t.izinTalep.find((t) => t.id === 'eski')!.baslangic = d('2025-12-15')
    expect((await onizlemeHesapla(CALISAN, MZ({ baslangic: '2026-11-04' }))).kota).toMatchObject({ kalanDk: 3180, yeterli: true })
  })
  it('hafta sonuna / ters aralığa saatlik izin alınmaz', async () => {
    await expect(onizlemeHesapla(CALISAN, MZ({ baslangic: '2026-11-07' }))).rejects.toThrow('çalışma gününe')
    await expect(onizlemeHesapla(CALISAN, MZ({ bitisSaat: '07:00' }))).rejects.toThrow('sonra olmalı')
  })
  it('İV onayı: defter YOK, gün dondurulmaz; puantaj o gün için yeniden hesaplanır', async () => {
    const { id } = await talepOlustur(CALISAN, MZ())
    await onayla(id)
    expect(db.t.izinTalep.find((t) => t.id === id)!.durum).toBe('ONAYLANDI')
    expect(db.t.izinTalepGun.filter((x) => x.talepId === id)).toEqual([])
    expect(db.t.izinBakiyeHareketi.filter((h) => h.talepId === id)).toEqual([])
    expect(db.pdks.at(-1)).toEqual({ personnelId: 'p-c', bas: '2026-11-03', bit: '2026-11-03' })
  })
})

describe('Faz 4 — eksi bakiye: personel seçemez, yalnız İV dilekçe gerekçesiyle', () => {
  it('İV onayında yetersiz bakiye: "eksiye düşür" + gerekçe şart; gerekçeyle onaylanır, bakiye eksiye iner', async () => {
    const { id } = await talepOlustur(CALISAN, YILLIK_26_30)
    await kararVer(YONETICI, id, { karar: 'ONAY' })
    db.t.izinBakiyeHareketi.push({ id: 'dz', personnelId: 'p-c', turId: 't-YILLIK', hareket: 'DUZELTME', gun: -10, tarih: d('2026-09-30') }) // bakiye 2
    await expect(kararVer(IV, id, { karar: 'ONAY' })).rejects.toThrow(/Yetersiz bakiye/)
    await expect(kararVer(IV, id, { karar: 'ONAY', negatifeDusur: true })).rejects.toThrow('dilekçe gerekçesi zorunlu')
    await kararVer(IV, id, { karar: 'ONAY', negatifeDusur: true, gerekce: 'Dilekçe 2026/41 — acil aile durumu' })
    const top = db.t.izinBakiyeHareketi.filter((h) => h.personnelId === 'p-c').reduce((t, h) => t + Number(h.gun), 0)
    expect(top).toBe(-1.5)
    expect(db.t.izinOnay.find((o) => o.talepId === id && o.kademe === 'IV')!.gerekce).toMatch(/Dilekçe/)
  })
})

describe('Faz 4 — erken dönüş kuyruğu (otomatik iade YOK)', () => {
  const hazirla = async () => {
    const y = await talepOlustur(CALISAN, YILLIK_26_30)
    await onayla(y.id)
    db.t.pdksPuantajGun.push({ id: 'pg1', personnelId: 'p-c', gun: d('2026-10-27'), izinTalepId: y.id, uyarilar: ['IZINLI_GUNDE_GECIS'] })
    return y.id
  }
  it('tarama kuyruğa alır + İV bildirimi; defter DEĞİŞMEZ; ikinci tarama tekrar eklemez', async () => {
    await hazirla()
    const once = db.t.izinBakiyeHareketi.length
    expect(await erkenDonusTara()).toEqual({ yeni: 1 })
    expect(await erkenDonusTara()).toEqual({ yeni: 0 })
    expect(db.t.izinBakiyeHareketi.length).toBe(once)
    expect(db.mailler.filter((m) => m.fn === 'erkenDonusBildir')).toHaveLength(1)
    const l = await erkenDonusListesi(IV)
    expect(l).toMatchObject([{ durum: 'BEKLIYOR', tarih: '2026-10-27', iadeEdilebilir: 2.5 }]) // 27 (1) + 28 arefe (0,5) + 30 (1); 29 tatil
    await expect(erkenDonusListesi(CALISAN)).rejects.toBeInstanceOf(IzinYetkiHatasi)
  })
  it('İV onayı: tespit gününden itibaren kalan günler iade (ERKEN:<talep>), satırlar kalır; red: iade yok', async () => {
    const yid = await hazirla()
    await erkenDonusTara()
    const e = db.t.izinErkenDonus[0]
    await expect(erkenDonusKarar(YONETICI, e.id as string, { karar: 'ONAY' })).rejects.toBeInstanceOf(IzinYetkiHatasi)
    expect(await erkenDonusKarar(IV, e.id as string, { karar: 'ONAY' })).toEqual({ durum: 'ONAYLANDI', iadeGun: 2.5 })
    expect(db.t.izinBakiyeHareketi.filter((h) => h.anahtar === `ERKEN:${yid}`)).toMatchObject([{ hareket: 'IPTAL_IADE', gun: 2.5 }])
    const gunler = db.t.izinTalepGun.filter((x) => x.talepId === yid)
    expect(gunler.filter((x) => x.iadeAt).map((x) => (x.tarih as Date).toISOString().slice(8, 10))).toEqual(['27', '28', '30'])
    expect(gunler.find((x) => (x.tarih as Date).toISOString().startsWith('2026-10-26'))!.iadeAt).toBeUndefined()
    expect(db.t.izinOnay.find((o) => o.talepId === yid && o.kademe === 'SISTEM')!.gerekce).toBe('erken dönüş: 27.10.2026 itibarıyla 2,5 gün iade')
    await expect(erkenDonusKarar(IV, e.id as string, { karar: 'RED' })).rejects.toThrow('karar verilmiş')
  })
  it('red → iade yapılmaz', async () => {
    await hazirla()
    await erkenDonusTara()
    const once = db.t.izinBakiyeHareketi.length
    expect(await erkenDonusKarar(IV, db.t.izinErkenDonus[0].id as string, { karar: 'RED', not: 'mesaiye çağrıldı, izin sürüyor' })).toEqual({ durum: 'REDDEDILDI', iadeGun: 0 })
    expect(db.t.izinBakiyeHareketi.length).toBe(once)
  })
})

// ═══════════════════════════════ İZİN FAZ 6 — onay hatırlatmaları ═══════════════════════════════

describe('Faz 6 — onay hatırlatması (eskalasyon yok, kademe başına tek mail)', () => {
  /** Yerel (+03:00) "YYYY-MM-DD HH:mm" → UTC Date */
  const yerel = (s: string) => new Date(`${s.replace(' ', 'T')}:00+03:00`)
  const saat = (t: Date, h: number) => new Date(t.getTime() + h * 3600_000)
  const hMail = () => db.mailler.filter((m) => /Hatirlatma$/.test(m.fn))
  const ac = () => db.t.systemSetting.push({ key: 'izin_talep_acik', value: 'true' })
  /** Yönetici kademesinde bekleyen talep; oluşturma anı sabitlenir */
  const bekleyen = async (olusturma: Date) => {
    const { id } = await talepOlustur(CALISAN, { turId: 't-EVLILIK', baslangic: '2026-11-09', bitis: '2026-11-10' })
    db.t.izinTalep.find((t) => t.id === id)!.createdAt = olusturma
    db.mailler = []
    return id
  }
  beforeEach(ac)

  it('24 saat sınırı: 23:59 sonra gitmez, tam 24 saatte gider (iş günü 10:00)', async () => {
    const simdi = yerel('2026-11-04 10:00') // Çarşamba
    await bekleyen(saat(simdi, -24 + 1 / 60))
    expect(await hatirlatmaIsi({ simdi })).toMatchObject({ yonetici: 0 })
    expect(hMail()).toHaveLength(0)
    db.t.izinTalep[0].createdAt = saat(simdi, -24)
    expect(await hatirlatmaIsi({ simdi })).toMatchObject({ yonetici: 1, iv: 0 })
    expect(hMail().map((m) => m.fn)).toEqual(['yoneticiyeHatirlatma'])
    expect(hMail()[0].args[1]).toEqual(['u-m', null, null]) // talep anında çözülen yönetici adayları
  })

  it('tek gönderim: ikinci ve sonraki çalışmada aynı talep+kademe için gitmez', async () => {
    const simdi = yerel('2026-11-04 10:00')
    await bekleyen(saat(simdi, -30))
    await hatirlatmaIsi({ simdi })
    await hatirlatmaIsi({ simdi: saat(simdi, 1) })
    await hatirlatmaIsi({ simdi: saat(simdi, 48) })
    expect(hMail()).toHaveLength(1)
    expect(db.t.izinHatirlatma).toHaveLength(1)
    expect(db.t.izinHatirlatma[0]).toMatchObject({ kademe: 'YONETICI', aliciSayisi: 1 })
    expect(db.t.izinHatirlatma[0].anahtar).toMatch(/^TALEP:.+:YONETICI$/)
  })

  it('kademe değişince yeni sayaç: İV hatırlatması yönetici onayından 24 saat sonra, bir kez', async () => {
    const simdi = yerel('2026-11-04 10:00')
    const id = await bekleyen(saat(simdi, -30))
    await hatirlatmaIsi({ simdi }) // yönetici hatırlatması
    await kararVer(YONETICI, id, { karar: 'ONAY' })
    db.t.izinOnay.find((o) => o.talepId === id && o.kademe === 'YONETICI')!.createdAt = simdi
    db.mailler = []
    expect(await hatirlatmaIsi({ simdi: saat(simdi, 23) })).toMatchObject({ yonetici: 0, iv: 0 })
    expect(await hatirlatmaIsi({ simdi: saat(simdi, 24) })).toMatchObject({ yonetici: 0, iv: 1 })
    expect(await hatirlatmaIsi({ simdi: saat(simdi, 26) })).toMatchObject({ iv: 0 })
    expect(hMail().map((m) => m.fn)).toEqual(['iveHatirlatma'])
    expect(db.t.izinHatirlatma.map((h) => h.kademe).sort()).toEqual(['IV', 'YONETICI'])
  })

  it('doğrudan İV\'ye giden talep (YALNIZ_IV): sayaç oluşturmadan başlar', async () => {
    const simdi = yerel('2026-11-04 10:00')
    db.t.izinTuru.push(tur('IDARI', { onayAkisi: 'YALNIZ_IV' }))
    const { id } = await talepOlustur(CALISAN, { turId: 't-IDARI', baslangic: '2026-11-09', bitis: '2026-11-09' })
    db.t.izinTalep.find((t) => t.id === id)!.createdAt = saat(simdi, -25)
    db.mailler = []
    expect(await hatirlatmaIsi({ simdi })).toMatchObject({ yonetici: 0, iv: 1 })
  })

  it('hafta sonu, resmi tatil ve 08:30 öncesi ertelenir; bir sonraki iş günü 08:30 sonrası ilk çalışmada gider', async () => {
    // Süre Çarşamba 28.10 (arefe — YARIM, iş günü) 20:00'de dolar; 29.10 TATIL; 30.10 Cuma
    await bekleyen(yerel('2026-10-27 20:00'))
    expect(await hatirlatmaIsi({ simdi: yerel('2026-10-28 19:59') })).toMatchObject({ yonetici: 0 })
    expect(await hatirlatmaIsi({ simdi: yerel('2026-10-29 10:00') })).toMatchObject({ ertelendi: 'resmi tatil', yonetici: 0 })
    expect(await hatirlatmaIsi({ simdi: yerel('2026-10-30 08:29') })).toMatchObject({ ertelendi: '08:30 öncesi' })
    expect(await hatirlatmaIsi({ simdi: yerel('2026-10-30 08:30') })).toMatchObject({ yonetici: 1 })
    expect(hMail()).toHaveLength(1)
  })

  it('hafta sonu dolan süre Pazartesi 08:30 sonrasında gider; arefe (YARIM) iş günüdür', async () => {
    await bekleyen(yerel('2026-10-30 12:00')) // Cuma → süre Cumartesi 12:00
    expect(await hatirlatmaIsi({ simdi: yerel('2026-10-31 12:00') })).toMatchObject({ ertelendi: 'hafta sonu' })
    expect(await hatirlatmaIsi({ simdi: yerel('2026-11-01 09:00') })).toMatchObject({ ertelendi: 'hafta sonu' })
    expect(await hatirlatmaIsi({ simdi: yerel('2026-11-02 09:00') })).toMatchObject({ yonetici: 1 })
    db.t.izinTalep = []
    db.mailler = []
    await bekleyen(yerel('2026-10-27 09:00'))
    expect(await hatirlatmaIsi({ simdi: yerel('2026-10-28 09:00') })).toMatchObject({ yonetici: 1 }) // arefe
  })

  it('izin_talep_acik kapalıyken no-op: satır da mail de yok', async () => {
    db.t.systemSetting = db.t.systemSetting.filter((a) => a.key !== 'izin_talep_acik')
    const simdi = yerel('2026-11-04 10:00')
    await bekleyen(saat(simdi, -48))
    expect(await hatirlatmaIsi({ simdi })).toMatchObject({ kapali: true, yonetici: 0, iv: 0, erkenDonus: 0 })
    db.t.systemSetting.push({ key: 'izin_talep_acik', value: 'false' })
    expect(await hatirlatmaIsi({ simdi })).toMatchObject({ kapali: true })
    expect(hMail()).toHaveLength(0)
    expect(db.t.izinHatirlatma).toHaveLength(0)
  })

  it('dryRun gerçek mail göndermez ve satır yazmaz; ardından gerçek çalışma gönderir', async () => {
    const simdi = yerel('2026-11-04 10:00')
    await bekleyen(saat(simdi, -30))
    expect(await hatirlatmaIsi({ simdi, dryRun: true })).toMatchObject({ dryRun: true, yonetici: 1 })
    expect(hMail()).toHaveLength(0)
    expect(db.t.izinHatirlatma).toHaveLength(0)
    expect(await hatirlatmaIsi({ simdi })).toMatchObject({ dryRun: false, yonetici: 1 })
  })

  it('izin_hatirlatma_saat ayarı okunur (48 saat)', async () => {
    db.t.systemSetting.push({ key: 'izin_hatirlatma_saat', value: '48' })
    const simdi = yerel('2026-11-04 10:00')
    await bekleyen(saat(simdi, -30))
    expect(await hatirlatmaIsi({ simdi })).toMatchObject({ saat: 48, yonetici: 0 })
  })

  it('erken dönüş kuyruğunda BEKLIYOR kalan kayıt: İV\'ye aynı kuralla tek özet hatırlatma; karar verilmişe gitmez', async () => {
    const simdi = yerel('2026-11-04 10:00')
    const ids: string[] = []
    for (const [bas, bit] of [['2026-10-05', '2026-10-06'], ['2026-10-12', '2026-10-13'], ['2026-10-19', '2026-10-20']]) {
      const { id } = await talepOlustur(CALISAN, { turId: 't-EVLILIK', baslangic: bas, bitis: bit })
      db.t.izinTalep.find((t) => t.id === id)!.durum = 'ONAYLANDI' // onaylı izin → talep hatırlatması yok
      ids.push(id)
    }
    db.t.izinErkenDonus.push(
      { id: 'e1', talepId: ids[0], personnelId: 'p-c', tarih: d('2026-10-06'), durum: 'BEKLIYOR', createdAt: saat(simdi, -25) },
      { id: 'e2', talepId: ids[1], personnelId: 'p-c', tarih: d('2026-10-13'), durum: 'ONAYLANDI', createdAt: saat(simdi, -50) },
      { id: 'e3', talepId: ids[2], personnelId: 'p-c', tarih: d('2026-10-20'), durum: 'BEKLIYOR', createdAt: saat(simdi, -2) },
    )
    db.mailler = []
    expect(await hatirlatmaIsi({ simdi })).toMatchObject({ erkenDonus: 1 })
    expect(await hatirlatmaIsi({ simdi: saat(simdi, 1) })).toMatchObject({ erkenDonus: 0 })
    expect(hMail()).toEqual([{ fn: 'erkenDonusHatirlatma', args: [1] }])
    expect(db.t.izinHatirlatma.map((h) => h.anahtar)).toEqual(['ERKEN:e1'])
  })
})

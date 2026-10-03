import { describe, expect, it } from 'vitest'
import {
  ZINCIR_ALANI,
  firmaZincirGeriAl,
  firmaZincirOnizleme,
  firmaZincirPasiflestir,
  firmaSonZincirIslemId,
  zincirGeriAlAciklamasi,
  zincirPasifAciklamasi,
} from './firma-zincir'

// Durumlu (in-memory) sahte tx: tablolar gerçekten güncellenir; audit satırları
// birikir. Böylece "zincirleme pasif → seçici geri alma" uçtan uca doğrulanır.
type Satir = Record<string, unknown> & { id: string }

function eslesir(satir: Satir, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true
  return Object.entries(where).every(([alan, kosul]) => {
    const deger = satir[alan]
    if (kosul && typeof kosul === 'object' && !Array.isArray(kosul)) {
      const k = kosul as Record<string, unknown>
      if ('in' in k) return (k.in as unknown[]).includes(deger)
      if ('path' in k) {
        const yol = k.path as string[]
        const kok = deger as Record<string, unknown> | null
        return !!kok && typeof kok === 'object' && kok[yol[0]] === k.equals
      }
    }
    return deger === kosul
  })
}

function tablo(baslangic: Satir[] = []) {
  const satirlar = baslangic.map((s) => ({ ...s }))
  let sayac = 0
  return {
    satirlar,
    findMany: async ({ where }: { where?: Record<string, unknown> } = {}) =>
      satirlar.filter((s) => eslesir(s, where)).map((s) => ({ ...s })),
    findUnique: async ({ where }: { where: { id: string } }) => {
      const s = satirlar.find((x) => x.id === where.id)
      return s ? { ...s } : null
    },
    findFirst: async ({ where, orderBy }: { where?: Record<string, unknown>; orderBy?: unknown } = {}) => {
      const liste = satirlar.filter((s) => eslesir(s, where)).map((s) => ({ ...s }))
      if (orderBy) liste.sort((a, b) => (b.sira as number) - (a.sira as number)) // tarih desc, id desc ≈ sira desc
      return liste[0] ?? null
    },
    update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const s = satirlar.find((x) => x.id === where.id)
      if (!s) throw new Error(`kayıt yok: ${where.id}`)
      Object.assign(s, data)
      return { ...s }
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const s = { ...data, id: `audit-${++sayac}`, sira: satirlar.length + 1 } as Satir
      satirlar.push(s)
      return s
    },
  }
}

const gun = (s: string) => new Date(`${s}T00:00:00.000Z`)

function kur() {
  const db = {
    servisArac: tablo([
      { id: 'A1', firmaId: 'F1', aktif: true },
      { id: 'A2', firmaId: 'F1', aktif: true },
      { id: 'A3', firmaId: 'F1', aktif: false }, // daha önce AYRICA pasifleştirilmiş
      { id: 'AX', firmaId: 'F2', aktif: true }, // başka firma
    ]),
    servisSofor: tablo([
      { id: 'S1', firmaId: 'F1', aktif: true },
      { id: 'S2', firmaId: 'F1', aktif: false }, // daha önce ayrıca pasif
      { id: 'SX', firmaId: 'F2', aktif: true },
    ]),
    servisGuzergahAracVarsayilan: tablo([
      { id: 'V1', aracId: 'A1', aktif: true, baslangicTarihi: gun('2026-01-01'), bitisTarihi: null },
      { id: 'V2', aracId: 'A3', aktif: true, baslangicTarihi: gun('2026-01-01'), bitisTarihi: gun('2026-12-31') }, // pasif araca bağlı AKTİF atama
      { id: 'V3', aracId: 'A2', aktif: false, baslangicTarihi: gun('2026-01-01'), bitisTarihi: gun('2026-02-01') }, // zaten kapalı
      { id: 'VX', aracId: 'AX', aktif: true, baslangicTarihi: gun('2026-01-01'), bitisTarihi: null },
    ]),
    servisGuzergahSoforVarsayilan: tablo([
      { id: 'W1', soforId: 'S1', aktif: true, baslangicTarihi: gun('2026-03-01'), bitisTarihi: null },
      { id: 'WX', soforId: 'SX', aktif: true, baslangicTarihi: gun('2026-03-01'), bitisTarihi: null },
    ]),
    servisIslemGecmisi: tablo(),
  }
  return db as unknown as Parameters<typeof firmaZincirPasiflestir>[0] & typeof db
}

const SIMDI = new Date('2026-10-03T09:00:00.000Z')
const FIRMA = { id: 'F1', ad: 'Taşeron A' }
const audit = (db: ReturnType<typeof kur>) => db.servisIslemGecmisi.satirlar as unknown as Satir[]

/** Servis katmanının yaptığı gibi: firma pasif audit satırı (zincir kimliğiyle) yazılır. */
async function firmaPasifSatiriYaz(db: ReturnType<typeof kur>, zincirIslemId: string | null) {
  await db.servisIslemGecmisi.create({
    data: {
      hedefTipi: 'FIRMA', hedefId: 'F1', islem: 'PASIFLESTIRME',
      yeniDeger: zincirIslemId ? { aktif: false, [ZINCIR_ALANI]: zincirIslemId } : { aktif: false },
    },
  })
}

describe('firmaZincirPasiflestir', () => {
  it('🔴 aktif araç + aktif şoför pasif; aktif atamalar (pasif araca bağlı olanlar dahil) BUGÜNÜN tarihiyle kapanır', async () => {
    const db = kur()
    const sonuc = await firmaZincirPasiflestir(db, FIRMA, 'user-1', SIMDI)

    expect(sonuc).toMatchObject({ arac: 2, sofor: 1, aracAtama: 2, soforAtama: 1 })
    const durum = (t: { satirlar: Satir[] }, id: string) => t.satirlar.find((s) => s.id === id)!
    expect([durum(db.servisArac, 'A1').aktif, durum(db.servisArac, 'A2').aktif]).toEqual([false, false])
    expect(durum(db.servisSofor, 'S1').aktif).toBe(false)
    for (const id of ['V1', 'V2']) {
      expect(durum(db.servisGuzergahAracVarsayilan, id)).toMatchObject({ aktif: false, bitisTarihi: gun('2026-10-03') })
    }
    expect(durum(db.servisGuzergahSoforVarsayilan, 'W1')).toMatchObject({ aktif: false, bitisTarihi: gun('2026-10-03') })
    // başka firma etkilenmez
    expect(durum(db.servisArac, 'AX').aktif).toBe(true)
    expect(durum(db.servisSofor, 'SX').aktif).toBe(true)
    expect(durum(db.servisGuzergahAracVarsayilan, 'VX').aktif).toBe(true)
    expect(durum(db.servisGuzergahSoforVarsayilan, 'WX').aktif).toBe(true)
  })

  it('🔴 daha önce ayrıca pasifleştirilmiş araç/şoföre ve zaten kapalı atamaya DOKUNULMAZ (audit satırı da yok)', async () => {
    const db = kur()
    await firmaZincirPasiflestir(db, FIRMA, 'user-1', SIMDI)
    const hedefler = audit(db).map((a) => a.hedefId)
    expect(hedefler).not.toContain('A3')
    expect(hedefler).not.toContain('S2')
    expect(hedefler).not.toContain('V3')
    expect(db.servisGuzergahAracVarsayilan.satirlar.find((s) => s.id === 'V3')!.bitisTarihi).toEqual(gun('2026-02-01'))
  })

  it('her kayıt için audit: ortak zincirIslemId + "Firma pasifleştirildiği için (firma: <ad>)"', async () => {
    const db = kur()
    const sonuc = await firmaZincirPasiflestir(db, FIRMA, 'user-1', SIMDI)
    const satirlar = audit(db)
    expect(satirlar).toHaveLength(2 + 1 + 2 + 1) // araç + şoför + araç atama + şoför atama
    expect(new Set(satirlar.map((a) => (a.yeniDeger as Record<string, unknown>)[ZINCIR_ALANI]))).toEqual(new Set([sonuc.islemId]))
    for (const a of satirlar) {
      expect(a.islem).toBe('PASIFLESTIRME')
      expect(a.aciklama).toBe('Firma pasifleştirildiği için (firma: Taşeron A)')
      expect(a.userId).toBe('user-1')
    }
    expect(zincirPasifAciklamasi('Taşeron A')).toBe('Firma pasifleştirildiği için (firma: Taşeron A)')
    expect(satirlar.map((a) => a.hedefTipi).sort()).toEqual([
      'ARAC', 'ARAC', 'GUZERGAH_ARAC_VARSAYILAN', 'GUZERGAH_ARAC_VARSAYILAN', 'GUZERGAH_SOFOR_VARSAYILAN', 'SOFOR',
    ])
  })

  it('atama audit\'i eski bitiş → yeni bitiş + aktif true → false taşır', async () => {
    const db = kur()
    await firmaZincirPasiflestir(db, FIRMA, 'user-1', SIMDI)
    const v2 = audit(db).find((a) => a.hedefId === 'V2')!
    expect(v2.oncekiDeger).toEqual({ bitisTarihi: gun('2026-12-31'), aktif: true })
    expect(v2.yeniDeger).toMatchObject({ bitisTarihi: gun('2026-10-03'), aktif: false })
  })

  it('başlangıcı GELECEKTEKİ atama: bitiş başlangıç gününe çekilir (bitiş >= başlangıç)', async () => {
    const db = kur()
    db.servisGuzergahSoforVarsayilan.satirlar[0].baslangicTarihi = gun('2026-11-15')
    await firmaZincirPasiflestir(db, FIRMA, 'user-1', SIMDI)
    expect(db.servisGuzergahSoforVarsayilan.satirlar.find((s) => s.id === 'W1')!.bitisTarihi).toEqual(gun('2026-11-15'))
  })

  it('bağlı hiçbir şey yoksa sıfır sonuç, audit yok', async () => {
    const db = kur()
    const sonuc = await firmaZincirPasiflestir(db, { id: 'F9', ad: 'Boş' }, 'u', SIMDI)
    expect(sonuc).toMatchObject({ arac: 0, sofor: 0, aracAtama: 0, soforAtama: 0 })
    expect(audit(db)).toHaveLength(0)
  })
})

describe('firmaZincirOnizleme + firmaZincirGeriAl — SEÇİCİ geri alma', () => {
  async function pasifSonrasi() {
    const db = kur()
    const sonuc = await firmaZincirPasiflestir(db, FIRMA, 'user-1', SIMDI)
    await firmaPasifSatiriYaz(db, sonuc.islemId)
    return { db, zincirIslemId: sonuc.islemId }
  }

  it('önizleme: zincirle pasifleşen 2 araç + 1 şoför geri gelebilir; 3 atama kapanmıştı (geri alınmaz)', async () => {
    const { db, zincirIslemId } = await pasifSonrasi()
    expect(await firmaZincirOnizleme(db, 'F1')).toEqual({
      zincirIslemId, geriAlinabilirArac: 2, geriAlinabilirSofor: 1, kapananAtama: 3,
    })
  })

  it('🔴 geri alma: yalnız zincirle pasifleşenler gelir; ÖNCEDEN ayrıca pasif araç (A3) ve şoför (S2) geri GELMEZ', async () => {
    const { db, zincirIslemId } = await pasifSonrasi()
    const sonuc = await firmaZincirGeriAl(db, FIRMA, zincirIslemId, 'user-2')

    expect(sonuc).toEqual({ arac: 2, sofor: 1, kapananAtama: 3 })
    const aktif = (t: { satirlar: Satir[] }, id: string) => t.satirlar.find((s) => s.id === id)!.aktif
    expect([aktif(db.servisArac, 'A1'), aktif(db.servisArac, 'A2')]).toEqual([true, true])
    expect(aktif(db.servisSofor, 'S1')).toBe(true)
    expect(aktif(db.servisArac, 'A3')).toBe(false) // önceden pasif
    expect(aktif(db.servisSofor, 'S2')).toBe(false) // önceden pasif
  })

  it('🔴 kapatılan atamalar GERİ ALINMAZ (aktif=false ve bitiş tarihi korunur)', async () => {
    const { db, zincirIslemId } = await pasifSonrasi()
    await firmaZincirGeriAl(db, FIRMA, zincirIslemId, 'user-2')
    for (const [tablo_, id] of [
      [db.servisGuzergahAracVarsayilan, 'V1'], [db.servisGuzergahAracVarsayilan, 'V2'], [db.servisGuzergahSoforVarsayilan, 'W1'],
    ] as const) {
      expect(tablo_.satirlar.find((s) => s.id === id)).toMatchObject({ aktif: false, bitisTarihi: gun('2026-10-03') })
    }
  })

  it('geri alınan her kayıt için AKTIFLESTIRME audit\'i: açıklama + zincirIslemId', async () => {
    const { db, zincirIslemId } = await pasifSonrasi()
    const oncesi = audit(db).length
    await firmaZincirGeriAl(db, FIRMA, zincirIslemId, 'user-2')
    const yeni = audit(db).slice(oncesi)
    expect(yeni).toHaveLength(3) // 2 araç + 1 şoför (atama geri alınmaz → audit yok)
    for (const a of yeni) {
      expect(a.islem).toBe('AKTIFLESTIRME')
      expect(a.aciklama).toBe('Firma geri alındığı için birlikte geri alındı (firma: Taşeron A)')
      expect(a.userId).toBe('user-2')
      expect((a.yeniDeger as Record<string, unknown>)[ZINCIR_ALANI]).toBe(zincirIslemId)
    }
    expect(zincirGeriAlAciklamasi('Taşeron A')).toContain('(firma: Taşeron A)')
  })

  it('🔴 zincirden sonra araç elle geri alınıp tekrar pasifleştirilmişse (başka bir olay) ZİNCİRLE geri GELMEZ', async () => {
    const { db, zincirIslemId } = await pasifSonrasi()
    // A1: elle geri alındı sonra elle pasifleştirildi → son audit olayı zincir satırı değil
    db.servisArac.satirlar.find((s) => s.id === 'A1')!.aktif = false
    await db.servisIslemGecmisi.create({ data: { hedefTipi: 'ARAC', hedefId: 'A1', islem: 'AKTIFLESTIRME', yeniDeger: { aktif: true } } })
    await db.servisIslemGecmisi.create({ data: { hedefTipi: 'ARAC', hedefId: 'A1', islem: 'PASIFLESTIRME', yeniDeger: { aktif: false } } })

    const sonuc = await firmaZincirGeriAl(db, FIRMA, zincirIslemId, 'user-2')
    expect(sonuc.arac).toBe(1) // yalnız A2
    expect(db.servisArac.satirlar.find((s) => s.id === 'A1')!.aktif).toBe(false)
    expect(db.servisArac.satirlar.find((s) => s.id === 'A2')!.aktif).toBe(true)
  })

  it('zincirden sonra elle zaten aktifleştirilmiş araç tekrar işlenmez (çift audit yok)', async () => {
    const { db, zincirIslemId } = await pasifSonrasi()
    db.servisArac.satirlar.find((s) => s.id === 'A1')!.aktif = true
    const sonuc = await firmaZincirGeriAl(db, FIRMA, zincirIslemId, 'user-2')
    expect(sonuc.arac).toBe(1)
  })

  it('iki ayrı zincir: geri alma YALNIZ son zincirin kayıtlarını etkiler', async () => {
    const { db, zincirIslemId: z1 } = await pasifSonrasi()
    await firmaZincirGeriAl(db, FIRMA, z1, 'u') // 1. zincir geri alındı (A1,A2,S1 aktif)
    db.servisArac.satirlar.find((s) => s.id === 'A1')!.aktif = true
    // 2. pasifleştirme: yalnız A1 aktif araç (A2 elle pasifleştirildi)
    db.servisArac.satirlar.find((s) => s.id === 'A2')!.aktif = false
    const z2 = await firmaZincirPasiflestir(db, FIRMA, 'u', SIMDI)
    await firmaPasifSatiriYaz(db, z2.islemId)
    expect(await firmaSonZincirIslemId(db, 'F1')).toBe(z2.islemId)
    const onizleme = await firmaZincirOnizleme(db, 'F1')
    expect(onizleme.zincirIslemId).toBe(z2.islemId)
    expect(onizleme.geriAlinabilirArac).toBe(1) // A1
  })

  it('zincirsiz (eski tip) firma pasifleştirmesi: önizleme boş, zincir kimliği null', async () => {
    const db = kur()
    await firmaPasifSatiriYaz(db, null)
    expect(await firmaSonZincirIslemId(db, 'F1')).toBeNull()
    expect(await firmaZincirOnizleme(db, 'F1')).toEqual({
      zincirIslemId: null, geriAlinabilirArac: 0, geriAlinabilirSofor: 0, kapananAtama: 0,
    })
  })

  it('firma hiç pasifleştirilmemişse önizleme boş', async () => {
    expect((await firmaZincirOnizleme(kur(), 'F1')).zincirIslemId).toBeNull()
  })
})

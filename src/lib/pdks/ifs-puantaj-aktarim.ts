import 'server-only'
import { Prisma } from '@/generated/prisma'
import { prisma } from '@/lib/prisma'
import { aktarimOzetiHesapla, type AktarimGunSatir, type GunDurumKod } from './puantaj-aktarim-ozet'
import { ifsPuantajYaz, type IfsPuantajGirdi } from '@/lib/ifs/puantaj-aktarim'

/**
 * PDKS → IFS puantaj (DEVAM) aktarımı — DB servisi. İK kararı: Hub'da MAAŞ/ÜCRET tutulmaz.
 * Bu servis yalnız devam (gün/saat) özetini hesaplar, saklar ve IFS'e devam alanlarını gönderir.
 */

const DONEM = /^\d{4}-\d{2}$/

export interface AktarimSatir {
  personnelId: string
  sicil: string | null
  adSoyad: string
  calismaSaat: number
  fazlaMesaiSaat: number
  geceSaat: number
  normalGun: number
  mesaiGun: number
  haftaTatiliGun: number
  resmiTatilGun: number
  izinGun: number
  raporGun: number
  eksikGun: number
  eksikKayitGun: number
  durum: string
  ifsHata: string | null
  gonderilenAt: string | null
}

function donemAralik(donem: string): { bas: Date; bit: Date } {
  const [y, m] = donem.split('-').map(Number)
  return { bas: new Date(Date.UTC(y, m - 1, 1)), bit: new Date(Date.UTC(y, m, 1)) }
}

/** Gece vardiyası mı: giriş saati çıkıştan büyükse (gece devrilir) ya da kod GECE içerir. */
function geceVardiya(v: { girisSaat: string; cikisSaat: string; kod: string } | null): boolean {
  if (!v) return false
  return v.girisSaat > v.cikisSaat || v.kod.toUpperCase().includes('GECE')
}

const num = (d: unknown): number => (d == null ? 0 : Number(d))

/** Depodaki (kaydedilmiş) satırları okur. */
export async function aktarimOku(donem: string): Promise<{ donem: string; satirlar: AktarimSatir[] }> {
  if (!DONEM.test(donem)) throw new Error('Dönem formatı YYYY-MM olmalı')
  const rows = await prisma.pdksIfsPuantajAktarim.findMany({
    where: { donem },
    orderBy: { adSoyad: 'asc' },
  })
  return {
    donem,
    satirlar: rows.map((r) => ({
      personnelId: r.personnelId,
      sicil: r.sicil,
      adSoyad: r.adSoyad,
      calismaSaat: num(r.calismaSaat),
      fazlaMesaiSaat: num(r.fazlaMesaiSaat),
      geceSaat: num(r.geceSaat),
      normalGun: r.normalGun,
      mesaiGun: r.mesaiGun,
      haftaTatiliGun: r.haftaTatiliGun,
      resmiTatilGun: r.resmiTatilGun,
      izinGun: num(r.izinGun),
      raporGun: num(r.raporGun),
      eksikGun: r.eksikGun,
      eksikKayitGun: r.eksikKayitGun,
      durum: r.durum,
      ifsHata: r.ifsHata,
      gonderilenAt: r.gonderilenAt?.toISOString() ?? null,
    })),
  }
}

/**
 * Dönemi PdksPuantajGun'dan hesaplar ve tabloya yazar (upsert). GONDERILDI satırlar KORUNUR
 * (gönderilmiş veri değişmez; yeniden hesap onları ezmez).
 */
export async function aktarimHesapla(donem: string): Promise<{ donem: string; satirlar: AktarimSatir[] }> {
  if (!DONEM.test(donem)) throw new Error('Dönem formatı YYYY-MM olmalı')
  const { bas, bit } = donemAralik(donem)

  const gunler = await prisma.pdksPuantajGun.findMany({
    where: { gun: { gte: bas, lt: bit } },
    select: {
      personnelId: true,
      gun: true,
      durum: true,
      calismaDakika: true,
      fazlaDakika: true,
      izinPay: true,
      vardiya: { select: { girisSaat: true, cikisSaat: true, kod: true } },
      personnel: { select: { sicilNo: true, adSoyad: true } },
    },
  })

  // Kişi bazında grupla
  const byPid = new Map<string, { sicil: string | null; adSoyad: string; satirlar: AktarimGunSatir[] }>()
  for (const g of gunler) {
    const grp = byPid.get(g.personnelId) ?? { sicil: g.personnel.sicilNo, adSoyad: g.personnel.adSoyad, satirlar: [] }
    grp.satirlar.push({
      gun: g.gun,
      durum: g.durum as GunDurumKod,
      calismaDakika: g.calismaDakika,
      fazlaDakika: g.fazlaDakika,
      izinPay: g.izinPay == null ? null : Number(g.izinPay),
      gece: geceVardiya(g.vardiya),
    })
    byPid.set(g.personnelId, grp)
  }

  // Zaten gönderilmiş kişiler — dokunma
  const gonderilmis = new Set(
    (await prisma.pdksIfsPuantajAktarim.findMany({ where: { donem, durum: 'GONDERILDI' }, select: { personnelId: true } })).map(
      (r) => r.personnelId,
    ),
  )

  for (const [personnelId, grp] of byPid) {
    if (gonderilmis.has(personnelId)) continue
    const o = aktarimOzetiHesapla(grp.satirlar)
    const veri = {
      sicil: grp.sicil,
      adSoyad: grp.adSoyad,
      calismaSaat: o.calismaSaat,
      fazlaMesaiSaat: o.fazlaMesaiSaat,
      geceSaat: o.geceSaat,
      normalGun: o.normalGun,
      mesaiGun: o.mesaiGun,
      haftaTatiliGun: o.haftaTatiliGun,
      resmiTatilGun: o.resmiTatilGun,
      izinGun: o.izinGun,
      raporGun: o.raporGun,
      eksikGun: o.eksikGun,
      eksikKayitGun: o.eksikKayitGun,
      detayJson: o.gunler as unknown as Prisma.InputJsonValue,
    }
    await prisma.pdksIfsPuantajAktarim.upsert({
      where: { donem_personnelId: { donem, personnelId } },
      create: { donem, personnelId, durum: 'HAZIR', ...veri },
      update: { durum: 'HAZIR', ifsHata: null, hesaplananAt: new Date(), ...veri },
    })
  }

  return aktarimOku(donem)
}

/**
 * Seçili (ya da tüm HAZIR) satırları IFS'e gönderir — yalnız devam alanları. Para gönderilmez.
 * IFS yazımı kapalıysa (env) net hata satır bazında saklanır; canlı bordroya yanlış kayıt düşmez.
 */
export async function aktarimGonder(
  donem: string,
  personnelIds: string[] | null,
  gonderenId: string | null,
): Promise<{ donem: string; gonderilen: number; hatali: number; satirlar: AktarimSatir[] }> {
  if (!DONEM.test(donem)) throw new Error('Dönem formatı YYYY-MM olmalı')

  const rows = await prisma.pdksIfsPuantajAktarim.findMany({
    where: {
      donem,
      durum: { not: 'GONDERILDI' },
      ...(personnelIds && personnelIds.length ? { personnelId: { in: personnelIds } } : {}),
    },
  })

  let gonderilen = 0
  let hatali = 0
  for (const r of rows) {
    if (!r.sicil) {
      await prisma.pdksIfsPuantajAktarim.update({
        where: { id: r.id },
        data: { durum: 'HATA', ifsHata: 'Sicil (IFS EmpNo) boş — IFS\'e gönderilemez' },
      })
      hatali++
      continue
    }
    const girdi: IfsPuantajGirdi = {
      empNo: r.sicil,
      donem,
      calismaSaat: num(r.calismaSaat),
      fazlaMesaiSaat: num(r.fazlaMesaiSaat),
      geceSaat: num(r.geceSaat),
      normalGun: r.normalGun,
      haftaTatiliGun: r.haftaTatiliGun,
      resmiTatilGun: r.resmiTatilGun,
      izinGun: num(r.izinGun),
      raporGun: num(r.raporGun),
      eksikGun: r.eksikGun,
    }
    try {
      await ifsPuantajYaz(girdi)
      await prisma.pdksIfsPuantajAktarim.update({
        where: { id: r.id },
        data: { durum: 'GONDERILDI', ifsHata: null, gonderilenAt: new Date(), gonderenId },
      })
      gonderilen++
    } catch (e) {
      await prisma.pdksIfsPuantajAktarim.update({
        where: { id: r.id },
        data: { durum: 'HATA', ifsHata: e instanceof Error ? e.message.slice(0, 500) : 'Bilinmeyen hata' },
      })
      hatali++
    }
  }

  return { ...(await aktarimOku(donem)), gonderilen, hatali }
}

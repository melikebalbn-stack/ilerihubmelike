import 'server-only'
import { prisma } from '@/lib/prisma'
import { getUserPermissions } from '@/lib/auth/get-user-permissions'
import { bugunStr, gunuHesapla } from '@/lib/pdks/puantaj-servis'
import type { DefterSatiri, IzinHareketTuru } from './bakiye'
import { GECIS_TARIHI_AYARI, YILLIK_KOD } from './acilis-import'
import { GUN, IzinGirdiHatasi, gunEkle } from './gun-sayimi'
import type { MailTalep } from './mail'
import type { TurKurali } from './talep-kurallari'

/** İzin Faz 3 — talep ve onay servislerinin ortak yardımcıları (DB). */

export const TALEP_ACIK_AYARI = 'izin_talep_acik'
export const BEKLEYEN_DURUMLAR = ['BEKLIYOR_YONETICI', 'BEKLIYOR_IV'] as const
export const g = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null)
export const dbGun = (s: string) => new Date(`${s}T00:00:00Z`)

export interface Baglam {
  userId: string
  personnelId: string | null
  ivMi: boolean
  bakiyeAdmin: boolean
}

export async function baglam(userId: string): Promise<Baglam> {
  const [u, izinler] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { personnelId: true } }),
    getUserPermissions(userId),
  ])
  return { userId, personnelId: u?.personnelId ?? null, ivMi: izinler.has('izin.admin'), bakiyeAdmin: izinler.has('izin.bakiye.admin') }
}

/** SystemSetting izin_talep_acik = 'true' iken talep/onay menüleri ve ekranları açık (canlıya geçişte açılır). */
export async function talepAcikMi(): Promise<boolean> {
  const a = await prisma.systemSetting.findUnique({ where: { key: TALEP_ACIK_AYARI }, select: { value: true } })
  return a?.value?.trim() === 'true'
}

export async function gecisTarihi(): Promise<string | null> {
  const a = await prisma.systemSetting.findUnique({ where: { key: GECIS_TARIHI_AYARI }, select: { value: true } })
  return a?.value && GUN.test(a.value) ? a.value : null
}

export async function tatilHaritasi(bas: string, bit: string) {
  const ts = await prisma.iproTatil.findMany({ where: { tarih: { gte: dbGun(bas), lte: dbGun(bit) } }, select: { tarih: true, tip: true, aciklama: true } })
  return new Map(ts.map((t) => [g(t.tarih)!, { tip: t.tip, aciklama: t.aciklama }]))
}

export const TUR_SEC = {
  id: true, kod: true, ad: true, bakiyeli: true, sabitGun: true, gunSayimi: true, yarimGunOlur: true, onayAkisi: true,
  ozelNitelikli: true, belgeZorunlu: true, kosul: true, aktif: true, sira: true, pdksEtiketi: true,
  birim: true, yillikKotaDakika: true, yakaKisiti: true,
} as const

/** Faz 4 ayarları (İV teyidi bekleyen varsayılanlar): sabit izinde tatil sayılmaz; mazeret dönemi takvim yılı; belge 15 yıl. */
export async function izinAyarlari() {
  const rs = await prisma.systemSetting.findMany({
    where: { key: { in: ['izin_sabit_tatil_sayilir', 'izin_mazeret_donem', 'izin_belge_saklama_yil'] } },
    select: { key: true, value: true },
  })
  const a = new Map(rs.map((r) => [r.key, r.value.trim()]))
  return {
    sabitTatilSayilir: a.get('izin_sabit_tatil_sayilir') === 'true',
    mazeretDonem: a.get('izin_mazeret_donem') || 'TAKVIM_YILI',
    belgeSaklamaYil: Number(a.get('izin_belge_saklama_yil')) || 15,
  }
}

/** Saatlik türde dönem kullanımı (dk): bekleyen + onaylı talepler (haric: hesaplanan talebin kendisi). */
export async function saatKullanimi(personnelId: string, turId: string, bas: string, bit: string, haricTalepId?: string) {
  const ts = await prisma.izinTalep.findMany({
    where: {
      personnelId, turId, durum: { in: [...BEKLEYEN_DURUMLAR, 'ONAYLANDI'] }, baslangic: { gte: dbGun(bas), lte: dbGun(bit) },
      ...(haricTalepId ? { id: { not: haricTalepId } } : {}),
    },
    select: { dakika: true },
  })
  return ts.reduce((t, x) => t + (x.dakika ?? 0), 0)
}

export async function turGetir(turId: string): Promise<TurKurali & { id: string }> {
  const t = await prisma.izinTuru.findUnique({ where: { id: turId }, select: TUR_SEC })
  if (!t) throw new IzinGirdiHatasi('İzin türü bulunamadı')
  return t
}

/** Yıllık izin defteri + bekleyen yıllık taleplerin günleri (haric: hesaplanan talebin kendisi). */
export async function yillikDurum(personnelId: string, haricTalepId?: string) {
  const tur = await prisma.izinTuru.findUnique({ where: { kod: YILLIK_KOD }, select: { id: true } })
  if (!tur) throw new IzinGirdiHatasi('YILLIK izin türü tanımlı değil')
  const [defter, bekleyen] = await Promise.all([
    prisma.izinBakiyeHareketi.findMany({ where: { personnelId, turId: tur.id }, select: { hareket: true, gun: true, tarih: true } }),
    prisma.izinTalep.findMany({
      where: { personnelId, turId: tur.id, durum: { in: [...BEKLEYEN_DURUMLAR] }, ...(haricTalepId ? { id: { not: haricTalepId } } : {}) },
      select: { gunSayisi: true },
    }),
  ])
  const d: DefterSatiri[] = defter.map((x) => ({ hareket: x.hareket as IzinHareketTuru, gun: Number(x.gun), tarih: g(x.tarih)! }))
  const bakiye = d.reduce((t, x) => t + Math.round(x.gun * 2), 0) / 2
  return { turId: tur.id, defter: d, bakiye, bekleyen: bekleyen.map((b) => Number(b.gunSayisi)) }
}

/** Kişinin [bas, bit] ile çakışan AKTİF (bekleyen/onaylı) talebi var mı */
export async function cakisanTalep(
  personnelId: string, bas: string, bit: string, haricTalepId?: string,
  o: { raporMu?: boolean; saat?: { bas: string; bit: string } } = {},
) {
  return prisma.izinTalep.findFirst({
    where: {
      personnelId, durum: { in: [...BEKLEYEN_DURUMLAR, 'ONAYLANDI'] }, baslangic: { lte: dbGun(bit) }, bitis: { gte: dbGun(bas) },
      ...(haricTalepId ? { id: { not: haricTalepId } } : {}),
      // Faz 4: RAPOR onaylı YILLIK izinle çakışabilir (İV onayında çakışan yıllık günleri iade edilir)
      ...(o.raporMu ? { NOT: { tur: { kod: 'YILLIK' } } } : {}),
      // Saatlik talep: aynı günün ÇAKIŞAN saatli talebi ya da günlük izin çakışır; ayrık saatler çakışmaz
      ...(o.saat
        ? { OR: [{ dakika: null }, { AND: [{ baslangicSaat: { lt: o.saat.bit } }, { bitisSaat: { gt: o.saat.bas } }] }] }
        : {}),
    },
    select: { id: true, baslangic: true, bitis: true },
  })
}

export async function mailTalebi(talepId: string): Promise<MailTalep & { personnelId: string; calisanUserId: string | null; onaycilar: (string | null)[]; durum: string }> {
  const t = await prisma.izinTalep.findUniqueOrThrow({
    where: { id: talepId },
    select: {
      id: true, baslangic: true, bitis: true, gunSayisi: true, durum: true, personnelId: true, onayci1Id: true, onayci2Id: true, onayci3Id: true,
      tur: { select: { ad: true } },
      personnel: { select: { adSoyad: true, sicilNo: true, user: { select: { id: true } } } },
    },
  })
  return {
    id: t.id, personelAd: t.personnel.adSoyad, sicil: t.personnel.sicilNo, turAd: t.tur.ad, baslangic: g(t.baslangic)!, bitis: g(t.bitis)!,
    gunSayisi: Number(t.gunSayisi), personnelId: t.personnelId, calisanUserId: t.personnel.user?.id ?? null,
    onaycilar: [t.onayci1Id, t.onayci2Id, t.onayci3Id], durum: t.durum,
  }
}

/**
 * Onay / iptal sonrası PDKS puantajının ilgili günlerini yeniden hesaplar (bugüne kadarki günler; ileri
 * tarihler cron'la hesaplanır). Kilitli gün atlanır → çağırana uyarı olarak döner.
 */
export async function puantajYenidenHesapla(personnelId: string, bas: string, bit: string) {
  const bugun = bugunStr()
  const son = bit < bugun ? bit : bugun
  const kilitli: string[] = []
  let hesaplanan = 0
  for (let d = bas; d <= son; d = gunEkle(d, 1)) {
    try {
      const r = await gunuHesapla(prisma, d, { personelIdleri: [personnelId] })
      hesaplanan += r.yazilan
      if (r.kilitliAtlanan) kilitli.push(d)
    } catch (e) {
      console.error(`[izin] puantaj yeniden hesap ${d}`, e)
    }
  }
  return { hesaplanan, kilitli }
}

/** Kişinin ekibi (onay ekranı + takvim noktası): aynı departmandaki aktif kişiler (kendisi hariç). */
export async function ekipKisileri(personnelId: string) {
  const p = await prisma.personnel.findUnique({ where: { id: personnelId }, select: { departmentId: true } })
  if (!p?.departmentId) return []
  return prisma.personnel.findMany({
    where: { departmentId: p.departmentId, aktif: true, id: { not: personnelId } },
    orderBy: { adSoyad: 'asc' },
    select: { id: true, adSoyad: true },
    take: 60,
  })
}

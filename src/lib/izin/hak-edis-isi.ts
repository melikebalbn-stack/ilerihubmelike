/**
 * Günlük yıldönümü hak ediş işi (plan §3.1, §7 Faz 2) — /api/cron/izin-hak-edis.
 *
 * - GEÇİŞ TARİHİ (SystemSetting izin_gecis_tarihi) yoksa HİÇBİR ŞEY YAZMAZ: açılış bakiyesi yüklenmeden
 *   otomatik hak ediş başlarsa İV Excel'indeki bakiyeyle çift sayılır. Ayar açılış import apply'ında yazılır.
 * - Geçiş tarihine kadarki (dahil) yıldönümleri Excel'de sayılmış kabul edilir (hakEdisleri.acilisTarihi).
 * - Pencere: [bugün − geriGun, bugün] — cron bir gün kaçırsa da sonraki tur yakalar. Satır anahtarı
 *   HAK:<personel>:<yıl> tekil → iki kez çalışsa da çift yazmaz (createMany skipDuplicates).
 * - Yalnız AKTİF personel (ayrılan kişiye ayrılış sonrası yıldönümü yazılmaz).
 * - Doğum tarihi yalnız süre hesabında kullanılır; log/yanıt/denetimde YAŞ YOK.
 *
 * '@/lib/prisma' İMPORT ETMEZ (test edilebilir); DB istemcisi parametre.
 */
import type { PrismaClient } from '../../generated/prisma'
import { GECIS_TARIHI_AYARI, YILLIK_KOD } from './acilis-import'
import { GUN, IzinGirdiHatasi, gunEkle } from './gun-sayimi'
import { hakEdisleri, type CalismaDonemi, type HakEdis } from './hak-edis'

export interface HakEdisKisi {
  personnelId: string
  iseGirisTarihi: string
  donemler: CalismaDonemi[]
  dogumTarihi: string | null
  acilisTarihi: string | null
}

/** SAF: pencereye düşen hak edişler. Geçiş tarihinden önce/aynı gün başlayan pencere geçişin ertesine kırpılır. */
export function hakEdisPlani(kisiler: HakEdisKisi[], o: { bugun: string; geriGun: number; gecisTarihi: string }): (HakEdis & { personnelId: string })[] {
  if (!GUN.test(o.bugun) || !GUN.test(o.gecisTarihi)) throw new IzinGirdiHatasi('Tarihler YYYY-MM-DD olmalı')
  const pencere = gunEkle(o.bugun, -Math.max(0, o.geriGun))
  const ertesi = gunEkle(o.gecisTarihi, 1)
  const bas = pencere > ertesi ? pencere : ertesi
  if (bas > o.bugun) return []
  const sonuc: (HakEdis & { personnelId: string })[] = []
  for (const k of kisiler) {
    const acilis = k.acilisTarihi && k.acilisTarihi > o.gecisTarihi ? k.acilisTarihi : o.gecisTarihi
    for (const h of hakEdisleri({ personnelId: k.personnelId, iseGirisTarihi: k.iseGirisTarihi, donemler: k.donemler, dogumTarihi: k.dogumTarihi, acilisTarihi: acilis, bas, bit: o.bugun })) {
      if (h.gun > 0) sonuc.push({ ...h, personnelId: k.personnelId })
    }
  }
  return sonuc
}

type Db = Pick<PrismaClient, 'personnel' | 'personnelSensitive' | 'izinTuru' | 'izinBakiyeHareketi' | 'systemSetting' | 'permissionAuditLog'>

const g = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null)

export async function hakEdisIsi(db: Db, o: { bugun: string; geriGun: number; dryRun: boolean; aktorId: string }) {
  const ayar = await db.systemSetting.findUnique({ where: { key: GECIS_TARIHI_AYARI }, select: { value: true } })
  if (!ayar || !GUN.test(ayar.value)) return { calisti: false as const, sebep: 'geçiş tarihi ayarlı değil (açılış bakiyesi yüklenmedi)' }
  const tur = await db.izinTuru.findUnique({ where: { kod: YILLIK_KOD }, select: { id: true } })
  if (!tur) throw new IzinGirdiHatasi('YILLIK izin türü tanımlı değil')

  const [ps, hassas, acilis] = await Promise.all([
    db.personnel.findMany({
      where: { aktif: true },
      select: { id: true, iseGirisTarihi: true, employmentPeriods: { select: { girisTarihi: true, cikisTarihi: true } } },
    }),
    db.personnelSensitive.findMany({ where: { personnel: { aktif: true }, dogumTarihi: { not: null } }, select: { personnelId: true, dogumTarihi: true } }),
    db.izinBakiyeHareketi.findMany({ where: { hareket: 'ACILIS', turId: tur.id }, select: { personnelId: true, tarih: true } }),
  ])
  const dogum = new Map(hassas.map((h) => [h.personnelId, g(h.dogumTarihi)]))
  const acilisT = new Map(acilis.map((a) => [a.personnelId, g(a.tarih)]))
  const kisiler: HakEdisKisi[] = ps.map((p) => ({
    personnelId: p.id,
    iseGirisTarihi: g(p.iseGirisTarihi)!,
    donemler: p.employmentPeriods.map((d) => ({ giris: g(d.girisTarihi)!, cikis: g(d.cikisTarihi) })),
    dogumTarihi: dogum.get(p.id) ?? null,
    acilisTarihi: acilisT.get(p.id) ?? null,
  }))
  const plan = hakEdisPlani(kisiler, { bugun: o.bugun, geriGun: o.geriGun, gecisTarihi: ayar.value })
  if (o.dryRun) return { calisti: true as const, dryRun: true, gecisTarihi: ayar.value, aday: plan.length, yazilan: 0, toplamGun: plan.reduce((t, h) => t + h.gun, 0) }

  const r = plan.length
    ? await db.izinBakiyeHareketi.createMany({
        data: plan.map((h) => ({
          personnelId: h.personnelId,
          turId: tur.id,
          hareket: 'HAK_EDIS' as const,
          gun: h.gun,
          tarih: new Date(`${h.tarih}T00:00:00Z`),
          aciklama: `${h.kidemYil}. yıl hak edişi`,
          olusturanId: o.aktorId,
          anahtar: h.anahtar,
        })),
        skipDuplicates: true,
      })
    : { count: 0 }
  if (r.count > 0) {
    await db.permissionAuditLog.create({
      data: { action: 'IZIN_HAK_EDIS_YAZILDI', actorId: o.aktorId, targetType: 'IZIN_BAKIYE', targetId: '', details: { bugun: o.bugun, geriGun: o.geriGun, aday: plan.length, yazilan: r.count } },
    })
  }
  return { calisti: true as const, dryRun: false, gecisTarihi: ayar.value, aday: plan.length, yazilan: r.count, toplamGun: plan.reduce((t, h) => t + h.gun, 0) }
}

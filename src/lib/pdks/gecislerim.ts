import 'server-only'
import { prisma } from '@/lib/prisma'
import { kartNoGoster } from './kart-no'
import { bugunStr, dbGun, gunEkle, gunuHesapla } from './puantaj-servis'
import { yerel } from './puantaj-motor'

/**
 * /pdks/gecislerim — oturum açmış kişinin YALNIZ KENDİ verisi (User.personnelId). Bugün canlı hesaplanır
 * (DB'ye yazılmaz); son 7 gün kayıtlı puantajdan, kaydı olmayan gün canlı hesaplanır.
 * SystemSetting pdks_gecislerim_acik != 'true' iken ekran kapalı ve menüde görünmez.
 */
export const GECISLERIM_ANAHTARI = 'pdks_gecislerim_acik'

export async function gecislerimAcikMi(): Promise<boolean> {
  const a = await prisma.systemSetting.findUnique({ where: { key: GECISLERIM_ANAHTARI }, select: { value: true } })
  return a?.value?.trim() === 'true'
}

export async function gecislerim(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { personnelId: true } })
  if (!u?.personnelId) return { bagli: false as const }
  const pid = u.personnelId
  const bugun = bugunStr()

  const [canli, kayitli, olaylar, kart] = await Promise.all([
    gunuHesapla(prisma, bugun, { personelIdleri: [pid], kaydet: false }),
    prisma.pdksPuantajGun.findMany({
      where: { personnelId: pid, gun: { gte: dbGun(gunEkle(bugun, -7)), lt: dbGun(bugun) } },
      select: { gun: true, durum: true, ilkGiris: true, sonCikis: true, gecDakika: true, erkenCikisDakika: true, calismaDakika: true, girisKaynak: true, cikisKaynak: true },
    }),
    prisma.pdksGecis.findMany({
      where: { personnelId: pid, olayZamani: { gte: yerel(bugun, '00:00'), lt: yerel(bugun, '00:00', 1) }, olayTipi: { in: ['GECERLI_KART', 'PASIF_KART', 'YETKISIZ'] } },
      orderBy: { olayZamani: 'asc' },
      select: { olayZamani: true, yon: true, olayTipi: true, kapiNo: true },
    }),
    prisma.pdksKart.findFirst({ where: { personnelId: pid, durum: 'AKTIF' }, select: { kartNoHam: true } }),
  ])
  const iso = (d: Date | null) => d?.toISOString() ?? null
  const gunler: { gun: string; durum: string; ilkGiris: string | null; sonCikis: string | null; gecDakika: number; erkenCikisDakika: number; calismaDakika: number | null; formla: boolean }[] = []
  for (let i = 1; i <= 7; i++) {
    const g = gunEkle(bugun, -i)
    const k = kayitli.find((x) => x.gun.toISOString().slice(0, 10) === g)
    if (k) {
      gunler.push({ gun: g, durum: k.durum, ilkGiris: iso(k.ilkGiris), sonCikis: iso(k.sonCikis), gecDakika: k.gecDakika, erkenCikisDakika: k.erkenCikisDakika, calismaDakika: k.calismaDakika, formla: k.girisKaynak === 'FORM' || k.cikisKaynak === 'FORM' })
      continue
    }
    const s = (await gunuHesapla(prisma, g, { personelIdleri: [pid], kaydet: false })).sonuclar[0]?.sonuc
    if (s) gunler.push({ gun: g, durum: s.durum, ilkGiris: iso(s.ilkGiris), sonCikis: iso(s.sonCikis), gecDakika: s.gecDakika, erkenCikisDakika: s.erkenCikisDakika, calismaDakika: s.calismaDakika, formla: s.durum === 'TAM_FORMLA' })
  }
  const b = canli.sonuclar[0]?.sonuc ?? null
  return {
    bagli: true as const,
    kart: kart?.kartNoHam ? kartNoGoster(kart.kartNoHam) : null,
    bugun: b
      ? { gun: bugun, durum: b.durum, ilkGiris: iso(b.ilkGiris), sonCikis: iso(b.sonCikis), gecDakika: b.gecDakika, beklenenBaslangic: iso(b.beklenenBaslangic), beklenenBitis: iso(b.beklenenBitis), uyarilar: b.uyarilar }
      : null,
    bugunOlaylar: olaylar.map((o) => ({ zaman: o.olayZamani.toISOString(), yon: o.yon, tip: o.olayTipi })),
    gunler,
  }
}

import 'server-only'
import { prisma } from '@/lib/prisma'
import { getManagedPersonnelIds } from '@/lib/onay/yonetici-cozumu'
import { bugunStr } from '@/lib/pdks/puantaj-servis'
import { ekipIzinGunu, type EkipIzinGunu } from './gorunum'
import { IzinGirdiHatasi, IzinYetkiHatasi, gunEkle, izinGunleri } from './gun-sayimi'
import { BEKLEYEN_DURUMLAR, dbGun, g, tatilHaritasi, type Baglam } from './talep-ortak'

/**
 * İzin Faz 5 — Ekip Takvimi (kişi × gün, aylık). Erişim: yönetici YALNIZ kendi ekibi (onay modülündeki ekip:
 * sorumlu1-3Id FK + ad eşleşmesi), İV (izin.admin) tüm departmanlar. Çalışan GÖRMEZ (403).
 * Yanıtta izin TÜRÜ, bakiye, rapor bilgisi YOK — her hücre gorunum.ekipIzinGunu'dan geçer; hücre metni yalnız
 * "İzinli" / "Yarım gün izinli" / "Onay bekliyor" / tatil adı / "Hafta sonu".
 */

export type Hucre = 'IZINLI' | 'YARIM' | 'BEKLIYOR' | 'TATIL' | 'YARIM_TATIL' | 'HAFTA_SONU' | 'BOS'
const HUCRE_METNI: Record<'IZINLI' | 'YARIM' | 'BEKLIYOR', string> = { IZINLI: 'İzinli', YARIM: 'Yarım gün izinli', BEKLIYOR: 'Onay bekliyor' }
const GUN_KISA = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct']

export function ayAraligi(ay: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ay)) throw new IzinGirdiHatasi('Ay YYYY-MM olmalı')
  const bas = `${ay}-01`
  return { bas, bit: gunEkle(`${gunEkle(bas, 32).slice(0, 7)}-01`, -1) }
}

/**
 * SAF tablo kurucu. `izinGunleri`: ekipIzinGunu çıktıları (ay dışı günler atılır → ayı aşan izin kırpılır).
 * Öncelik: tatil / hafta sonu (gri) > izin hücresi; yarım tatil (arefe) günü izinsizse YARIM_TATIL (açık gri).
 */
export function takvimTablosu(o: {
  bas: string
  bit: string
  bugun: string
  kisiler: { id: string; ad: string }[]
  tatiller: ReadonlyMap<string, { tip: string; aciklama: string | null }>
  izinGunleri: EkipIzinGunu[]
}) {
  const gunler: { tarih: string; gun: string; kapali: boolean; tatil: string | null }[] = []
  for (let d = o.bas; d <= o.bit; d = gunEkle(d, 1)) {
    const hg = new Date(`${d}T12:00:00Z`).getUTCDay()
    const t = o.tatiller.get(d)
    const tatil = t && t.tip !== 'MESAI' ? t : null
    gunler.push({ tarih: d, gun: GUN_KISA[hg], kapali: hg === 0 || hg === 6 || tatil?.tip === 'TATIL', tatil: tatil?.aciklama ?? null })
  }
  const izin = new Map<string, EkipIzinGunu>()
  for (const e of o.izinGunleri) if (e.tarih >= o.bas && e.tarih <= o.bit) izin.set(`${e.personnelId}|${e.tarih}`, e)

  const satirlar = o.kisiler.map((k) => ({
    personnelId: k.id,
    ad: k.ad,
    hucreler: gunler.map((d): { h: Hucre; title: string } => {
      const hg = new Date(`${d.tarih}T12:00:00Z`).getUTCDay()
      const tt = o.tatiller.get(d.tarih)
      if (tt?.tip === 'TATIL') return { h: 'TATIL', title: tt.aciklama ?? 'Tatil' }
      if (hg === 0 || hg === 6) return { h: 'HAFTA_SONU', title: 'Hafta sonu' }
      const e = izin.get(`${k.id}|${d.tarih}`)
      if (e) {
        const h = e.durum === 'BEKLIYOR' ? 'BEKLIYOR' : e.yarim ? 'YARIM' : 'IZINLI'
        return { h, title: HUCRE_METNI[h] }
      }
      if (tt?.tip === 'YARIM') return { h: 'YARIM_TATIL', title: tt.aciklama ?? 'Yarım gün' }
      return { h: 'BOS', title: '' }
    }),
  }))

  // Özet: bugün izinli (bekleyen hariç) / ekip; ayın en yoğun günü (izinli + bekleyen kişi sayısı)
  const sayim = new Map<string, number>()
  let bugunIzinli = 0
  for (const s of satirlar) {
    s.hucreler.forEach((c, i) => {
      if (c.h === 'IZINLI' || c.h === 'YARIM' || c.h === 'BEKLIYOR') sayim.set(gunler[i].tarih, (sayim.get(gunler[i].tarih) ?? 0) + 1)
      if (gunler[i].tarih === o.bugun && (c.h === 'IZINLI' || c.h === 'YARIM')) bugunIzinli++
    })
  }
  let enYogun: { tarih: string; kisi: number } | null = null
  for (const [tarih, kisi] of sayim) if (!enYogun || kisi > enYogun.kisi || (kisi === enYogun.kisi && tarih < enYogun.tarih)) enYogun = { tarih, kisi }
  const bugunAyda = o.bugun >= o.bas && o.bugun <= o.bit
  return { gunler, satirlar, ozet: { bugunIzinli: bugunAyda ? bugunIzinli : null, ekip: satirlar.length, enYogun } }
}

/** Yöneticinin ekibi: onay modülündeki liste (ad eşleşmesi) + sorumlu1-3Id FK. */
export async function yoneticiEkibi(personnelId: string | null): Promise<string[]> {
  if (!personnelId) return []
  const [adla, fk] = await Promise.all([
    getManagedPersonnelIds(personnelId),
    prisma.personnel.findMany({ where: { aktif: true, OR: [{ sorumlu1Id: personnelId }, { sorumlu2Id: personnelId }, { sorumlu3Id: personnelId }] }, select: { id: true } }),
  ])
  return [...new Set([...adla, ...fk.map((x) => x.id)])]
}

export async function ekipTakvimi(ctx: Baglam, o: { ay: string; departmentId?: string | null }) {
  const { bas, bit } = ayAraligi(o.ay)
  let kisiFiltre: { id?: { in: string[] }; departmentId?: string }
  let departmanlar: { id: string; name: string }[] | null = null
  let secili: string | null = null
  if (ctx.ivMi) {
    departmanlar = await prisma.departmentDefinition.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } })
    if (o.departmentId && !departmanlar.some((d) => d.id === o.departmentId)) throw new IzinGirdiHatasi('Departman bulunamadı')
    if (!o.departmentId) {
      const kendi = ctx.personnelId ? await prisma.personnel.findUnique({ where: { id: ctx.personnelId }, select: { departmentId: true } }) : null
      secili = kendi?.departmentId && departmanlar.some((d) => d.id === kendi.departmentId) ? kendi.departmentId : departmanlar[0]?.id ?? null
    } else secili = o.departmentId
    kisiFiltre = secili ? { departmentId: secili } : { id: { in: [] } }
  } else {
    // Yönetici: departmentId parametresi YOK SAYILIR — yalnız kendi ekibi.
    const ekip = await yoneticiEkibi(ctx.personnelId)
    if (!ekip.length) throw new IzinYetkiHatasi('Ekip takvimi yalnız yöneticiler ve İnsan Varlıkları içindir')
    kisiFiltre = { id: { in: ekip } }
  }

  const kisiler = await prisma.personnel.findMany({ where: { aktif: true, ...kisiFiltre }, orderBy: { adSoyad: 'asc' }, select: { id: true, adSoyad: true }, take: 300 })
  const ids = kisiler.map((k) => k.id)
  const [tatiller, talepler, bekleyenTalep] = await Promise.all([
    tatilHaritasi(bas, bit),
    prisma.izinTalep.findMany({
      where: { personnelId: { in: ids }, durum: { in: [...BEKLEYEN_DURUMLAR, 'ONAYLANDI'] }, baslangic: { lte: dbGun(bit) }, bitis: { gte: dbGun(bas) } },
      select: { id: true, personnelId: true, durum: true, baslangic: true, bitis: true, baslangicYarim: true, bitisYarim: true },
    }),
    prisma.izinTalep.count({ where: { personnelId: { in: ids }, durum: { in: [...BEKLEYEN_DURUMLAR] } } }),
  ])
  // Onaylı: DONMUŞ günler (IzinTalepGun); bekleyen: aynı gün sayımıyla anlık. Tür hiçbir yere taşınmaz.
  const onayliIdler = talepler.filter((t) => t.durum === 'ONAYLANDI').map((t) => t.id)
  const donmus = onayliIdler.length
    ? await prisma.izinTalepGun.findMany({ where: { talepId: { in: onayliIdler }, tarih: { gte: dbGun(bas), lte: dbGun(bit) } }, select: { personnelId: true, tarih: true, pay: true, yarim: true } })
    : []
  const tipler = new Map([...tatiller].map(([k, v]) => [k, v.tip]))
  const gunler: EkipIzinGunu[] = []
  for (const d of donmus) {
    const e = ekipIzinGunu({ personnelId: d.personnelId, tarih: d.tarih, yarim: d.yarim, pay: Number(d.pay), talepDurumu: 'ONAYLANDI' })
    if (e) gunler.push(e)
  }
  for (const t of talepler.filter((x) => x.durum !== 'ONAYLANDI')) {
    const r = izinGunleri({ baslangic: g(t.baslangic)!, bitis: g(t.bitis)!, baslangicYarim: t.baslangicYarim, bitisYarim: t.bitisYarim, gunSayimi: 'IS_GUNU', tatiller: tipler })
    for (const d of r.gunler) {
      const e = ekipIzinGunu({ personnelId: t.personnelId, tarih: d.tarih, yarim: d.yarim, pay: d.pay, talepDurumu: t.durum })
      if (e) gunler.push(e)
    }
  }
  const tablo = takvimTablosu({ bas, bit, bugun: bugunStr(), kisiler: kisiler.map((k) => ({ id: k.id, ad: k.adSoyad })), tatiller, izinGunleri: gunler })
  return { ay: o.ay, ...tablo, ozet: { ...tablo.ozet, bekleyenTalep }, departmanlar, departmentId: secili, kapsam: ctx.ivMi ? ('IV' as const) : ('EKIP' as const) }
}

/** Menü: Ekip Takvimi görünür mü (yönetici ya da İV). */
export async function takvimGorurMu(ctx: Baglam) {
  return ctx.ivMi || (await yoneticiEkibi(ctx.personnelId)).length > 0
}

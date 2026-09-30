import 'server-only'
import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit-log'
import { bugunStr } from '@/lib/pdks/puantaj-servis'
import { kullanimHareketi } from './bakiye'
import { kidemSuresi } from './bakiye-ozet'
import { ekipIzinGunu, onayKalemi, type OnayKalemiGirdi } from './gorunum'
import { IzinGirdiHatasi, gunEkle, izinGunleri } from './gun-sayimi'
import { toplulukGirisi } from './hak-edis'
import * as mail from './mail'
import {
  ATLAMA_METNI, bakiyeEtkisi, fmt, kararDogrula, mazeretDonemi, onayYetkisi, saatFmt, saatKotasi, saatlikHesapla, talepHesapla, type Kademe,
} from './talep-kurallari'
import { ekipCakismasi } from './talep-servis'
import {
  BEKLEYEN_DURUMLAR, TUR_SEC, dbGun, ekipKisileri, g, izinAyarlari, mailTalebi, puantajYenidenHesapla, saatKullanimi, tatilHaritasi,
  yillikDurum, type Baglam,
} from './talep-ortak'

/**
 * İzin Faz 3 — Onay Bekleyenler. Yönetici kademesi: talep anında çözülen 3 adaydan biri (resolveApprovers).
 * İV kademesi: izin.admin. KİMSE kendi talebini onaylayamaz. Red gerekçesi zorunlu.
 * GÖRÜNÜRLÜK: yönetici kalemleri gorunum.onayKalemi(…, iv=false) — tür/açıklama YOK; bakiye etkisi de
 * yöneticiye verilmez (yıllık olduğu ele verir). Tür + bakiye yalnız İV kademesinde.
 */

const TALEP_SEC = {
  id: true, personnelId: true, durum: true, baslangic: true, bitis: true, baslangicYarim: true, bitisYarim: true, gunSayisi: true,
  aciklama: true, createdAt: true, onayci1Id: true, onayci2Id: true, onayci3Id: true, talepEdenId: true,
  baslangicSaat: true, bitisSaat: true, dakika: true,
  belgeler: { select: { id: true, orijinalAd: true, mime: true, boyut: true, createdAt: true } },
  tur: { select: TUR_SEC },
  personnel: { select: { adSoyad: true, sicilNo: true, bolum: true, department: { select: { name: true } } } },
  onaylar: { orderBy: { createdAt: 'asc' as const }, select: { kademe: true, karar: true, gerekce: true, onaylayanId: true, createdAt: true } },
} as const

type TalepSatiri = Awaited<ReturnType<typeof talepOku>>
const talepOku = (id: string) => prisma.izinTalep.findUnique({ where: { id }, select: TALEP_SEC })

const sahipsizMi = (t: { onaylar: { karar: string; gerekce: string | null }[] }) =>
  t.onaylar.some((o) => o.karar === 'ATLANDI' && o.gerekce === ATLAMA_METNI.SAHIPSIZ)

async function kalemGirdisi(t: NonNullable<TalepSatiri>): Promise<OnayKalemiGirdi> {
  const talepEden = t.talepEdenId ? await prisma.user.findUnique({ where: { id: t.talepEdenId }, select: { personnelId: true, name: true } }) : null
  return {
    id: t.id, personnelId: t.personnelId, personelAd: t.personnel.adSoyad, sicil: t.personnel.sicilNo,
    bolum: t.personnel.department?.name ?? t.personnel.bolum ?? null, durum: t.durum, baslangic: g(t.baslangic)!, bitis: g(t.bitis)!,
    baslangicYarim: t.baslangicYarim, bitisYarim: t.bitisYarim, gunSayisi: Number(t.gunSayisi), olusturma: t.createdAt.toISOString(),
    sahipsiz: sahipsizMi(t), ekipCakisma: await ekipCakismasi(t.personnelId, g(t.baslangic)!, g(t.bitis)!),
    talepEden: talepEden && talepEden.personnelId !== t.personnelId ? talepEden.name : null,
    turAd: t.tur.ad, aciklama: t.aciklama,
    dakika: t.dakika, baslangicSaat: t.baslangicSaat, bitisSaat: t.bitisSaat,
    belgeler: t.belgeler.map((x) => ({ id: x.id, ad: x.orijinalAd, mime: x.mime, boyut: x.boyut })),
  }
}

// ── Liste ────────────────────────────────────────────────────────────────────

export async function onayListesi(ctx: Baglam, sekme: 'bekleyen' | 'karar') {
  const kendisiHaric = ctx.personnelId ? { personnelId: { not: ctx.personnelId } } : {}
  if (sekme === 'bekleyen') {
    const [yonetici, iv] = await Promise.all([
      prisma.izinTalep.findMany({
        where: { durum: 'BEKLIYOR_YONETICI', OR: [{ onayci1Id: ctx.userId }, { onayci2Id: ctx.userId }, { onayci3Id: ctx.userId }], ...kendisiHaric },
        orderBy: { createdAt: 'asc' }, take: 200, select: TALEP_SEC,
      }),
      ctx.ivMi ? prisma.izinTalep.findMany({ where: { durum: 'BEKLIYOR_IV', ...kendisiHaric }, orderBy: { createdAt: 'asc' }, take: 200, select: TALEP_SEC }) : [],
    ])
    const kalemler = [
      ...(await Promise.all(yonetici.map(async (t) => ({ ...onayKalemi(await kalemGirdisi(t), false), kademe: 'YONETICI' as Kademe })))),
      ...(await Promise.all(iv.map(async (t) => ({ ...onayKalemi(await kalemGirdisi(t), true), kademe: 'IV' as Kademe })))),
    ]
    return { kalemler, ivMi: ctx.ivMi }
  }
  const kararlar = await prisma.izinOnay.findMany({
    where: { onaylayanId: ctx.userId, karar: { in: ['ONAY', 'RED'] } },
    orderBy: { createdAt: 'desc' }, take: 100,
    select: { kademe: true, karar: true, gerekce: true, createdAt: true, talep: { select: TALEP_SEC } },
  })
  const kalemler = await Promise.all(
    kararlar.map(async (k) => ({
      ...onayKalemi(await kalemGirdisi(k.talep), k.kademe === 'IV' && ctx.ivMi),
      kademe: k.kademe as Kademe,
      kararim: { karar: k.karar, not: k.gerekce, zaman: k.createdAt.toISOString() },
    })),
  )
  return { kalemler, ivMi: ctx.ivMi }
}

// ── Detay ────────────────────────────────────────────────────────────────────

export async function onayDetay(ctx: Baglam, id: string) {
  const t = await talepOku(id)
  if (!t) throw new IzinGirdiHatasi('Talep bulunamadı')
  const yetki = onayYetkisi(t, { userId: ctx.userId, personnelId: ctx.personnelId, ivMi: ctx.ivMi })
  const kararVerdi = t.onaylar.some((o) => o.onaylayanId === ctx.userId && o.karar !== 'ATLANDI')
  const ivKararVerdi = t.onaylar.some((o) => o.onaylayanId === ctx.userId && o.kademe === 'IV')
  if ('hata' in yetki && !kararVerdi && !ctx.ivMi) throw new IzinGirdiHatasi('Bu talebi görme yetkiniz yok')
  // İV görünümü: izin.admin + (İV kademesinde bekliyor ya da İV olarak karar verdi ya da yönetici değil)
  const ivGorunum = ctx.ivMi && ('kademe' in yetki ? yetki.kademe === 'IV' : ivKararVerdi || !kararVerdi)

  const p = await prisma.personnel.findUniqueOrThrow({
    where: { id: t.personnelId },
    select: { iseGirisTarihi: true, kidemBaslangici: true, employmentPeriods: { select: { girisTarihi: true, cikisTarihi: true } } },
  })
  // Gösterim kıdemi: İV override (kidemBaslangici) varsa o, yoksa topluluğa giriş (en eski dönem).
  // Hak ediş bundan bağımsız; daima son işe giriş tarihinden.
  const bas = g(p.kidemBaslangici) || toplulukGirisi(p.employmentPeriods.map((d) => ({ giris: g(d.girisTarihi)!, cikis: g(d.cikisTarihi) })), g(p.iseGirisTarihi)!)
  const kidem = kidemSuresi(bas, bugunStr())
  const kalem = onayKalemi(await kalemGirdisi(t), ivGorunum)

  let bakiye: { once: number; sonra: number; yeterli: boolean } | null = null
  if (ivGorunum && t.tur.bakiyeli) {
    const yd = await yillikDurum(t.personnelId, t.id)
    const e = bakiyeEtkisi(t.tur, { bakiye: yd.bakiye, bekleyen: yd.bekleyen, talep: Number(t.gunSayisi) })!
    bakiye = { once: e.kalan, sonra: e.sonrasi, yeterli: e.yeterli }
  }
  return {
    kalem,
    kidem: kidem.yil >= 1 ? `${kidem.yil} yıl` : `${kidem.ay} ay`,
    kademe: 'kademe' in yetki ? yetki.kademe : null,
    islemYapabilir: 'kademe' in yetki,
    engel: 'hata' in yetki ? yetki.hata : null,
    bakiye,
    onayAdimlari: t.onaylar.map((o) => ({ kademe: o.kademe, karar: o.karar, zaman: o.createdAt.toISOString(), gerekce: o.karar === 'ATLANDI' ? o.gerekce : null })),
    ekipTablosu: await ekipTablosu(t.personnelId, t.personnel.adSoyad, g(t.baslangic)!, g(t.bitis)!, t),
  }
}

/**
 * "Ekibin o günleri" — talep aralığının iş günleri (en çok 10) × ekip. Hücre: İzinli / Bekliyor / Yarım / Tatil.
 * TÜR YOK (ekipIzinGunu). Talep sahibinin satırı "Talep".
 */
async function ekipTablosu(personnelId: string, ad: string, bas: string, bit: string, t: { baslangicYarim: string | null; bitisYarim: string | null }) {
  const tatil = await tatilHaritasi(bas, gunEkle(bas, 30))
  const tipler = new Map([...tatil].map(([k, v]) => [k, v.tip]))
  const gunler: { tarih: string; tatil: string | null }[] = []
  for (let d = bas; d <= bit && gunler.length < 10; d = gunEkle(d, 1)) {
    const hg = new Date(`${d}T12:00:00Z`).getUTCDay()
    if (hg === 0 || hg === 6) continue
    const tt = tatil.get(d)
    gunler.push({ tarih: d, tatil: tt && tt.tip !== 'MESAI' ? tt.tip : null })
  }
  if (!gunler.length) return { gunler: [], satirlar: [] }
  const son = gunler.at(-1)!.tarih
  const ekip = await ekipKisileri(personnelId)
  const ts = await prisma.izinTalep.findMany({
    where: { personnelId: { in: ekip.map((e) => e.id) }, durum: { in: [...BEKLEYEN_DURUMLAR, 'ONAYLANDI'] }, baslangic: { lte: dbGun(son) }, bitis: { gte: dbGun(bas) } },
    select: { personnelId: true, durum: true, baslangic: true, bitis: true, baslangicYarim: true, bitisYarim: true },
  })
  const hucre = new Map<string, { durum: 'IZINLI' | 'BEKLIYOR'; yarim: boolean }>()
  for (const x of ts) {
    const r = izinGunleri({ baslangic: g(x.baslangic)!, bitis: g(x.bitis)!, baslangicYarim: x.baslangicYarim as never, bitisYarim: x.bitisYarim as never, gunSayimi: 'IS_GUNU', tatiller: tipler })
    for (const d of r.gunler) {
      const e = ekipIzinGunu({ personnelId: x.personnelId, tarih: d.tarih, yarim: d.yarim, pay: d.pay, talepDurumu: x.durum })
      if (e) hucre.set(`${e.personnelId}|${e.tarih}`, { durum: e.durum, yarim: e.yarim })
    }
  }
  const kendi = izinGunleri({ baslangic: bas, bitis: bit, baslangicYarim: t.baslangicYarim as never, bitisYarim: t.bitisYarim as never, gunSayimi: 'IS_GUNU', tatiller: tipler })
  const kendiGun = new Map(kendi.gunler.map((d) => [d.tarih, d]))
  const satirlar = [
    {
      ad: `${ad} (talep)`, talep: true,
      hucreler: gunler.map((d) => (d.tatil === 'TATIL' ? 'TATIL' : (kendiGun.get(d.tarih)?.pay ?? 0) === 0 ? 'TATIL' : kendiGun.get(d.tarih)!.yarim ? 'TALEP_YARIM' : 'TALEP')),
    },
    ...ekip.map((e) => ({
      ad: e.adSoyad, talep: false,
      hucreler: gunler.map((d) => {
        if (d.tatil === 'TATIL') return 'TATIL'
        const h = hucre.get(`${e.id}|${d.tarih}`)
        if (!h) return d.tatil === 'YARIM' ? 'AREFE' : 'BOS'
        return h.durum === 'BEKLIYOR' ? 'BEKLIYOR' : h.yarim ? 'YARIM' : 'IZINLI'
      }),
    })),
  ]
  return { gunler, satirlar }
}

// ── Karar ────────────────────────────────────────────────────────────────────

export async function kararVer(ctx: Baglam, id: string, b: Record<string, unknown>) {
  const t = await talepOku(id)
  if (!t) throw new IzinGirdiHatasi('Talep bulunamadı')
  const yetki = onayYetkisi(t, { userId: ctx.userId, personnelId: ctx.personnelId, ivMi: ctx.ivMi })
  if ('hata' in yetki) throw new IzinGirdiHatasi(yetki.hata)
  const { karar, gerekce } = kararDogrula(b)
  const kademe = yetki.kademe
  let uyari: string | null = null
  let pdksKilitli: string[] = []

  if (karar === 'RED') {
    await prisma.$transaction(async (tx) => {
      const r = await tx.izinTalep.updateMany({ where: { id, durum: t.durum }, data: { durum: 'REDDEDILDI' } })
      if (r.count !== 1) throw new IzinGirdiHatasi('Talep bu arada değişti; sayfayı yenileyin')
      await tx.izinOnay.create({ data: { talepId: id, kademe, onaylayanId: ctx.userId, karar: 'RED', gerekce } })
      await logAuditEvent({ tx, action: 'IZIN_TALEP_REDDEDILDI', actorId: ctx.userId, targetType: 'IZIN_TALEP', targetId: id, details: { kademe, gerekce } })
    })
  } else if (kademe === 'YONETICI') {
    await prisma.$transaction(async (tx) => {
      const r = await tx.izinTalep.updateMany({ where: { id, durum: 'BEKLIYOR_YONETICI' }, data: { durum: 'BEKLIYOR_IV' } })
      if (r.count !== 1) throw new IzinGirdiHatasi('Talep bu arada değişti; sayfayı yenileyin')
      await tx.izinOnay.create({ data: { talepId: id, kademe, onaylayanId: ctx.userId, karar: 'ONAY', gerekce } })
      await logAuditEvent({ tx, action: 'IZIN_TALEP_ONAYLANDI', actorId: ctx.userId, targetType: 'IZIN_TALEP', targetId: id, details: { kademe } })
    })
  } else if (t.tur.birim === 'SAAT') {
    // Faz 4 — saatlik (MAZERET) İV onayı: aynı hesap + kota yeniden kontrol; defter YOK (kota talepten hesaplanır);
    // gün DONDURULMAZ — PDKS kaynağı onaylı saat aralığını talepten okur.
    const tarih = g(t.baslangic)!
    const r = saatlikHesapla(t.tur, { tarih, baslangicSaat: t.baslangicSaat ?? '', bitisSaat: t.bitisSaat ?? '' }, await tatilHaritasi(tarih, tarih))
    if (t.tur.yillikKotaDakika) {
      const d = mazeretDonemi(tarih, (await izinAyarlari()).mazeretDonem)
      const k = saatKotasi({ kotaDk: t.tur.yillikKotaDakika, kullanilanDk: await saatKullanimi(t.personnelId, t.tur.id, d.bas, d.bit, t.id), talepDk: r.dakika })
      if (!k.yeterli) throw new IzinGirdiHatasi(`${t.tur.ad} kotası yetersiz: kalan ${saatFmt(k.kalanDk)}, talep ${saatFmt(r.dakika)}`)
    }
    await prisma.$transaction(async (tx) => {
      const u = await tx.izinTalep.updateMany({ where: { id, durum: 'BEKLIYOR_IV' }, data: { durum: 'ONAYLANDI', dakika: r.dakika } })
      if (u.count !== 1) throw new IzinGirdiHatasi('Talep bu arada değişti; sayfayı yenileyin')
      await tx.izinOnay.create({ data: { talepId: id, kademe, onaylayanId: ctx.userId, karar: 'ONAY', gerekce } })
      await logAuditEvent({ tx, action: 'IZIN_TALEP_ONAYLANDI', actorId: ctx.userId, targetType: 'IZIN_TALEP', targetId: id, details: { kademe, dakika: r.dakika } })
    })
    pdksKilitli = (await puantajYenidenHesapla(t.personnelId, tarih, tarih)).kilitli
  } else {
    // İV onayı: günler TALEPLE AYNI fonksiyonla yeniden sayılır ve DONDURULUR; bakiyeli türde KULLANIM yazılır.
    const bas = g(t.baslangic)!
    const bit = g(t.bitis)!
    const ayar = await izinAyarlari()
    const hesap = talepHesapla(t.tur, { baslangic: bas, bitis: bit, baslangicYarim: t.baslangicYarim, bitisYarim: t.bitisYarim }, await tatilHaritasi(bas, bit), { sabitTatilSayilir: ayar.sabitTatilSayilir })
    if (hesap.toplam !== Number(t.gunSayisi)) uyari = `Tatil takvimi talepten sonra değişmiş: gün ${Number(t.gunSayisi)} → ${hesap.toplam} olarak donduruldu`
    let negatif = false
    if (t.tur.bakiyeli) {
      const yd = await yillikDurum(t.personnelId, t.id)
      const e = bakiyeEtkisi(t.tur, { bakiye: yd.bakiye, bekleyen: yd.bekleyen, talep: hesap.toplam })!
      if (!e.yeterli) {
        // Faz 4 (İV): eksiye YALNIZ İV (izin.admin — bu kademe zaten İV) dilekçe gerekçesiyle düşürür.
        if (b.negatifeDusur !== true) throw new IzinGirdiHatasi(`Yetersiz bakiye: kalan ${e.kalan}, talep ${hesap.toplam} gün. Eksiye düşürmek için "eksiye düşür" + dilekçe gerekçesi gerekli`)
        if (!gerekce || gerekce.length < 5) throw new IzinGirdiHatasi('Eksiye düşürerek onayda dilekçe gerekçesi zorunlu (en az 5 karakter)')
        negatif = true
      }
    }
    // Faz 4 (İV): RAPOR onayında çakışan ONAYLI YILLIK izin günleri bakiyeye iade edilir (satırlar kalır, iadeAt).
    const raporIade = t.tur.kod === 'RAPOR' ? await raporCakismasi(t.personnelId, id, hesap.gunler.filter((d) => d.pay > 0).map((d) => d.tarih)) : []
    const bugun = bugunStr()
    await prisma.$transaction(async (tx) => {
      const r = await tx.izinTalep.updateMany({ where: { id, durum: 'BEKLIYOR_IV' }, data: { durum: 'ONAYLANDI', gunSayisi: hesap.toplam } })
      if (r.count !== 1) throw new IzinGirdiHatasi('Talep bu arada değişti; sayfayı yenileyin')
      await tx.izinTalepGun.createMany({
        data: hesap.gunler.map((d) => ({ talepId: id, personnelId: t.personnelId, tarih: dbGun(d.tarih), pay: d.pay, yarim: d.yarim })),
      })
      if (t.tur.bakiyeli) {
        const h = kullanimHareketi({ id, gunSayisi: hesap.toplam }, bugun)
        await tx.izinBakiyeHareketi.create({ data: { ...h, tarih: dbGun(h.tarih), personnelId: t.personnelId, turId: t.tur.id, olusturanId: ctx.userId } })
      }
      for (const c of raporIade) {
        await tx.izinTalepGun.updateMany({ where: { id: { in: c.gunIdleri }, iadeAt: null }, data: { iadeAt: new Date(), iadeNedeni: 'RAPOR', iadeTalepId: id } })
        await tx.izinBakiyeHareketi.create({
          data: {
            personnelId: t.personnelId, turId: c.turId, hareket: 'IPTAL_IADE', gun: c.gun, tarih: dbGun(bugun), talepId: c.yillikId,
            aciklama: 'rapor nedeniyle iade', olusturanId: ctx.userId, anahtar: `RAPOR:${id}:${c.yillikId}`,
          },
        })
        await tx.izinOnay.create({ data: { talepId: c.yillikId, kademe: 'SISTEM', onaylayanId: ctx.userId, karar: 'NOT', gerekce: `rapor nedeniyle kısaldı (${fmt(c.gun)} gün iade)` } })
      }
      await tx.izinOnay.create({ data: { talepId: id, kademe, onaylayanId: ctx.userId, karar: 'ONAY', gerekce } })
      await logAuditEvent({
        tx, action: 'IZIN_TALEP_ONAYLANDI', actorId: ctx.userId, targetType: 'IZIN_TALEP', targetId: id,
        details: { kademe, gun: hesap.toplam, negatifeDusur: negatif, negatifGerekce: negatif ? gerekce : null, raporIade: raporIade.map((c) => ({ yillik: c.yillikId, gun: c.gun })), uyari },
      })
    })
    pdksKilitli = (await puantajYenidenHesapla(t.personnelId, bas, bit)).kilitli
    if (raporIade.length) uyari = [uyari, `Çakışan yıllık izinden ${fmt(raporIade.reduce((a, c) => a + c.gun, 0))} gün bakiyeye iade edildi`].filter(Boolean).join(' · ')
    if (pdksKilitli.length) uyari = [uyari, `Puantajı kilitli ${pdksKilitli.length} güne düştü (${pdksKilitli.join(', ')}) — elle kontrol edin`].filter(Boolean).join(' · ')
  }

  const m = await mailTalebi(id)
  await mail.calisanaSonuc(m, m.calisanUserId, { karar, kademe, gerekce })
  if (karar === 'ONAY' && kademe === 'YONETICI') await mail.iveTalep(m)
  if (karar === 'ONAY' && kademe === 'IV') await mail.yoneticiyeBilgi(m, m.onaycilar)
  return { durum: karar === 'RED' ? 'REDDEDILDI' : kademe === 'YONETICI' ? 'BEKLIYOR_IV' : 'ONAYLANDI', uyari, pdksKilitli }
}

/** Sidebar rozeti: kullanıcıyı bekleyen talep sayısı (yönetici + İV kademesi). */
export async function bekleyenSayisi(ctx: Baglam) {
  const kendisiHaric = ctx.personnelId ? { personnelId: { not: ctx.personnelId } } : {}
  const [y, i] = await Promise.all([
    prisma.izinTalep.count({ where: { durum: 'BEKLIYOR_YONETICI', OR: [{ onayci1Id: ctx.userId }, { onayci2Id: ctx.userId }, { onayci3Id: ctx.userId }], ...kendisiHaric } }),
    ctx.ivMi ? prisma.izinTalep.count({ where: { durum: 'BEKLIYOR_IV', ...kendisiHaric } }) : 0,
  ])
  return y + i
}

/**
 * RAPOR günleriyle çakışan ONAYLI YILLIK izin günleri (donmuş, pay>0, iade edilmemiş). Yıllık talep başına
 * iade edilecek gün toplamı + gün satırları. SAF DEĞİL (DB okur) ama yazma yapmaz.
 */
export async function raporCakismasi(personnelId: string, raporId: string, raporGunleri: string[]) {
  if (!raporGunleri.length) return []
  const gunler = await prisma.izinTalepGun.findMany({
    where: {
      personnelId, tarih: { in: raporGunleri.map(dbGun) }, pay: { gt: 0 }, iadeAt: null, talepId: { not: raporId },
      talep: { durum: 'ONAYLANDI', tur: { kod: 'YILLIK' } },
    },
    select: { id: true, talepId: true, pay: true, talep: { select: { turId: true } } },
  })
  const by = new Map<string, { yillikId: string; turId: string; gun: number; gunIdleri: string[] }>()
  for (const x of gunler) {
    const c = by.get(x.talepId) ?? { yillikId: x.talepId, turId: x.talep.turId, gun: 0, gunIdleri: [] }
    c.gun = Math.round((c.gun + Number(x.pay)) * 2) / 2
    c.gunIdleri.push(x.id)
    by.set(x.talepId, c)
  }
  return [...by.values()]
}

import 'server-only'
import { prisma } from '@/lib/prisma'
import { logAuditEvent, SISTEM_AKTOR_ID } from '@/lib/audit-log'
import { bugunStr } from '@/lib/pdks/puantaj-servis'
import { resolveApprovers, getManagedPersonnelIds } from '@/lib/onay/yonetici-cozumu'
import { selfEntryOnaydanMuafMi } from '@/lib/onay/muafiyet'
import { iptalIadeHareketi } from './bakiye'
import { kisiBakiyeOzeti } from './bakiye-ozet'
import { ekipIzinGunu } from './gorunum'
import { takvimGorurMu } from './takvim-servis'
import { GUN, IzinGirdiHatasi, gunEkle, izinGunleri, type IzinYarim } from './gun-sayimi'
import * as mail from './mail'
import {
  ATLAMA_METNI, bakiyeEtkisi, formdaGorunurMu, geriCekilebilirMi, ilkDurum, iptalEdilebilirMi, talepHesapla, type Atlama,
} from './talep-kurallari'
import {
  BEKLEYEN_DURUMLAR, TUR_SEC, baglam, cakisanTalep, dbGun, ekipKisileri, g, gecisTarihi, mailTalebi, puantajYenidenHesapla,
  talepAcikMi, tatilHaritasi, turGetir, yillikDurum, type Baglam,
} from './talep-ortak'

/**
 * İzin Faz 3 — çalışan tarafı: İzinlerim, önizleme, talep, geri çekme; İV iptali; "adına" talep.
 * Talep SİLİNMEZ (geri çekme / iptal = durum IPTAL). KULLANIM yalnız İV onayında yazılır (onay-servis.ts),
 * dolayısıyla bekleyen talebin geri çekilmesi deftere dokunmaz (rezerv kendiliğinden kalkar); onaylı iznin
 * iptali IPTAL_IADE yazar.
 */

const DURUM_METNI: Record<string, string> = {
  BEKLIYOR_YONETICI: 'Yönetici onayında', BEKLIYOR_IV: 'İV onayında', ONAYLANDI: 'Onaylandı', REDDEDILDI: 'Reddedildi', IPTAL: 'Geri çekildi / iptal',
}

// ── Hedef kişi (kendi ya da "adına") ─────────────────────────────────────────

/**
 * Talebin kimin için açıldığı. Kendi: User.personnelId. Adına: İV (izin.admin) herkes için; yönetici yalnız
 * onaycısı olduğu kişi için (resolveApprovers — onayla AYNI çözüm). Döner: yoneticiAdina = açan onaycılardan biri.
 */
async function hedefKisi(ctx: Baglam, personnelId: unknown) {
  const hedef = typeof personnelId === 'string' && personnelId ? personnelId : ctx.personnelId
  if (!hedef) throw new IzinGirdiHatasi('Hesabınız bir personel kaydına bağlı değil; talep için İnsan Varlıkları ile görüşün')
  const p = await prisma.personnel.findUnique({ where: { id: hedef }, select: { id: true, aktif: true, adSoyad: true } })
  if (!p?.aktif) throw new IzinGirdiHatasi('Personel bulunamadı ya da aktif değil')
  const onaycilar = await resolveApprovers(hedef)
  const liste = [onaycilar.approverId, onaycilar.approverId2, onaycilar.approverId3]
  const kendi = hedef === ctx.personnelId
  const yoneticiMi = liste.includes(ctx.userId)
  if (!kendi && !ctx.ivMi && !yoneticiMi) throw new IzinGirdiHatasi('Bu kişi adına talep açma yetkiniz yok')
  return { personel: p, kendi, onaycilar: liste, yoneticiAdina: !kendi && yoneticiMi }
}

function girdi(b: Record<string, unknown>) {
  const yarim = (v: unknown, izinli: IzinYarim): IzinYarim | null => (v === izinli ? izinli : null)
  const baslangic = String(b.baslangic ?? '')
  const bitis = String(b.bitis ?? '')
  if (!GUN.test(baslangic) || !GUN.test(bitis)) throw new IzinGirdiHatasi('Başlangıç ve bitiş tarihi seçilmeli')
  return { baslangic, bitis, baslangicYarim: yarim(b.baslangicYarim, 'OGLEDEN_SONRA'), bitisYarim: yarim(b.bitisYarim, 'SABAH') }
}

// ── Önizleme (talep kaydı ve İV onayı AYNI hesabı kullanır) ──────────────────

export async function onizlemeHesapla(ctx: Baglam, b: Record<string, unknown>) {
  const { personel, yoneticiAdina, onaycilar } = await hedefKisi(ctx, b.personnelId)
  const tur = await turGetir(String(b.turId ?? ''))
  const gi = girdi(b)
  const gecis = await gecisTarihi()
  if (tur.bakiyeli && !gecis) throw new IzinGirdiHatasi('İzin bakiyeleri henüz yüklenmedi — yıllık izin talebi açılamaz')
  const hesap = talepHesapla(tur, gi, await tatilHaritasi(gi.baslangic, gi.bitis))
  const cakisan = await cakisanTalep(personel.id, gi.baslangic, gi.bitis)
  const yd = tur.bakiyeli ? await yillikDurum(personel.id) : null
  const bakiye = yd ? bakiyeEtkisi(tur, { bakiye: yd.bakiye, bekleyen: yd.bekleyen, talep: hesap.toplam }) : null
  const ekip = await ekipCakismasi(personel.id, gi.baslangic, gi.bitis)
  const muaf = await selfEntryOnaydanMuafMi(personel.id)
  const akis = ilkDurum({ onayAkisi: tur.onayAkisi, muaf, yoneticiAdina, onaycilar })
  return {
    personel, tur, girdi: gi, hesap, bakiye, cakisan, ekipCakisma: ekip, akis, onaycilar,
    onayMetni: akis.durum === 'BEKLIYOR_YONETICI' ? 'Onay: Yöneticin → İnsan Varlıkları' : `Onay: İnsan Varlıkları (${ATLAMA_METNI[akis.atlama!]})`,
  }
}

export function onizlemeYaniti(o: Awaited<ReturnType<typeof onizlemeHesapla>>) {
  return {
    toplam: o.hesap.toplam,
    notlar: o.hesap.notlar,
    bakiye: o.bakiye ? { kalan: o.bakiye.kalan, sonrasi: o.bakiye.sonrasi, yeterli: o.bakiye.yeterli } : null,
    cakisan: o.cakisan ? { baslangic: g(o.cakisan.baslangic), bitis: g(o.cakisan.bitis) } : null,
    ekipCakisma: o.ekipCakisma,
    onayMetni: o.onayMetni,
  }
}

/** Aynı departmandan o günlerde izinli/bekleyen kişi sayısı (yalnız sayı — ad ve tür yok). */
export async function ekipCakismasi(personnelId: string, bas: string, bit: string): Promise<number> {
  const ekip = await ekipKisileri(personnelId)
  if (!ekip.length) return 0
  const ts = await prisma.izinTalep.findMany({
    where: { personnelId: { in: ekip.map((e) => e.id) }, durum: { in: [...BEKLEYEN_DURUMLAR, 'ONAYLANDI'] }, baslangic: { lte: dbGun(bit) }, bitis: { gte: dbGun(bas) } },
    select: { personnelId: true },
  })
  return new Set(ts.map((t) => t.personnelId)).size
}

// ── Talep oluştur ────────────────────────────────────────────────────────────

export async function talepOlustur(ctx: Baglam, b: Record<string, unknown>) {
  const o = await onizlemeHesapla(ctx, b)
  if (o.cakisan) throw new IzinGirdiHatasi(`Bu tarihlerle çakışan bir izin talebiniz var (${g(o.cakisan.baslangic)} – ${g(o.cakisan.bitis)})`)
  if (o.bakiye && !o.bakiye.yeterli) throw new IzinGirdiHatasi(`Yetersiz bakiye: kalan ${o.bakiye.kalan}, talep ${o.hesap.toplam} gün`)
  const aciklama = typeof b.aciklama === 'string' && b.aciklama.trim() ? b.aciklama.trim().slice(0, 500) : null
  const [o1, o2, o3] = o.onaycilar
  const atlama: Atlama | null = o.akis.atlama

  const talep = await prisma.$transaction(async (tx) => {
    const t = await tx.izinTalep.create({
      data: {
        personnelId: o.personel.id, turId: o.tur.id, baslangic: dbGun(o.girdi.baslangic), bitis: dbGun(o.girdi.bitis),
        baslangicYarim: o.girdi.baslangicYarim, bitisYarim: o.girdi.bitisYarim, gunSayisi: o.hesap.toplam, aciklama,
        durum: o.akis.durum, talepEdenId: ctx.userId, onayci1Id: o1, onayci2Id: o2, onayci3Id: o3,
      },
      select: { id: true },
    })
    // Atlanan yönetici kademesinin izi (şema değişmeden): yönetici "adına" açtıysa ONAY (onaylamış sayılır),
    // diğer nedenlerde ATLANDI.
    if (atlama) {
      await tx.izinOnay.create({
        data: {
          talepId: t.id, kademe: 'YONETICI', karar: atlama === 'YONETICI_ADINA' ? 'ONAY' : 'ATLANDI',
          onaylayanId: atlama === 'YONETICI_ADINA' ? ctx.userId : SISTEM_AKTOR_ID, gerekce: ATLAMA_METNI[atlama],
        },
      })
    }
    await logAuditEvent({
      tx, action: 'IZIN_TALEP_OLUSTURULDU', actorId: ctx.userId, targetType: 'IZIN_TALEP', targetId: t.id,
      details: { personnelId: o.personel.id, tur: o.tur.kod, baslangic: o.girdi.baslangic, bitis: o.girdi.bitis, gun: o.hesap.toplam, durum: o.akis.durum, atlama, adina: o.personel.id !== ctx.personnelId },
    })
    return t
  })

  const m = await mailTalebi(talep.id)
  if (o.akis.durum === 'BEKLIYOR_YONETICI') await mail.yoneticiyeTalep(m, o.onaycilar)
  else await mail.iveTalep(m, atlama ? `Yönetici kademesi: ${ATLAMA_METNI[atlama]}` : undefined)
  return { id: talep.id, durum: o.akis.durum }
}

// ── Geri çekme (çalışan) / iptal (İV) ────────────────────────────────────────

export async function geriCek(ctx: Baglam, talepId: string, neden?: unknown) {
  const t = await prisma.izinTalep.findUnique({ where: { id: talepId }, select: { id: true, durum: true, personnelId: true, talepEdenId: true } })
  if (!t) throw new IzinGirdiHatasi('Talep bulunamadı')
  if (t.personnelId !== ctx.personnelId && t.talepEdenId !== ctx.userId) throw new IzinGirdiHatasi('Yalnız kendi talebinizi geri çekebilirsiniz')
  if (!geriCekilebilirMi(t)) throw new IzinGirdiHatasi('Yalnız onay bekleyen talep geri çekilebilir; onaylı izin için İnsan Varlıkları ile görüşün')
  const m = await mailTalebi(t.id)
  const gerekce = typeof neden === 'string' && neden.trim() ? neden.trim().slice(0, 300) : 'çalışan geri çekti'
  const r = await prisma.izinTalep.updateMany({ where: { id: t.id, durum: t.durum }, data: { durum: 'IPTAL', iptalEdenId: ctx.userId, iptalAt: new Date(), iptalGerekcesi: gerekce } })
  if (r.count !== 1) throw new IzinGirdiHatasi('Talep bu arada değişti; sayfayı yenileyin')
  await logAuditEvent({ action: 'IZIN_TALEP_GERI_CEKILDI', actorId: ctx.userId, targetType: 'IZIN_TALEP', targetId: t.id, details: { onceki: t.durum } })
  await mail.iptalBildir(m, {
    calisanUserId: m.calisanUserId, bekleyenYoneticiler: t.durum === 'BEKLIYOR_YONETICI' ? m.onaycilar : [], ivBekliyordu: t.durum === 'BEKLIYOR_IV', neden: gerekce,
  })
  return { durum: 'IPTAL' }
}

/** Onaylı iznin BAŞLAMADAN iptali (yalnız İV): IPTAL + IPTAL_IADE (bakiyeli türde) + puantaj yeniden hesap. */
export async function ivIptal(ctx: Baglam, talepId: string, b: Record<string, unknown>) {
  if (!ctx.ivMi) throw new IzinGirdiHatasi('Onaylı izni yalnız İnsan Varlıkları iptal edebilir')
  const gerekce = typeof b.gerekce === 'string' ? b.gerekce.trim() : ''
  if (gerekce.length < 5) throw new IzinGirdiHatasi('İptal gerekçesi zorunlu (en az 5 karakter)')
  const t = await prisma.izinTalep.findUnique({
    where: { id: talepId },
    select: { id: true, durum: true, personnelId: true, baslangic: true, bitis: true, gunSayisi: true, tur: { select: { id: true, bakiyeli: true } } },
  })
  if (!t) throw new IzinGirdiHatasi('Talep bulunamadı')
  if (!iptalEdilebilirMi({ durum: t.durum, baslangic: g(t.baslangic)! }, bugunStr())) throw new IzinGirdiHatasi('Yalnız başlamamış onaylı izin iptal edilebilir')
  const bugun = bugunStr()
  await prisma.$transaction(async (tx) => {
    const r = await tx.izinTalep.updateMany({ where: { id: t.id, durum: 'ONAYLANDI' }, data: { durum: 'IPTAL', iptalEdenId: ctx.userId, iptalAt: new Date(), iptalGerekcesi: gerekce } })
    if (r.count !== 1) throw new IzinGirdiHatasi('Talep bu arada değişti; sayfayı yenileyin')
    if (t.tur.bakiyeli) {
      const h = iptalIadeHareketi({ id: t.id, gunSayisi: Number(t.gunSayisi) }, bugun)
      await tx.izinBakiyeHareketi.create({ data: { ...h, tarih: dbGun(h.tarih), personnelId: t.personnelId, turId: t.tur.id, olusturanId: ctx.userId } })
    }
    await logAuditEvent({ tx, action: 'IZIN_TALEP_IPTAL_EDILDI', actorId: ctx.userId, targetType: 'IZIN_TALEP', targetId: t.id, details: { gerekce, iade: t.tur.bakiyeli ? Number(t.gunSayisi) : 0 } })
  })
  const pdks = await puantajYenidenHesapla(t.personnelId, g(t.baslangic)!, g(t.bitis)!)
  const m = await mailTalebi(t.id)
  await mail.iptalBildir(m, { calisanUserId: m.calisanUserId, bekleyenYoneticiler: [], ivBekliyordu: false, neden: `İnsan Varlıkları iptal etti: ${gerekce}` })
  return { durum: 'IPTAL', pdksKilitli: pdks.kilitli }
}

// ── İzinlerim ────────────────────────────────────────────────────────────────

export async function izinlerim(ctx: Baglam, personnelId?: string | null) {
  const hedef = personnelId && personnelId !== ctx.personnelId ? (await hedefKisi(ctx, personnelId)).personel.id : ctx.personnelId
  if (!hedef) return { bagli: false as const }
  const bugun = bugunStr()
  const [p, gecis, turler, talepler, hassas] = await Promise.all([
    prisma.personnel.findUniqueOrThrow({
      where: { id: hedef },
      select: { id: true, adSoyad: true, sicilNo: true, aktif: true, iseGirisTarihi: true, employmentPeriods: { select: { girisTarihi: true, cikisTarihi: true } } },
    }),
    gecisTarihi(),
    prisma.izinTuru.findMany({ where: { aktif: true }, orderBy: [{ sira: 'asc' }, { ad: 'asc' }], select: TUR_SEC }),
    prisma.izinTalep.findMany({
      where: { personnelId: hedef },
      orderBy: { baslangic: 'desc' },
      take: 50,
      select: {
        id: true, baslangic: true, bitis: true, baslangicYarim: true, bitisYarim: true, gunSayisi: true, durum: true, aciklama: true,
        createdAt: true, iptalGerekcesi: true, iptalAt: true, tur: { select: { ad: true } },
        onaylar: { orderBy: { createdAt: 'asc' }, select: { kademe: true, karar: true, gerekce: true, createdAt: true } },
      },
    }),
    prisma.personnelSensitive.findUnique({ where: { personnelId: hedef }, select: { dogumTarihi: true } }),
  ])
  const yd = await yillikDurum(hedef)
  const ozet = kisiBakiyeOzeti({
    defter: yd.defter, bekleyenGunler: yd.bekleyen, iseGirisTarihi: g(p.iseGirisTarihi)!,
    donemler: p.employmentPeriods.map((d) => ({ giris: g(d.girisTarihi)!, cikis: g(d.cikisTarihi) })),
    dogumTarihi: g(hassas?.dogumTarihi) ?? null, aktif: p.aktif, bugun,
  })
  const bekleyenSayi = talepler.filter((t) => (BEKLEYEN_DURUMLAR as readonly string[]).includes(t.durum)).length
  // Talep listesi (tür adıyla) yalnız kişinin KENDİSİNE ve İV'ye; yönetici "adına" açarken görmez.
  const listeGorur = hedef === ctx.personnelId || ctx.ivMi
  return {
    bagli: true as const,
    personel: { id: p.id, adSoyad: p.adSoyad, sicil: p.sicilNo, kendi: hedef === ctx.personnelId },
    gecisTarihi: gecis,
    kartlar: {
      kalan: ozet.kalan, bakiye: ozet.bakiye, bekleyenTalep: bekleyenSayi, bekleyenGun: ozet.bekleyen,
      kullanilanBuYil: ozet.kullanilanBuYil, sonraki: ozet.sonraki,
    },
    turler: turler.filter(formdaGorunurMu).map((t) => ({
      id: t.id, kod: t.kod, ad: t.ad, bakiyeli: t.bakiyeli, sabitGun: t.sabitGun, yarimGunOlur: t.yarimGunOlur, gunSayimi: t.gunSayimi,
      kapali: t.bakiyeli && !gecis ? 'İzin bakiyeleri henüz yüklenmedi' : null,
    })),
    talepler: (listeGorur ? talepler : []).map((t) => ({
      id: t.id, tur: t.tur.ad, baslangic: g(t.baslangic), bitis: g(t.bitis), baslangicYarim: t.baslangicYarim, bitisYarim: t.bitisYarim,
      gun: Number(t.gunSayisi), durum: t.durum, durumMetni: DURUM_METNI[t.durum] ?? t.durum, adim: adimMetni(t), geriCekilebilir: geriCekilebilirMi(t),
    })),
  }
}

function adimMetni(t: { durum: string; iptalGerekcesi: string | null; iptalAt: Date | null; onaylar: { kademe: string; karar: string; gerekce: string | null; createdAt: Date }[] }) {
  const tr = (d: Date) => new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 10).split('-').reverse().join('.')
  const son = t.onaylar.at(-1)
  switch (t.durum) {
    case 'BEKLIYOR_YONETICI': return 'Yöneticinin onayı bekleniyor'
    case 'BEKLIYOR_IV': return son?.kademe === 'YONETICI' && son.karar === 'ONAY' ? 'Yönetici onayladı · İnsan Varlıkları bekleniyor' : 'İnsan Varlıkları onayı bekleniyor'
    case 'ONAYLANDI': return `Onaylandı · ${son ? tr(son.createdAt) : ''}`
    case 'REDDEDILDI': return `Reddedildi${son?.gerekce ? `: ${son.gerekce}` : ''}`
    case 'IPTAL': return `${t.iptalGerekcesi ?? 'Geri çekildi'}${t.iptalAt ? ` · ${tr(t.iptalAt)}` : ''}`
    default: return ''
  }
}

/** Ay takvimi: tatil/hafta sonu, kendi talep günleri, ekipten izinli SAYISI (ad ve tür yok). */
export async function ayTakvimi(ctx: Baglam, ay: string, personnelId?: string | null) {
  if (!/^\d{4}-\d{2}$/.test(ay)) throw new IzinGirdiHatasi('Ay YYYY-MM olmalı')
  const hedef = personnelId && personnelId !== ctx.personnelId ? (await hedefKisi(ctx, personnelId)).personel.id : ctx.personnelId
  if (!hedef) return { gunler: [] }
  const bas = `${ay}-01`
  const bit = gunEkle(`${gunEkle(bas, 32).slice(0, 7)}-01`, -1)
  const [tatil, ekip] = await Promise.all([tatilHaritasi(bas, bit), ekipKisileri(hedef)])
  const tipler = new Map([...tatil].map(([k, v]) => [k, v.tip]))
  const ts = await prisma.izinTalep.findMany({
    where: { personnelId: { in: ekip.map((e) => e.id) }, durum: { in: [...BEKLEYEN_DURUMLAR, 'ONAYLANDI'] }, baslangic: { lte: dbGun(bit) }, bitis: { gte: dbGun(bas) } },
    select: { personnelId: true, durum: true, baslangic: true, bitis: true, baslangicYarim: true, bitisYarim: true },
  })
  const sayac = new Map<string, Set<string>>()
  for (const t of ts) {
    const r = izinGunleri({ baslangic: g(t.baslangic)!, bitis: g(t.bitis)!, baslangicYarim: t.baslangicYarim, bitisYarim: t.bitisYarim, gunSayimi: 'IS_GUNU', tatiller: tipler })
    for (const d of r.gunler) {
      const e = ekipIzinGunu({ personnelId: t.personnelId, tarih: d.tarih, yarim: d.yarim, pay: d.pay, talepDurumu: t.durum })
      if (!e || e.tarih < bas || e.tarih > bit) continue
      if (!sayac.has(e.tarih)) sayac.set(e.tarih, new Set())
      sayac.get(e.tarih)!.add(e.personnelId)
    }
  }
  const gunler: { tarih: string; takvim: string; tatil: string | null; ekipIzinli: number }[] = []
  for (let d = bas; d <= bit; d = gunEkle(d, 1)) {
    const hg = new Date(`${d}T12:00:00Z`).getUTCDay()
    const tt = tatil.get(d)
    const takvim = tt?.tip === 'TATIL' ? 'TATIL' : hg === 0 || hg === 6 ? 'HAFTA_SONU' : tt?.tip === 'YARIM' ? 'YARIM' : 'CALISMA'
    gunler.push({ tarih: d, takvim, tatil: tt && tt.tip !== 'MESAI' ? tt.aciklama : null, ekipIzinli: sayac.get(d)?.size ?? 0 })
  }
  return { gunler }
}

/** "Adına" talep adayları: İV herkes (aktif), yönetici kendi ekibi (ad + FK sorumlu). */
export async function adinaAdaylari(ctx: Baglam, q: string) {
  const ara = q.trim()
  const filtre = ara ? { OR: [{ adSoyad: { contains: ara, mode: 'insensitive' as const } }, { sicilNo: { contains: ara, mode: 'insensitive' as const } }] } : {}
  let idler: string[] | null = null
  if (!ctx.ivMi) {
    if (!ctx.personnelId) return []
    const [adla, fk] = await Promise.all([
      getManagedPersonnelIds(ctx.personnelId),
      prisma.personnel.findMany({ where: { aktif: true, OR: [{ sorumlu1Id: ctx.personnelId }, { sorumlu2Id: ctx.personnelId }, { sorumlu3Id: ctx.personnelId }] }, select: { id: true } }),
    ])
    idler = [...new Set([...adla, ...fk.map((x) => x.id)])]
    if (!idler.length) return []
  }
  const ps = await prisma.personnel.findMany({
    where: { aktif: true, ...(idler ? { id: { in: idler } } : {}), ...filtre },
    orderBy: { adSoyad: 'asc' },
    take: 30,
    select: { id: true, adSoyad: true, sicilNo: true, department: { select: { name: true } }, user: { select: { id: true } } },
  })
  return ps.map((p) => ({ id: p.id, adSoyad: p.adSoyad, sicil: p.sicilNo, departman: p.department?.name ?? null, hesapVar: !!p.user }))
}

// ── Sidebar bayrağı ──────────────────────────────────────────────────────────

/**
 * "İzin Talebim": personele bağlı herkes (ya da İV). "İzin Onaylarım": onaycı olanlar — sorumlu1-3Id FK,
 * ad eşleşmesi (getManagedPersonnelIds), onaycısı olduğu bir talep ya da izin.admin. izin_talep_acik kapalıyken ikisi de gizli.
 */
export async function menuBayragi(userId: string) {
  if (!(await talepAcikMi())) return { talep: false, onay: false, takvim: false, bekleyen: 0 }
  const ctx = await baglam(userId)
  const benim = { OR: [{ onayci1Id: userId }, { onayci2Id: userId }, { onayci3Id: userId }] }
  const kendisiHaric = ctx.personnelId ? { personnelId: { not: ctx.personnelId } } : {}
  const [yBekleyen, ivBekleyen, herhangi] = await Promise.all([
    prisma.izinTalep.count({ where: { durum: 'BEKLIYOR_YONETICI', ...benim, ...kendisiHaric } }),
    ctx.ivMi ? prisma.izinTalep.count({ where: { durum: 'BEKLIYOR_IV', ...kendisiHaric } }) : 0,
    prisma.izinTalep.count({ where: benim }),
  ])
  let onay = ctx.ivMi || herhangi > 0
  if (!onay && ctx.personnelId) {
    const fk = await prisma.personnel.count({ where: { aktif: true, OR: [{ sorumlu1Id: ctx.personnelId }, { sorumlu2Id: ctx.personnelId }, { sorumlu3Id: ctx.personnelId }] } })
    onay = fk > 0 || (await getManagedPersonnelIds(ctx.personnelId)).length > 0
  }
  return { talep: !!ctx.personnelId, onay, takvim: await takvimGorurMu(ctx), bekleyen: yBekleyen + ivBekleyen }
}

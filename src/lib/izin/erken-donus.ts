import 'server-only'
import { prisma } from '@/lib/prisma'
import { logAuditEvent, SISTEM_AKTOR_ID } from '@/lib/audit-log'
import { bugunStr } from '@/lib/pdks/puantaj-servis'
import { IzinGirdiHatasi, IzinYetkiHatasi } from './gun-sayimi'
import * as mail from './mail'
import { fmt } from './talep-kurallari'
import { dbGun, g, puantajYenidenHesapla, type Baglam } from './talep-ortak'

/**
 * İzin Faz 4 — ERKEN DÖNÜŞ (İV 28.09). Onaylı (tam gün) izin gününde PDKS'te geçerli geçiş görülürse motor
 * IZINLI_GUNDE_GECIS uyarısı yazar; bu tarama o günleri İV kuyruğuna alır ve İV'ye bildirir. OTOMATİK İADE YOK:
 * İV onaylarsa o günden itibaren izinli kalan günler iade edilir (IzinTalepGun.iadeAt + bakiyeli türde
 * IPTAL_IADE, anahtar ERKEN:<talep>); talep SİLİNMEZ, geçmişine "erken dönüş" notu düşer. Red → iade yok.
 * Tarama: PDKS puantaj cron'unun sonunda + İV ekranında "Tara".
 */

export async function erkenDonusTara(aktorId = SISTEM_AKTOR_ID) {
  const satirlar = await prisma.pdksPuantajGun.findMany({
    where: { izinTalepId: { not: null }, uyarilar: { has: 'IZINLI_GUNDE_GECIS' }, izinTalep: { durum: 'ONAYLANDI', erkenDonus: null } },
    select: { personnelId: true, gun: true, izinTalepId: true },
    orderBy: { gun: 'asc' },
  })
  const ilk = new Map<string, { personnelId: string; gun: Date }>()
  for (const s of satirlar) if (s.izinTalepId && !ilk.has(s.izinTalepId)) ilk.set(s.izinTalepId, { personnelId: s.personnelId, gun: s.gun })
  if (!ilk.size) return { yeni: 0 }
  const r = await prisma.izinErkenDonus.createMany({
    data: [...ilk].map(([talepId, v]) => ({ talepId, personnelId: v.personnelId, tarih: v.gun, durum: 'BEKLIYOR' as const })),
    skipDuplicates: true,
  })
  if (r.count > 0) {
    await logAuditEvent({ action: 'IZIN_ERKEN_DONUS_TESPIT', actorId: aktorId, targetType: 'IZIN_ERKEN_DONUS', details: { yeni: r.count, talepler: [...ilk.keys()] } })
    await mail.erkenDonusBildir(r.count)
  }
  return { yeni: r.count }
}

/** İV kuyruğu (izin.admin): bekleyenler + son kararlar. İade edilebilir gün = tespit gününden itibaren izinli kalan günler. */
export async function erkenDonusListesi(ctx: Baglam) {
  if (!ctx.ivMi) throw new IzinYetkiHatasi('Erken dönüş kuyruğu yalnız İnsan Varlıkları içindir')
  const rs = await prisma.izinErkenDonus.findMany({
    orderBy: [{ durum: 'asc' }, { createdAt: 'desc' }],
    take: 200,
    select: {
      id: true, tarih: true, durum: true, iadeGun: true, kararAt: true, kararNotu: true, createdAt: true,
      personnel: { select: { adSoyad: true, sicilNo: true } },
      talep: {
        select: {
          id: true, baslangic: true, bitis: true, gunSayisi: true, tur: { select: { ad: true, bakiyeli: true } },
          gunler: { where: { pay: { gt: 0 }, iadeAt: null }, select: { tarih: true, pay: true } },
        },
      },
    },
  })
  return rs.map((r) => {
    const iadeEdilebilir = r.talep.gunler.filter((x) => x.tarih >= r.tarih).reduce((t, x) => t + Number(x.pay), 0)
    return {
      id: r.id, durum: r.durum, tarih: g(r.tarih), personelAd: r.personnel.adSoyad, sicil: r.personnel.sicilNo,
      talepId: r.talep.id, turAd: r.talep.tur.ad, bakiyeli: r.talep.tur.bakiyeli, baslangic: g(r.talep.baslangic), bitis: g(r.talep.bitis),
      gunSayisi: Number(r.talep.gunSayisi), iadeEdilebilir: Math.round(iadeEdilebilir * 2) / 2,
      iadeGun: r.iadeGun === null ? null : Number(r.iadeGun), kararAt: r.kararAt?.toISOString() ?? null, kararNotu: r.kararNotu,
    }
  })
}

export async function erkenDonusKarar(ctx: Baglam, id: string, b: Record<string, unknown>) {
  if (!ctx.ivMi) throw new IzinYetkiHatasi('Erken dönüş kararı yalnız İnsan Varlıkları içindir')
  const karar = b.karar === 'ONAY' ? 'ONAY' : b.karar === 'RED' ? 'RED' : null
  if (!karar) throw new IzinGirdiHatasi('Karar ONAY ya da RED olmalı')
  const not = typeof b.not === 'string' ? b.not.trim().slice(0, 500) || null : null
  const e = await prisma.izinErkenDonus.findUnique({
    where: { id },
    select: { id: true, durum: true, tarih: true, talepId: true, personnelId: true, talep: { select: { bitis: true, turId: true, tur: { select: { bakiyeli: true } } } } },
  })
  if (!e) throw new IzinGirdiHatasi('Kayıt bulunamadı')
  if (e.durum !== 'BEKLIYOR') throw new IzinGirdiHatasi('Bu kayıt için karar verilmiş')
  const bugun = bugunStr()

  if (karar === 'RED') {
    await prisma.$transaction(async (tx) => {
      const u = await tx.izinErkenDonus.updateMany({ where: { id, durum: 'BEKLIYOR' }, data: { durum: 'REDDEDILDI', kararVerenId: ctx.userId, kararAt: new Date(), kararNotu: not } })
      if (u.count !== 1) throw new IzinGirdiHatasi('Kayıt bu arada değişti; sayfayı yenileyin')
      await logAuditEvent({ tx, action: 'IZIN_ERKEN_DONUS_REDDEDILDI', actorId: ctx.userId, targetType: 'IZIN_ERKEN_DONUS', targetId: id, details: { talepId: e.talepId, not } })
    })
    return { durum: 'REDDEDILDI', iadeGun: 0 }
  }

  const gunler = await prisma.izinTalepGun.findMany({
    where: { talepId: e.talepId, tarih: { gte: e.tarih }, pay: { gt: 0 }, iadeAt: null },
    select: { id: true, pay: true },
  })
  const iade = Math.round(gunler.reduce((t, x) => t + Number(x.pay), 0) * 2) / 2
  await prisma.$transaction(async (tx) => {
    const u = await tx.izinErkenDonus.updateMany({
      where: { id, durum: 'BEKLIYOR' },
      data: { durum: 'ONAYLANDI', iadeGun: iade, kararVerenId: ctx.userId, kararAt: new Date(), kararNotu: not },
    })
    if (u.count !== 1) throw new IzinGirdiHatasi('Kayıt bu arada değişti; sayfayı yenileyin')
    if (gunler.length) {
      await tx.izinTalepGun.updateMany({ where: { id: { in: gunler.map((x) => x.id) }, iadeAt: null }, data: { iadeAt: new Date(), iadeNedeni: 'ERKEN_DONUS' } })
    }
    if (e.talep.tur.bakiyeli && iade > 0) {
      await tx.izinBakiyeHareketi.create({
        data: {
          personnelId: e.personnelId, turId: e.talep.turId, hareket: 'IPTAL_IADE', gun: iade, tarih: dbGun(bugun), talepId: e.talepId,
          aciklama: 'erken dönüş iadesi', olusturanId: ctx.userId, anahtar: `ERKEN:${e.talepId}`,
        },
      })
    }
    await tx.izinOnay.create({
      data: { talepId: e.talepId, kademe: 'SISTEM', onaylayanId: ctx.userId, karar: 'NOT', gerekce: `erken dönüş: ${g(e.tarih)!.split('-').reverse().join('.')} itibarıyla ${fmt(iade)} gün iade` },
    })
    await logAuditEvent({ tx, action: 'IZIN_ERKEN_DONUS_ONAYLANDI', actorId: ctx.userId, targetType: 'IZIN_ERKEN_DONUS', targetId: id, details: { talepId: e.talepId, iade, not } })
  })
  await puantajYenidenHesapla(e.personnelId, g(e.tarih)!, g(e.talep.bitis)!)
  return { durum: 'ONAYLANDI', iadeGun: iade }
}

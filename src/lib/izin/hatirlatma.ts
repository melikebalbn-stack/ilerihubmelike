import 'server-only'
import { prisma } from '@/lib/prisma'
import { logAuditEvent, SISTEM_AKTOR_ID } from '@/lib/audit-log'
import {
  HATIRLATMA_SAAT_AYARI, erkenDonusAnahtari, gonderimPenceresi, hatirlatmaSaati, kademeDususu, talepAnahtari, vadeDolduMu, yerelZaman,
  type HatirlatmaKademesi,
} from './hatirlatma-kurallari'
import * as mail from './mail'
import { BEKLEYEN_DURUMLAR, mailTalebi, talepAcikMi, tatilHaritasi } from './talep-ortak'

/**
 * İzin Faz 6 — onay hatırlatma işi (cron: POST /api/cron/izin-hatirlatma, saatte bir). Kurallar: hatirlatma-kurallari.ts.
 * Tek gönderim: izin_hatirlatma.anahtar UNIQUE — satır ÖNCE yazılır, yazılabildiyse mail gider; eşzamanlı ikinci
 * tur (ya da ikinci çalışma) satırı yazamaz → göndermez. Mail hatası satırı geri almaz (yeniden deneme YOK:
 * "bir kez" kuralı; hata logda).
 * izin_talep_acik kapalıyken hiçbir şey yapılmaz. dryRun: aday sayar, satır da mail de YOK.
 */

export interface HatirlatmaSonucu {
  kapali?: true
  ertelendi?: string
  dryRun: boolean
  saat: number
  yonetici: number
  iv: number
  erkenDonus: number
}

const P2002 = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002'

/** Anahtarı sahiplen: yazılabildiyse satır id'si, zaten varsa null. */
async function sahiplen(data: { anahtar: string; kademe: HatirlatmaKademesi; talepId?: string; erkenDonusId?: string }) {
  try {
    return (await prisma.izinHatirlatma.create({ data, select: { id: true } })).id
  } catch (e) {
    if (P2002(e)) return null
    throw e
  }
}

export async function hatirlatmaIsi(o: { simdi?: Date; dryRun?: boolean } = {}): Promise<HatirlatmaSonucu> {
  const simdi = o.simdi ?? new Date()
  const dryRun = o.dryRun === true
  const ayar = await prisma.systemSetting.findUnique({ where: { key: HATIRLATMA_SAAT_AYARI }, select: { value: true } })
  const saat = hatirlatmaSaati(ayar?.value)
  const bos = { dryRun, saat, yonetici: 0, iv: 0, erkenDonus: 0 }

  if (!(await talepAcikMi())) {
    console.log('[izin-hatirlatma] izin_talep_acik kapalı — hiçbir şey gönderilmedi')
    return { ...bos, kapali: true }
  }
  const gun = yerelZaman(simdi).gun
  const pencere = gonderimPenceresi(simdi, (await tatilHaritasi(gun, gun)).get(gun)?.tip ?? null)
  if (!pencere.acik) return { ...bos, ertelendi: pencere.sebep }

  const esik = new Date(simdi.getTime() - saat * 3600_000)

  // ── Talepler (yönetici + İV kademesi) ──
  const talepler = await prisma.izinTalep.findMany({
    // ön süzgeç: her iki kademede düşüş ≥ oluşturma → oluşturması eşikten yeni olan vadesi dolmuş olamaz
    where: { durum: { in: [...BEKLEYEN_DURUMLAR] }, createdAt: { lte: esik } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, durum: true, createdAt: true,
      onaylar: { select: { kademe: true, karar: true, createdAt: true } },
      hatirlatmalar: { select: { anahtar: true } },
    },
  })
  const adaylar: { talepId: string; kademe: HatirlatmaKademesi; anahtar: string }[] = []
  for (const t of talepler) {
    const k = kademeDususu(t)
    if (!k || !vadeDolduMu(k.dusus, simdi, saat)) continue
    const anahtar = talepAnahtari(t.id, k.kademe)
    if (t.hatirlatmalar.some((h) => h.anahtar === anahtar)) continue
    adaylar.push({ talepId: t.id, kademe: k.kademe, anahtar })
  }

  // ── Erken dönüş kuyruğu (İV) ──
  const erken = await prisma.izinErkenDonus.findMany({
    where: { durum: 'BEKLIYOR', createdAt: { lte: esik } },
    select: { id: true, hatirlatmalar: { select: { anahtar: true } } },
  })
  const erkenAdaylar = erken.filter((e) => !e.hatirlatmalar.some((h) => h.anahtar === erkenDonusAnahtari(e.id)))

  if (dryRun) {
    return {
      ...bos,
      yonetici: adaylar.filter((a) => a.kademe === 'YONETICI').length,
      iv: adaylar.filter((a) => a.kademe === 'IV').length,
      erkenDonus: erkenAdaylar.length,
    }
  }

  const sonuc = { ...bos }
  for (const a of adaylar) {
    const satirId = await sahiplen({ anahtar: a.anahtar, kademe: a.kademe, talepId: a.talepId })
    if (!satirId) continue
    const m = await mailTalebi(a.talepId)
    const n = a.kademe === 'YONETICI' ? await mail.yoneticiyeHatirlatma(m, m.onaycilar) : await mail.iveHatirlatma(m)
    await prisma.izinHatirlatma.update({ where: { id: satirId }, data: { aliciSayisi: n } })
    if (a.kademe === 'YONETICI') sonuc.yonetici++
    else sonuc.iv++
  }

  const sahiplenilen: string[] = []
  for (const e of erkenAdaylar) {
    const satirId = await sahiplen({ anahtar: erkenDonusAnahtari(e.id), kademe: 'IV', erkenDonusId: e.id })
    if (satirId) sahiplenilen.push(satirId)
  }
  if (sahiplenilen.length) {
    const n = await mail.erkenDonusHatirlatma(sahiplenilen.length)
    await prisma.izinHatirlatma.updateMany({ where: { id: { in: sahiplenilen } }, data: { aliciSayisi: n } })
    sonuc.erkenDonus = sahiplenilen.length
  }

  if (sonuc.yonetici + sonuc.iv + sonuc.erkenDonus > 0) {
    await logAuditEvent({
      action: 'IZIN_HATIRLATMA_GONDERILDI', actorId: SISTEM_AKTOR_ID, targetType: 'IZIN_TALEP',
      details: { yonetici: sonuc.yonetici, iv: sonuc.iv, erkenDonus: sonuc.erkenDonus, saat },
    })
  }
  return sonuc
}

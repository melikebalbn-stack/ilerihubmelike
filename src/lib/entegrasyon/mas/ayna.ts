import 'server-only'
import { prisma } from '@/lib/prisma'
import { acikUretimler, kapananUretimler, acikOperatorler, acikDuruslar, type MasUretimSatiri } from '@/lib/mas/uretim'
import { isEmirineGrupla, employeeNoToSicilNo, type MasUretimGirdi } from './uretim-mapper'
import { oeeKaydiHesaplaVeYaz } from '@/lib/ipro/oee-hesap'
import { isPenceresiDeltaToplami } from '@/lib/ipro/faz2-delta'

/**
 * MAS MES → IPRO ayna (yazma). Açık üretim → IproProductionLog ACIK; kapanan → KAPALI + OEE;
 * açık/kapanan duruş → IproMachineDowntime. Hepsi IDEMPOTENT (idempotency anahtarı
 * masProductionMasterId+ifsOrderNo+ifsOperationNo; duruşta tezgah+kaynak='MAS'+açık). dryRun DB'ye yazmaz.
 * Kiosk/terminal/is-basla/is-bitir dosyalarına DOKUNMAZ; yalnız ortak oee-hesap/faz2-delta çağırır.
 */
const KAYNAK = 'MAS'
const HG_ANAHTAR = (workOrderNo: string | null, masId: number | string) => (workOrderNo ?? '').trim() || `PM:${masId}`

export interface MasAynaOzet {
  dryRun: boolean
  acikOkunan: number
  acikUygun: number
  acilan: number
  guncellenen: number
  kapatilan: number
  durusAcilan: number
  durusKapatilan: number
  eslesmeyenDurusSebepleri: string[]
  atlanan: { sebep: string; anahtar: string; detay: string }[]
}

function girdiye(satirlar: MasUretimSatiri[], opByMas: Map<number, string>): MasUretimGirdi[] {
  return satirlar.map((s) => ({
    masId: s.masId,
    tezgahKod: s.tezgahKod,
    employeeNo: opByMas.get(s.masId) ?? null,
    workOrderNo: s.workOrderNo,
    operasyonNo: s.operasyonNo,
    amount: s.amount,
    reportedAmount: s.reportedAmount,
    counterMultiplier: s.counterMultiplier,
    counterDivider: s.counterDivider,
    startDateTime: s.startDateTime ? s.startDateTime.toISOString() : null,
  }))
}

export async function runMasAyna(opts: { dryRun?: boolean } = {}): Promise<MasAynaOzet> {
  const dryRun = !!opts.dryRun
  const simdi = new Date()
  const dun = new Date(simdi.getTime() - 24 * 3600 * 1000)

  const [acikSatir, operatorler, kapananSatir, duruslar, tezgahlar, personeller, durusSebepleri] = await Promise.all([
    acikUretimler(),
    acikOperatorler(),
    kapananUretimler({ sinceDate: dun }),
    acikDuruslar(),
    prisma.iproTezgah.findMany({ where: { aktif: true }, select: { id: true, kod: true, _count: { select: { plcPinler: true } } } }),
    prisma.personnel.findMany({ select: { id: true, sicilNo: true } }),
    prisma.iproDurusSebebi.findMany({ select: { id: true, kod: true } }),
  ])

  const tezgahByKod = new Map(tezgahlar.map((t) => [t.kod, { id: t.id, sinyalli: t._count.plcPinler > 0 }]))
  const personBySicil = new Map(personeller.map((p) => [p.sicilNo, p.id]))
  const sebepByKod = new Map(durusSebepleri.map((d) => [d.kod, d.id]))
  const opByMas = new Map<number, string>()
  for (const o of operatorler) if (o.employeeNo && !opByMas.has(o.masId)) opByMas.set(o.masId, o.employeeNo)

  const ozet: MasAynaOzet = {
    dryRun, acikOkunan: acikSatir.length, acikUygun: 0, acilan: 0, guncellenen: 0,
    kapatilan: 0, durusAcilan: 0, durusKapatilan: 0, eslesmeyenDurusSebepleri: [], atlanan: [],
  }

  // Grup anahtarı → ilk satır meta (başlangıç, detayId) — mapper bunları taşımaz.
  const acikMeta = new Map<string, { startDateTime: Date | null; masDetayId: number | null }>()
  for (const s of acikSatir) {
    const a = HG_ANAHTAR(s.workOrderNo, s.masId)
    if (!acikMeta.has(a)) acikMeta.set(a, { startDateTime: s.startDateTime, masDetayId: s.masDetayId })
  }

  // ── (a) AÇIK üretimler ──
  for (const g of isEmirineGrupla(girdiye(acikSatir, opByMas))) {
    const tz = g.tezgahKod ? tezgahByKod.get(g.tezgahKod) : undefined
    if (!tz) {
      ozet.atlanan.push({ sebep: 'tezgah_eslesmedi', anahtar: g.anahtar, detay: g.tezgahKod ?? '—' })
      continue
    }
    const sicil = employeeNoToSicilNo(g.employeeNo)
    const personId = sicil ? personBySicil.get(sicil) : undefined
    if (!personId) {
      ozet.atlanan.push({ sebep: 'personel_eslesmedi', anahtar: g.anahtar, detay: `${g.employeeNo ?? '—'}→${sicil ?? '?'}` })
      continue
    }
    ozet.acikUygun++
    if (dryRun) continue

    const meta = acikMeta.get(g.anahtar)
    const baslatildiAt = meta?.startDateTime ?? simdi
    const masId = Number(g.masProductionMasterId)
    const opNo = g.operasyonNo ? Number(g.operasyonNo) : null
    const ifsOrderNo = g.workOrderNo

    // Session: o tezgah+personel için açık oturum yoksa aç (MAS başlangıç anıyla).
    let session = await prisma.iproOperatorSession.findFirst({
      where: { tezgahId: tz.id, personnelId: personId, cikisAt: null },
      select: { id: true },
    })
    if (!session) {
      session = await prisma.iproOperatorSession.create({
        data: { tezgahId: tz.id, personnelId: personId, authMethod: 'LIST', girisAt: baslatildiAt },
        select: { id: true },
      })
    }

    // IproProductionLog: idempotency anahtarıyla ara → yoksa aç, varsa (ACIK) dokunma (mükerrer önle).
    const mevcut = await prisma.iproProductionLog.findFirst({
      where: { masProductionMasterId: masId, ifsOrderNo, ifsOperationNo: opNo },
      select: { id: true, durum: true },
    })
    if (!mevcut) {
      await prisma.iproProductionLog.create({
        data: {
          tezgahId: tz.id, sessionId: session.id, personnelId: personId, kaynak: KAYNAK,
          masProductionMasterId: masId, masProductionDetayId: meta?.masDetayId ?? null,
          ifsOrderNo, ifsOperationNo: opNo, durum: 'ACIK', baslatildiAt,
          qtyComplete: 0, qtyScrap: 0,
        },
      })
      ozet.acilan++
    } else if (mevcut.durum === 'ACIK') {
      ozet.guncellenen++ // zaten açık — idempotent, ek yazma yok
    }
  }

  // ── (b) KAPANAN üretimler → IPRO'da ACIK eşleşeni kapat + OEE ──
  const kapananMeta = new Map<string, { endDateTime: Date | null; isFinished: boolean }>()
  for (const s of kapananSatir) {
    const a = HG_ANAHTAR(s.workOrderNo, s.masId)
    const m = kapananMeta.get(a)
    if (!m) kapananMeta.set(a, { endDateTime: s.endDateTime, isFinished: !!s.isFinished })
    else {
      if (s.endDateTime && (!m.endDateTime || s.endDateTime > m.endDateTime)) m.endDateTime = s.endDateTime
      m.isFinished = m.isFinished || !!s.isFinished
    }
  }
  for (const g of isEmirineGrupla(girdiye(kapananSatir, opByMas))) {
    const masId = Number(g.masProductionMasterId)
    const opNo = g.operasyonNo ? Number(g.operasyonNo) : null
    const log = await prisma.iproProductionLog.findFirst({
      where: { masProductionMasterId: masId, ifsOrderNo: g.workOrderNo, ifsOperationNo: opNo, durum: 'ACIK' },
      select: { id: true, tezgahId: true, baslatildiAt: true, tezgah: { select: { kod: true, _count: { select: { plcPinler: true } } } } },
    })
    if (!log) continue
    if (dryRun) {
      ozet.kapatilan++
      continue
    }
    const meta = kapananMeta.get(g.anahtar)
    const bitirildiAt = meta?.endDateTime ?? simdi
    const sinyalli = log.tezgah._count.plcPinler > 0

    // Sinyalli tezgah: IPRO PLC delta (uretimAdet) → mevcut OEE yolu. Sinyalsiz: MAS adedi.
    let uretimAdet: number | null = null
    if (sinyalli && log.baslatildiAt) {
      try {
        uretimAdet = (await isPenceresiDeltaToplami(prisma, log.tezgah.kod, log.baslatildiAt, bitirildiAt)).toplam
      } catch {
        uretimAdet = null
      }
    }
    await prisma.iproProductionLog.update({
      where: { id: log.id },
      data: { durum: 'KAPALI', bitirildiAt, qtyComplete: g.adet, tamamlandi: !!meta?.isFinished, uretimAdet },
    })
    // OEE: sinyalli → mevcut (PLC delta, uretimAdet log'da); sinyalsiz → MAS adedinden (hesapKaynagi '/MAS').
    try {
      await oeeKaydiHesaplaVeYaz(prisma, log.id, sinyalli ? undefined : { masAdedi: g.adet })
    } catch {
      /* OEE hatası ayna'yı bloklamasın */
    }
    ozet.kapatilan++
  }

  // ── (c) DURUŞLAR → IproMachineDowntime aç/kapat ──
  const acikDurusTezgahlari = new Set<string>() // MAS'ta hâlâ açık duruşu olan tezgah id'leri
  for (const d of duruslar) {
    const tz = d.tezgahKod ? tezgahByKod.get(d.tezgahKod) : undefined
    if (!tz) {
      ozet.atlanan.push({ sebep: 'durus_tezgah_eslesmedi', anahtar: `durus:${d.id}`, detay: d.tezgahKod ?? '—' })
      continue
    }
    acikDurusTezgahlari.add(tz.id)
    const sebepId = d.sebepKod ? sebepByKod.get(d.sebepKod) ?? null : null
    if (!sebepId && d.sebepKod && !ozet.eslesmeyenDurusSebepleri.includes(`${d.sebepKod} — ${d.sebepAd ?? ''}`.trim())) {
      ozet.eslesmeyenDurusSebepleri.push(`${d.sebepKod} — ${d.sebepAd ?? ''}`.trim())
    }
    if (dryRun) {
      ozet.durusAcilan++
      continue
    }
    // Bu tezgahta açık MAS duruşu yoksa aç (idempotent: tezgah+kaynak='MAS'+bitis=null tek açık).
    const mevcut = await prisma.iproMachineDowntime.findFirst({ where: { tezgahId: tz.id, kaynak: KAYNAK, bitis: null }, select: { id: true } })
    if (!mevcut) {
      await prisma.iproMachineDowntime.create({
        data: {
          tezgahId: tz.id, durusSebebiId: sebepId, baslangic: d.baslangic ?? simdi, kaynak: KAYNAK,
          yorum: sebepId ? null : `MAS: ${d.sebepKod ?? '?'} - ${d.sebepAd ?? ''}`.trim(),
        },
      })
      ozet.durusAcilan++
    }
  }
  // MAS'ta kapanmış (artık açık listede olmayan) IPRO açık MAS duruşlarını kapat.
  if (!dryRun) {
    const acikMasDuruslar = await prisma.iproMachineDowntime.findMany({ where: { kaynak: KAYNAK, bitis: null }, select: { id: true, tezgahId: true } })
    for (const md of acikMasDuruslar) {
      if (!acikDurusTezgahlari.has(md.tezgahId)) {
        await prisma.iproMachineDowntime.update({ where: { id: md.id }, data: { bitis: simdi } })
        ozet.durusKapatilan++
      }
    }
  }

  return ozet
}

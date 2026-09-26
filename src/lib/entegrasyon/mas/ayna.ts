import 'server-only'
import { prisma } from '@/lib/prisma'
import {
  acikUretimler,
  uretimlerByMasIds,
  acikOperatorler,
  acikDuruslar,
  acikDurusTezgahKodlari,
  rejectByMasIds,
  type MasUretimSatiri,
} from '@/lib/mas/uretim'
import { isEmirineGrupla, employeeNoToSicilNo, uretimAdedi, type MasUretimGirdi } from './uretim-mapper'
import { oeeKaydiHesaplaVeYaz } from '@/lib/ipro/oee-hesap'
import { isPenceresiDeltaToplami } from '@/lib/ipro/faz2-delta'
import { saniyeToCevrim } from '@/lib/ipro/cevrim-util'

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
  mukerrer: number // (personnelId, ifsOrderNo, ifsOperationNo) UNIQUE çakışması — ayrı satır açılamadı, atlandı
  kapatilan: number
  durusAcilan: number
  durusKapatilan: number
  hurdaOkunan: number // MAS'tan çekilen reject satırı (hedef loglar için)
  hurdaYazilan: number // IproHurdaKaydi upsert (yeni/güncel)
  hurdaLogGuncellenen: number // qtyScrap güncellenen log sayısı
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

export async function runMasAyna(opts: { dryRun?: boolean; limit?: number | null; durusDahil?: boolean } = {}): Promise<MasAynaOzet> {
  const dryRun = !!opts.dryRun
  const limit = opts.limit != null && opts.limit > 0 ? Math.floor(opts.limit) : null
  const durusDahil = opts.durusDahil !== false // default: duruşlar dahil
  const simdi = new Date()

  const [acikSatir, operatorler, duruslar, tezgahlar, personeller, durusSebepleri] = await Promise.all([
    acikUretimler(),
    acikOperatorler(),
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
    dryRun, acikOkunan: acikSatir.length, acikUygun: 0, acilan: 0, guncellenen: 0, mukerrer: 0,
    kapatilan: 0, durusAcilan: 0, durusKapatilan: 0, hurdaOkunan: 0, hurdaYazilan: 0, hurdaLogGuncellenen: 0,
    eslesmeyenDurusSebepleri: [], atlanan: [],
  }

  // Grup anahtarı → ilk satır meta (başlangıç, detayId + IFS alanları) — mapper bunları taşımaz.
  // Description/planlananAdet/deliveryDateTime/cycleTime iş emri bazında (operasyonlarda aynı) → ilk satır yeter.
  type AcikMeta = {
    startDateTime: Date | null
    masDetayId: number | null
    description: string | null
    planlananAdet: number | null
    deliveryDateTime: Date | null
    cycleTime: number | null
  }
  const acikMeta = new Map<string, AcikMeta>()
  for (const s of acikSatir) {
    const a = HG_ANAHTAR(s.workOrderNo, s.masId)
    if (!acikMeta.has(a))
      acikMeta.set(a, {
        startDateTime: s.startDateTime,
        masDetayId: s.masDetayId,
        description: s.description,
        planlananAdet: s.planlananAdet,
        deliveryDateTime: s.deliveryDateTime,
        cycleTime: s.cycleTime,
      })
  }

  // Grup + meta → IFS alanları (açılış create ve mevcut açık update için ORTAK; her tur MAS güncel adediyle).
  const ifsAlanlari = (g: { adet: number }, meta: AcikMeta | undefined) => {
    const cevrim = saniyeToCevrim(meta?.cycleTime ?? null)
    const adet = Math.round(g.adet)
    return {
      ifsPartDescription: meta?.description ?? null,
      ifsQtyDue: meta?.planlananAdet != null ? Math.round(meta.planlananAdet) : null,
      ifsDueDate: meta?.deliveryDateTime ?? null,
      ifsMachRunFactor: cevrim?.faktor ?? null,
      ifsRunTimeCode: cevrim?.kod ?? null,
      qtyComplete: adet,
      uretimAdet: adet,
    }
  }

  // ── (a) AÇIK üretimler ── (limit için deterministik sıra: masProductionMasterId artan)
  const acikGruplar = isEmirineGrupla(girdiye(acikSatir, opByMas)).sort(
    (a, b) => Number(a.masProductionMasterId) - Number(b.masProductionMasterId),
  )
  let islenenAcik = 0 // eşleşme koşullarını geçip işlenen grup sayısı (limit bunu sınırlar)
  for (const g of acikGruplar) {
    if (limit != null && islenenAcik >= limit) break
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
    islenenAcik++ // eşleşen grup; limit'e bu sayı bakılır (atlananlar bütçe harcamaz)
    if (dryRun) continue

    // Bir grubun yazma hatası TÜM turu (dolayısıyla KAPANIŞ dalını) kesmesin — per-grup try/catch.
    // P2002 (personnelId, ifsOrderNo, ifsOperationNo) UNIQUE: aynı kişi+iş+op başka masId altında
    // zaten var → mirror'da ayrı satır açılamaz, mükerrer say ve geç.
    try {
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

      const ifsData = ifsAlanlari(g, meta)

      // IproProductionLog: idempotency anahtarıyla ara → yoksa aç; varsa (ACIK) MAS güncel alanlarıyla güncelle.
      const mevcut = await prisma.iproProductionLog.findFirst({
        where: { masProductionMasterId: masId, ifsOrderNo, ifsOperationNo: opNo },
        select: { id: true, durum: true },
      })
      if (!mevcut) {
        // AÇIK-İŞ TEKİLLİĞİ: partial unique ipro_production_log_acik_is_uq (personnelId, ifsOrderNo,
        // ifsOperationNo) WHERE durum='ACIK'. MAS aynı kişi+iş+op için yeni master açtığında eskisi
        // IPRO'da hâlâ ACIK olabiliyor. P2002 aşağıda zaten yakalanıyor (mukerrer++); burada ÖNCEDEN
        // bakıp hangi kayıtla çakıştığını `atlanan`a yazıyoruz — sayaç yerine görünür sebep.
        const acikCakisan = await prisma.iproProductionLog.findFirst({
          where: { personnelId: personId, ifsOrderNo, ifsOperationNo: opNo, durum: 'ACIK' },
          select: { id: true, masProductionMasterId: true, baslatildiAt: true },
        })
        if (acikCakisan) {
          ozet.mukerrer++
          ozet.atlanan.push({
            sebep: 'acik_is_cakismasi', anahtar: g.anahtar,
            detay: `kişide aynı iş emri/operasyon zaten ACIK: log=${acikCakisan.id} mas=${acikCakisan.masProductionMasterId ?? '—'} başlangıç=${acikCakisan.baslatildiAt?.toISOString() ?? '—'} (yeni mas=${masId})`,
          })
          continue
        }
        await prisma.iproProductionLog.create({
          data: {
            tezgahId: tz.id, sessionId: session.id, personnelId: personId, kaynak: KAYNAK,
            masProductionMasterId: masId, masProductionDetayId: meta?.masDetayId ?? null,
            ifsOrderNo, ifsOperationNo: opNo, durum: 'ACIK', baslatildiAt,
            qtyScrap: 0, ...ifsData,
          },
        })
        ozet.acilan++
      } else if (mevcut.durum === 'ACIK') {
        // Zaten açık: IFS alanları + güncel adet yenilenir (MAS'ta adet/plan/teslim değişebilir).
        await prisma.iproProductionLog.update({ where: { id: mevcut.id }, data: ifsData })
        ozet.guncellenen++
      }
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2002') {
        ozet.mukerrer++
      } else {
        ozet.atlanan.push({ sebep: 'yazma_hatasi', anahtar: g.anahtar, detay: (e as Error)?.message?.slice(0, 120) ?? '?' })
      }
    }
  }

  // ── (b) KAPANAN üretimler → IPRO'da ACIK eşleşeni kapat + OEE ──
  // TERSİNE TARAMA (pencere YOK): IPRO'da ACIK+MAS kayıtların masProductionMasterId'lerini topla,
  // MAS'ta id ile sorgula; MAS'ta EndDateTime dolu VEYA Active=0 VEYA kayıt yoksa → IPRO'da kapat.
  // (Eski "son 24 saat" penceresi pencere dışında kapananları hiç yakalamıyordu — CN08 açık kalıyordu.)
  const acikMasLoglar = await prisma.iproProductionLog.findMany({
    where: { durum: 'ACIK', kaynak: KAYNAK },
    select: {
      id: true,
      masProductionMasterId: true,
      baslatildiAt: true,
      qtyComplete: true,
      tezgah: { select: { kod: true, _count: { select: { plcPinler: true } } } },
    },
  })
  const kapanisIds = [...new Set(acikMasLoglar.map((l) => l.masProductionMasterId).filter((x): x is number => x != null))]
  const masSatirlar = kapanisIds.length ? await uretimlerByMasIds(kapanisIds) : []
  // masId → güncel durum (endDateTime/active + adet/isFinished — pm'in detay satırlarından türetilir).
  const masById = new Map<number, { endDateTime: Date | null; active: boolean; isFinished: boolean; adet: number }>()
  for (const r of masSatirlar) {
    const rowAdet = uretimAdedi(r)
    const cur = masById.get(r.masId)
    if (!cur) {
      masById.set(r.masId, { endDateTime: r.endDateTime, active: r.active !== false, isFinished: !!r.isFinished, adet: rowAdet })
    } else {
      if (r.endDateTime && (!cur.endDateTime || r.endDateTime > cur.endDateTime)) cur.endDateTime = r.endDateTime
      cur.isFinished = cur.isFinished || !!r.isFinished
      cur.adet = Math.max(cur.adet, rowAdet)
      cur.active = cur.active && r.active !== false
    }
  }
  for (const log of acikMasLoglar) {
    const masId = log.masProductionMasterId
    if (masId == null) continue
    const agg = masById.get(masId)
    // Kapalı: MAS'ta kayıt yok VEYA EndDateTime dolu VEYA Active=0. Aksi halde hâlâ açık → geç.
    const kapali = !agg || agg.endDateTime != null || agg.active === false
    if (!kapali) continue
    if (dryRun) {
      ozet.kapatilan++
      continue
    }
    // Bir kaydın kapanış hatası diğerlerini kesmesin — per-log try/catch.
    try {
      const bitirildiAt = agg?.endDateTime ?? simdi
      const adet = agg != null ? Math.round(agg.adet) : log.qtyComplete
      const tamamlandi = agg ? agg.isFinished : true // MAS'ta kayıt yoksa tamamlanmış/kaldırılmış say
      const sinyalli = log.tezgah._count.plcPinler > 0

      // uretimAdet: SİNYALLİ → IPRO PLC delta; SİNYALSİZ → MAS adedi (log'a yazılır ki oeeHesaplanabilir
      // guard'ı [uretimAdet!=null] geçsin). log.hesapKaynagi sinyalsizde 'MAS' (audit).
      let uretimAdet: number | null = null
      let logHesapKaynagi: string | null = null
      if (sinyalli && log.baslatildiAt) {
        try {
          uretimAdet = (await isPenceresiDeltaToplami(prisma, log.tezgah.kod, log.baslatildiAt, bitirildiAt)).toplam
        } catch {
          uretimAdet = null
        }
      } else if (!sinyalli) {
        uretimAdet = adet
        logHesapKaynagi = 'MAS'
      }
      await prisma.iproProductionLog.update({
        where: { id: log.id },
        data: {
          durum: 'KAPALI',
          bitirildiAt,
          qtyComplete: adet,
          tamamlandi,
          uretimAdet,
          ...(logHesapKaynagi ? { hesapKaynagi: logHesapKaynagi } : {}),
        },
      })
      // OEE: uretilen adet log'dan okunur. Çoklu işte perf+quality+oee null (COKLU_IS) — oee-hesap içinde.
      try {
        await oeeKaydiHesaplaVeYaz(prisma, log.id)
      } catch {
        /* OEE hatası ayna'yı bloklamasın */
      }
      ozet.kapatilan++
    } catch (e) {
      ozet.atlanan.push({ sebep: 'kapatma_hatasi', anahtar: `log:${log.id}`, detay: (e as Error)?.message?.slice(0, 120) ?? '?' })
    }
  }

  // ── (c) DURUŞLAR → IproMachineDowntime aç/kapat ── (durus=0 ile tümüyle atlanır)
  if (durusDahil) {
  // AÇMA: yalnız pencereli (acikDuruslar, son N saat) — 2017 çöp kayıtları elenir.
  for (const d of duruslar) {
    const tz = d.tezgahKod ? tezgahByKod.get(d.tezgahKod) : undefined
    if (!tz) {
      ozet.atlanan.push({ sebep: 'durus_tezgah_eslesmedi', anahtar: `durus:${d.id}`, detay: d.tezgahKod ?? '—' })
      continue
    }
    const sebepId = d.sebepKod ? sebepByKod.get(d.sebepKod) ?? null : null
    if (!sebepId && d.sebepKod && !ozet.eslesmeyenDurusSebepleri.includes(`${d.sebepKod} — ${d.sebepAd ?? ''}`.trim())) {
      ozet.eslesmeyenDurusSebepleri.push(`${d.sebepKod} — ${d.sebepAd ?? ''}`.trim())
    }
    if (dryRun) {
      ozet.durusAcilan++
      continue
    }
    // Bu tezgahta açık MAS duruşu yoksa aç (idempotent: tezgah+kaynak='MAS'+bitis=null tek açık).
    // Partial-unique çakışması (yarış) tüm turu kesmesin → per-duruş try/catch.
    try {
      const mevcut = await prisma.iproMachineDowntime.findFirst({ where: { tezgahId: tz.id, kaynak: KAYNAK, bitis: null }, select: { id: true } })
      if (!mevcut) {
        // MAS DEVRALIR: aynı tezgahta açık OTO (otomatik) veya TAKVIM (mola) duruş varsa kapat — sebepli
        // MAS kaydı öncelikli (partial unique tezgah başına tek açık duruşa izin verir; kapatılmadan açılamaz).
        await prisma.iproMachineDowntime.updateMany({
          where: { tezgahId: tz.id, kaynak: { in: ['OTO', 'TAKVIM'] }, bitis: null },
          data: { bitis: d.baslangic ?? simdi },
        })
        await prisma.iproMachineDowntime.create({
          data: {
            tezgahId: tz.id, durusSebebiId: sebepId, baslangic: d.baslangic ?? simdi, kaynak: KAYNAK,
            yorum: sebepId ? null : `MAS: ${d.sebepKod ?? '?'} - ${d.sebepAd ?? ''}`.trim(),
          },
        })
        ozet.durusAcilan++
      }
    } catch (e) {
      ozet.atlanan.push({ sebep: 'durus_yazma_hatasi', anahtar: `durus:${d.id}`, detay: (e as Error)?.message?.slice(0, 120) ?? '?' })
    }
  }
  // KAPATMA: PENCERE YOK. MAS'ta ŞU AN açık duruşu olan tezgah kodları (tam küme) alınır; IPRO'da
  // açık kalan MAS duruşlarından bu kümede OLMAYAN her tezgah kapatılır (bayat pencere yüzünden
  // açık kalmasın — PE04 MAS'ta üretimde ama IPRO'da 'duruşta' kalıyordu).
  const liveDurusKods = new Set(await acikDurusTezgahKodlari())
  const acikMasDuruslar = await prisma.iproMachineDowntime.findMany({
    where: { kaynak: KAYNAK, bitis: null },
    select: { id: true, tezgah: { select: { kod: true } } },
  })
  for (const md of acikMasDuruslar) {
    if (liveDurusKods.has(md.tezgah.kod)) continue
    ozet.durusKapatilan++
    if (!dryRun) await prisma.iproMachineDowntime.update({ where: { id: md.id }, data: { bitis: simdi } })
  }
  } // durusDahil

  // ── (d) HURDA → IproHurdaKaydi (MAS Production.ProductionReject aynası) ──
  // Hedef: MAS kaynaklı, AÇIK veya son 48 saatte KAPANMIŞ loglar. reject idempotent (masRejectId UNIQUE);
  // zaman masTarih'ten geçer. log.qtyScrap = Σ adet (rework HARİÇ). ifsScrapYazildi'ye DOKUNULMAZ, IFS'e yazılmaz.
  const hurdaHedef = await prisma.iproProductionLog.findMany({
    where: {
      kaynak: KAYNAK,
      masProductionMasterId: { not: null },
      OR: [{ durum: 'ACIK' }, { durum: 'KAPALI', bitirildiAt: { gte: new Date(simdi.getTime() - 48 * 3600_000) } }],
    },
    select: { id: true, masProductionMasterId: true, durum: true },
  })
  const logByMasId = new Map<number, { id: string; durum: string }>()
  for (const l of hurdaHedef) if (l.masProductionMasterId != null) logByMasId.set(l.masProductionMasterId, { id: l.id, durum: l.durum })
  const hurdaMasIds = [...logByMasId.keys()]
  if (hurdaMasIds.length) {
    const rejectler = await rejectByMasIds(hurdaMasIds) // MAS okuma (dryRun'da da okunur, yazılmaz)
    ozet.hurdaOkunan = rejectler.length
    const etkilenenLog = new Set<string>()
    if (!dryRun) {
      for (const rj of rejectler) {
        const log = logByMasId.get(rj.masId)
        if (!log) continue
        const adet = Math.round(rj.adet)
        try {
          await prisma.iproHurdaKaydi.upsert({
            where: { masRejectId: rj.rejectId },
            update: { adet, sebepKod: rj.sebepKod, sebepAd: rj.sebepAd, isRework: !!rj.isRework, zaman: rj.zaman ?? simdi, productionLogId: log.id },
            create: { productionLogId: log.id, masRejectId: rj.rejectId, sebepKod: rj.sebepKod, sebepAd: rj.sebepAd, adet, isRework: !!rj.isRework, zaman: rj.zaman ?? simdi, kaynak: KAYNAK },
          })
          ozet.hurdaYazilan++
          etkilenenLog.add(log.id)
        } catch (e) {
          ozet.atlanan.push({ sebep: 'hurda_yazma_hatasi', anahtar: `reject:${rj.rejectId}`, detay: (e as Error)?.message?.slice(0, 120) ?? '?' })
        }
      }
      // Etkilenen loglarda qtyScrap = Σ adet (rework hariç); KAPALI ise OEE (quality) yeniden hesapla.
      for (const logId of etkilenenLog) {
        try {
          const agg = await prisma.iproHurdaKaydi.aggregate({ where: { productionLogId: logId, isRework: false }, _sum: { adet: true } })
          await prisma.iproProductionLog.update({ where: { id: logId }, data: { qtyScrap: agg._sum.adet ?? 0 } })
          ozet.hurdaLogGuncellenen++
          const durum = [...logByMasId.values()].find((v) => v.id === logId)?.durum
          if (durum === 'KAPALI') {
            try { await oeeKaydiHesaplaVeYaz(prisma, logId) } catch { /* OEE hatası ayna'yı bloklamasın */ }
          }
        } catch (e) {
          ozet.atlanan.push({ sebep: 'hurda_scrap_guncelleme_hatasi', anahtar: `log:${logId}`, detay: (e as Error)?.message?.slice(0, 120) ?? '?' })
        }
      }
    }
  }

  return ozet
}

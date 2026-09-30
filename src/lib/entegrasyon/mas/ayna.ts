import 'server-only'
import { prisma } from '@/lib/prisma'
import {
  acikUretimler,
  uretimlerByMasIds,
  acikOperatorler,
  durusPenceresi,
  duruslarByIds,
  rejectByMasIds,
  type MasUretimSatiri,
} from '@/lib/mas/uretim'
import { isEmirineGrupla, employeeNoToSicilNo, uretimAdedi, type MasUretimGirdi } from './uretim-mapper'
import { oeeKaydiHesaplaVeYaz } from '@/lib/ipro/oee-hesap'
import { isPenceresiDeltaToplami } from '@/lib/ipro/faz2-delta'
import { saniyeToCevrim } from '@/lib/ipro/cevrim-util'
import { durusAynaPlani, type DurusVeri } from './durus-ayna'

/**
 * MAS MES → IPRO ayna (yazma). Açık üretim → IproProductionLog ACIK; kapanan → KAPALI + OEE;
 * açık/kapanan duruş → IproMachineDowntime. Hepsi IDEMPOTENT (idempotency anahtarı
 * masProductionMasterId+ifsOrderNo+ifsOperationNo; duruşta MAS ProductionDowntime.Id = masId). dryRun DB'ye yazmaz.
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
  durusGuncellenen: number // masId'li kayıtta bitiş/sebep/başlangıç değişikliği (kapanış dahil değil)
  durusBaglanan: number // masId'siz eski kayıt MAS satırına bağlandı
  durusMasSilinmis: number // MAS'ta silinmiş/pasif → sıfır süreye çekildi
  durusSifirSure: number // süresi 0 kapalı MAS duruşu, yazılmadı
  durusPlanDisiSilinen: number // UD/0151 (plan dışı) IPRO kaydı silindi
  durusBaslangicYok: number
  durusOeeYeniden: number // duruş değişikliği değen KAPALI log OEE yeniden hesabı
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
    durusDahil ? durusPenceresi() : Promise.resolve([]),
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
    kapatilan: 0, durusAcilan: 0, durusKapatilan: 0, durusGuncellenen: 0, durusBaglanan: 0, durusMasSilinmis: 0, durusSifirSure: 0, durusPlanDisiSilinen: 0,
    durusBaslangicYok: 0, durusOeeYeniden: 0, hurdaOkunan: 0, hurdaYazilan: 0, hurdaLogGuncellenen: 0,
    eslesmeyenDurusSebepleri: [], atlanan: [],
  }

  // Grup anahtarı → ilk satır meta (başlangıç, detayId + IFS alanları) — mapper bunları taşımaz.
  // Description/planlananAdet/deliveryDateTime/cycleTime iş emri bazında (operasyonlarda aynı) → ilk satır yeter.
  type AcikMeta = {
    startDateTime: Date | null
    masDetayId: number | null
    description: string | null
    partNo: string | null
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
        partNo: s.partNo,
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
      ifsPartNo: meta?.partNo ?? null, // MAS WorkOrder→Material.Code; çevrim sapma raporu parça bazlı kırılım için
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
  const masById = new Map<number, { endDateTime: Date | null; active: boolean; isFinished: boolean; adet: number; carpan: number | null }>()
  for (const r of masSatirlar) {
    const rowAdet = uretimAdedi(r)
    const rowCarpan = r.counterMultiplier != null ? Math.round(r.counterMultiplier) : null
    const cur = masById.get(r.masId)
    if (!cur) {
      masById.set(r.masId, { endDateTime: r.endDateTime, active: r.active !== false, isFinished: !!r.isFinished, adet: rowAdet, carpan: rowCarpan })
    } else {
      if (r.endDateTime && (!cur.endDateTime || r.endDateTime > cur.endDateTime)) cur.endDateTime = r.endDateTime
      if (rowCarpan != null && (cur.carpan == null || rowCarpan > cur.carpan)) cur.carpan = rowCarpan
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

      // SAYIM KAYNAĞI: MAS kaynaklı loglarda uretimAdet = MAS Amount (SİNYALLİ DAHİL — PLC ham Σdelta
      // çarpansız + kaçırılan okumalar yüzünden MAS Amount'un altında kalıyordu). plcAdet = sinyalli ise
      // PLC Σdelta (denetim/karşılaştırma), masCarpan = MAS CounterMultiplier. hesapKaynagi 'MAS'.
      const uretimAdet = adet
      let plcAdet: number | null = null
      if (sinyalli && log.baslatildiAt) {
        try {
          plcAdet = (await isPenceresiDeltaToplami(prisma, log.tezgah.kod, log.baslatildiAt, bitirildiAt)).toplam
        } catch {
          plcAdet = null
        }
      }
      await prisma.iproProductionLog.update({
        where: { id: log.id },
        data: {
          durum: 'KAPALI',
          bitirildiAt,
          qtyComplete: adet,
          tamamlandi,
          uretimAdet,
          plcAdet,
          masCarpan: agg?.carpan ?? null,
          hesapKaynagi: 'MAS',
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

  // ── (c) DURUŞLAR → IproMachineDowntime (MAS satırı başına tek kayıt, masId eşleşmesi) ──
  // Pencere: MAS'ta açık (son MAS_DURUS_SAAT) + son 48 saatte kapanan. Bitiş = MAS EndDateTime ('simdi' değil).
  // Duruş dizisi (UD → Kalıp → UD) ayrı kayıtlar olur. Plan saf fonksiyonda (durus-ayna.ts, birim testli).
  if (durusDahil) {
    try {
      await durusAynala(duruslar, tezgahByKod, sebepByKod, ozet, dryRun, simdi)
    } catch (e) {
      ozet.atlanan.push({ sebep: 'durus_ayna_hatasi', anahtar: 'durus', detay: (e as Error)?.message?.slice(0, 120) ?? '?' })
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

async function durusAynala(
  mas: Awaited<ReturnType<typeof durusPenceresi>>,
  tezgahByKod: Map<string, { id: string; sinyalli: boolean }>,
  sebepByKod: Map<string, string>,
  ozet: MasAynaOzet,
  dryRun: boolean,
  simdi: Date,
): Promise<void> {
  const pencereIds = new Set(mas.map((m) => m.id))
  const enEskiBaslangic = mas.reduce<number>((min, m) => (m.baslangic ? Math.min(min, m.baslangic.getTime()) : min), simdi.getTime())
  const sel = { id: true, masId: true, tezgahId: true, baslangic: true, bitis: true, durusSebebiId: true, durusSebebi: { select: { kod: true } } } as const

  // IPRO tarafı: pencere satırlarına bağlı kayıtlar + tüm AÇIK MAS kayıtları + pencere aralığındaki masId'siz eski kayıtlar.
  const iproHam = await prisma.iproMachineDowntime.findMany({
    where: {
      kaynak: KAYNAK,
      OR: [
        { masId: { in: [...pencereIds] } },
        { bitis: null },
        { masId: null, baslangic: { gte: new Date(enEskiBaslangic - 60_000) } },
      ],
    },
    select: sel,
  })
  const ipro = iproHam.map(({ durusSebebi, ...r }) => ({ ...r, sebepKod: durusSebebi?.kod ?? null }))

  // Pencere dışına düşmüş açık masId'li kayıtlar: MAS'taki güncel hallerini Id ile çek.
  const disari = ipro.filter((r) => r.masId != null && r.bitis === null && !pencereIds.has(r.masId)).map((r) => r.masId!)
  const disariMas = disari.length ? await duruslarByIds(disari) : []
  const bulunan = new Set(disariMas.map((m) => m.id))

  const plan = durusAynaPlani({
    mas: [...mas, ...disariMas],
    masBulunamayan: disari.filter((id) => !bulunan.has(id)),
    ipro,
    tezgahByKod: new Map([...tezgahByKod].map(([k, v]) => [k, v.id])),
    sebepByKod,
  })

  for (const a of plan.atlanan) {
    if (a.sebep === 'plan_disi') continue
    if (a.sebep === 'baslangic_yok') ozet.durusBaslangicYok++
    else if (a.sebep === 'sifir_sure') ozet.durusSifirSure++
    else ozet.atlanan.push({ sebep: 'durus_tezgah_eslesmedi', anahtar: `durus:${a.masId}`, detay: a.detay })
  }
  for (const e of plan.eslesmeyenSebepler) if (!ozet.eslesmeyenDurusSebepleri.includes(e)) ozet.eslesmeyenDurusSebepleri.push(e)

  const degen: { tezgahId: string; bas: Date; bit: Date }[] = []
  const iproById = new Map(ipro.map((r) => [r.id, r]))
  const kaydet = (tezgahId: string, bas: Date, bit: Date | null) => degen.push({ tezgahId, bas, bit: bit ?? simdi })

  const say = () => {
    for (const g of plan.guncelle) {
      if (g.data.masId != null) ozet.durusBaglanan++
      const eski = iproById.get(g.id)
      if (eski?.bitis === null && g.data.bitis != null) ozet.durusKapatilan++
      else ozet.durusGuncellenen++
    }
    ozet.durusAcilan += plan.olustur.length
    ozet.durusMasSilinmis += plan.masSilinmis.length
    ozet.durusKapatilan += plan.eskiAcikEslesmeyen.length
    ozet.durusPlanDisiSilinen += plan.sil.length
  }
  if (dryRun) {
    say()
    return
  }

  // 0) Plan dışı (UD/0151) kayıtlar silinir — duruş değil, OEE'ye kayıp yazılmamalı.
  if (plan.sil.length) {
    try {
      const r = await prisma.iproMachineDowntime.deleteMany({ where: { id: { in: plan.sil.map((x) => x.id) }, kaynak: KAYNAK } })
      ozet.durusPlanDisiSilinen += r.count
      for (const x of plan.sil) kaydet(x.tezgahId, x.baslangic, x.bitis)
    } catch (e) {
      ozet.atlanan.push({ sebep: 'durus_plan_disi_silme_hatasi', anahtar: 'durus', detay: (e as Error)?.message?.slice(0, 120) ?? '?' })
    }
  }
  // 1) Güncellemeler (kapanışlar önce — partial unique: tezgah başına tek açık duruş).
  for (const g of plan.guncelle) {
    try {
      await prisma.iproMachineDowntime.update({ where: { id: g.id }, data: g.data })
      const eski = iproById.get(g.id)!
      if (g.data.masId != null) ozet.durusBaglanan++
      if (eski.bitis === null && g.data.bitis != null) ozet.durusKapatilan++
      else ozet.durusGuncellenen++
      kaydet(eski.tezgahId, eski.baslangic, eski.bitis)
      kaydet(eski.tezgahId, g.data.baslangic ?? eski.baslangic, g.data.bitis === undefined ? eski.bitis : g.data.bitis)
    } catch (e) {
      ozet.atlanan.push({ sebep: 'durus_guncelleme_hatasi', anahtar: `ipro:${g.id}`, detay: (e as Error)?.message?.slice(0, 120) ?? '?' })
    }
  }
  // 2) MAS'ta silinmiş → sıfır süre (kayıt korunur, etkisi sıfırlanır).
  for (const s of plan.masSilinmis) {
    try {
      await prisma.iproMachineDowntime.update({ where: { id: s.id }, data: { bitis: s.baslangic, yorum: "MAS'ta silindi" } })
      ozet.durusMasSilinmis++
      const eski = iproById.get(s.id)!
      kaydet(eski.tezgahId, eski.baslangic, eski.bitis)
    } catch (e) {
      ozet.atlanan.push({ sebep: 'durus_silinmis_hatasi', anahtar: `ipro:${s.id}`, detay: (e as Error)?.message?.slice(0, 120) ?? '?' })
    }
  }
  // 3) Geçiş dönemi: masId'siz, MAS'la eşleşmeyen açık eski kayıt. Gerçek bitiş bilinmiyor → 'simdi'.
  //    Geri doldurma scripti eski kayıtları bağladıktan sonra bu yol boş kalır.
  for (const e of plan.eskiAcikEslesmeyen) {
    try {
      await prisma.iproMachineDowntime.update({ where: { id: e.id }, data: { bitis: simdi } })
      ozet.durusKapatilan++
    } catch (err) {
      ozet.atlanan.push({ sebep: 'durus_eski_kapatma_hatasi', anahtar: `ipro:${e.id}`, detay: (err as Error)?.message?.slice(0, 120) ?? '?' })
    }
  }
  // 4) Yeni kayıtlar (başlangıç sırasıyla). Açık kayıt açılırken aynı tezgahtaki açık OTO/TAKVIM kapanır (MAS devralır).
  for (const o of plan.olustur) {
    try {
      if (o.bitis === null) {
        await prisma.iproMachineDowntime.updateMany({
          where: { tezgahId: o.tezgahId, kaynak: { in: ['OTO', 'TAKVIM'] }, bitis: null },
          data: { bitis: o.baslangic },
        })
      }
      const data: DurusVeri & { masId: number; kaynak: string } = { ...o, kaynak: KAYNAK }
      await prisma.iproMachineDowntime.create({ data })
      ozet.durusAcilan++
      kaydet(o.tezgahId, o.baslangic, o.bitis)
    } catch (e) {
      ozet.atlanan.push({ sebep: 'durus_yazma_hatasi', anahtar: `durus:${o.masId}`, detay: (e as Error)?.message?.slice(0, 120) ?? '?' })
    }
  }

  // 5) Değişen duruşların değdiği KAPALI MAS işlerinde OEE yeniden (geç gelen/düzelen duruş OEE'ye yansısın).
  if (degen.length) {
    const tezgahIds = [...new Set(degen.map((d) => d.tezgahId))]
    const enEski = new Date(Math.min(...degen.map((d) => d.bas.getTime())))
    const loglar = await prisma.iproProductionLog.findMany({
      where: { durum: 'KAPALI', tezgahId: { in: tezgahIds }, baslatildiAt: { not: null }, bitirildiAt: { gte: enEski } },
      select: { id: true, tezgahId: true, baslatildiAt: true, bitirildiAt: true },
    })
    for (const l of loglar) {
      const lb = l.baslatildiAt!.getTime(), le = l.bitirildiAt!.getTime()
      if (!degen.some((d) => d.tezgahId === l.tezgahId && d.bas.getTime() < le && lb < d.bit.getTime())) continue
      try {
        await oeeKaydiHesaplaVeYaz(prisma, l.id)
        ozet.durusOeeYeniden++
      } catch {
        /* OEE hatası ayna'yı bloklamasın */
      }
    }
  }
}

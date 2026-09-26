import 'server-only'
import { prisma } from '@/lib/prisma'
import { cevrimSaniye } from '@/lib/ipro/cevrim-util'
import { esikSaniye, cevrimMedyaniGaplerden } from '@/lib/ipro/durus-esik'
import { aktifMolaPenceresi } from '@/lib/ipro/mola-takvim'

/**
 * OTOMATİK DURUŞ TESPİTİ (Faz 1, Seçenek B — ayrı tarayıcı; poller'a DOKUNMAZ).
 * Sinyalli (plcPinler>0) ve AÇIK İŞİ olan tezgahta PLC sayacı eşikten uzun durursa OTO duruş açar;
 * sayaç yeniden sayınca (veya iş kapanınca) kapatır. İş yoksa duruş AÇMAZ (boşta sayılır). İdempotent.
 *
 * MAS aynası ile çakışma: tezgah başına tek açık duruş (partial unique) → OTO yalnız HİÇ açık duruş
 * yokken açılır (MAS zaten açıksa atlanır). "MAS devralır" (case 3) ayna tarafında: MAS duruşu açmadan
 * önce açık OTO'yu kapatır (ayna.ts). Kiosk/terminal/is-basla/is-bitir'e DOKUNULMAZ.
 */
const KAYNAK_OTO = 'OTO'
const KAYNAK_TAKVIM = 'TAKVIM'
export const OTO_SEBEP_KOD = 'OTO-SAYAC'

export interface OtoDurusOzet {
  dryRun: boolean
  taranan: number // sinyalli + açık işi olan tezgah sayısı
  acilan: number
  kapatilanDelta: number // sayaç yeniden saymaya başladı
  kapatilanIsKapandi: number // açık iş kalmadı → OTO anlamsız, kapat
  takvimAcilan: number // mola penceresine girildi → TAKVIM duruşu açıldı
  takvimKapatilan: number // mola bitti/iş kapandı → TAKVIM duruşu kapatıldı
  atlanan: { kod: string; sebep: string }[]
  ornekler: { kod: string; yasSn: number; esik: number; cevrimSn: number | null; ifsOrderNo: string | null }[]
  takvimOrnekler: { kod: string; sebepId: string | null; pencereBitis: string }[]
}

export async function runOtoDurus(opts: { dryRun?: boolean } = {}): Promise<OtoDurusOzet> {
  const dryRun = !!opts.dryRun
  const simdi = new Date()
  const ozet: OtoDurusOzet = { dryRun, taranan: 0, acilan: 0, kapatilanDelta: 0, kapatilanIsKapandi: 0, takvimAcilan: 0, takvimKapatilan: 0, atlanan: [], ornekler: [], takvimOrnekler: [] }

  // Sinyalli + açık işi olan tezgahlar (tezgah bazında; çoklu açık işte en erken başlangıç referans).
  const acikIsler = await prisma.iproProductionLog.findMany({
    where: { durum: 'ACIK' },
    select: {
      tezgahId: true,
      baslatildiAt: true,
      ifsOrderNo: true,
      ifsMachRunFactor: true,
      ifsRunTimeCode: true,
      tezgah: { select: { kod: true, masGrupKodu: true, _count: { select: { plcPinler: true } } } },
    },
  })
  type Hedef = { tezgahId: string; kod: string; bolum: string | null; baslatildiAt: Date | null; ifsOrderNo: string | null; mach: number | null; kod2: string | null }
  const byTezgah = new Map<string, Hedef>()
  for (const l of acikIsler) {
    if (l.tezgah._count.plcPinler === 0) continue // sinyalsiz → OTO kapsamı dışı
    const cur = byTezgah.get(l.tezgahId)
    if (!cur) {
      byTezgah.set(l.tezgahId, {
        tezgahId: l.tezgahId, kod: l.tezgah.kod, bolum: l.tezgah.masGrupKodu ?? null, baslatildiAt: l.baslatildiAt,
        ifsOrderNo: l.ifsOrderNo, mach: l.ifsMachRunFactor, kod2: l.ifsRunTimeCode,
      })
    } else if (l.baslatildiAt && cur.baslatildiAt && l.baslatildiAt < cur.baslatildiAt) {
      cur.baslatildiAt = l.baslatildiAt // en erken
    }
  }
  ozet.taranan = byTezgah.size

  // OTO sebep (yalnız gerçek run'da seed) — kod OTO-SAYAC.
  let otoSebepId: string | null = null
  if (!dryRun) {
    const s = await prisma.iproDurusSebebi.upsert({
      where: { kod: OTO_SEBEP_KOD },
      update: {},
      create: { kod: OTO_SEBEP_KOD, ad: 'Otomatik (sebep girilmedi)', bitisTipi: 'Both', renkKodu: '#94a3b8' },
      select: { id: true },
    })
    otoSebepId = s.id
  }

  for (const t of byTezgah.values()) {
    // Açık duruş (herhangi bir kaynak) — partial unique gereği en fazla bir tane.
    const acikDurus = await prisma.iproMachineDowntime.findFirst({
      where: { tezgahId: t.tezgahId, bitis: null },
      select: { id: true, kaynak: true, baslangic: true },
    })

    // ── MOLA (TAKVIM) — OTO mantığından ÖNCE. Aktif mola penceresindeyse duruş TAKVIM'e aittir. ──
    const pencere = await aktifMolaPenceresi(prisma, t.bolum, simdi)
    if (pencere) {
      if (acikDurus?.kaynak === 'MAS') { ozet.atlanan.push({ kod: t.kod, sebep: 'mola_ama_mas_acik' }); continue }
      if (acikDurus?.kaynak === KAYNAK_TAKVIM) continue // zaten açık TAKVIM duruşu
      if (acikDurus?.kaynak === KAYNAK_OTO && !dryRun) {
        // Mola devralır: açık OTO'yu pencere başında (mümkünse) kapat, sonra TAKVIM aç.
        const bitis = pencere.basla.getTime() > acikDurus.baslangic.getTime() ? pencere.basla : simdi
        await prisma.iproMachineDowntime.update({ where: { id: acikDurus.id }, data: { bitis } })
      }
      if (!dryRun) {
        await prisma.iproMachineDowntime.create({
          data: { tezgahId: t.tezgahId, durusSebebiId: pencere.sebepId, baslangic: pencere.basla, kaynak: KAYNAK_TAKVIM, yorum: 'Otomatik: mola takvimi' },
        })
      }
      ozet.takvimAcilan++
      if (ozet.takvimOrnekler.length < 10) ozet.takvimOrnekler.push({ kod: t.kod, sebepId: pencere.sebepId, pencereBitis: pencere.bitis.toISOString() })
      continue // pencere içindeyken OTO açma
    }
    if (acikDurus?.kaynak === KAYNAK_TAKVIM) {
      // Pencere bitti → açık TAKVIM duruşunu pencere bitişiyle kapat (yoksa şimdi).
      const bitenPencere = await aktifMolaPenceresi(prisma, t.bolum, acikDurus.baslangic)
      const kapanis = bitenPencere && bitenPencere.bitis.getTime() <= simdi.getTime() ? bitenPencere.bitis : simdi
      if (!dryRun) await prisma.iproMachineDowntime.update({ where: { id: acikDurus.id }, data: { bitis: kapanis } })
      ozet.takvimKapatilan++
      continue // bu turda OTO değerlendirme (mola bitişi bir sonraki tura)
    }

    // Son sayaç okuması + çevrim için son ~51 satır.
    const sonrows = await prisma.iproSayacOkuma.findMany({
      where: { tezgahKod: t.kod }, orderBy: { ts: 'desc' }, take: 51, select: { ts: true },
    })
    const sonTs = sonrows[0]?.ts ?? null

    // ── KAPATMA: açık OTO duruş varsa ──
    if (acikDurus?.kaynak === KAYNAK_OTO) {
      // Yeni delta (baslangic sonrası okuma) geldiyse → kapat.
      const yeni = await prisma.iproSayacOkuma.findFirst({
        where: { tezgahKod: t.kod, ts: { gt: acikDurus.baslangic } }, orderBy: { ts: 'asc' }, select: { ts: true },
      })
      if (yeni) {
        if (!dryRun) await prisma.iproMachineDowntime.update({ where: { id: acikDurus.id }, data: { bitis: yeni.ts } })
        ozet.kapatilanDelta++
      }
      continue // hâlâ delta yoksa açık kalsın
    }
    // Açık MAS/başka duruş varsa OTO açma (MAS zaten kapsıyor).
    if (acikDurus) {
      ozet.atlanan.push({ kod: t.kod, sebep: `acik_durus_${acikDurus.kaynak}` })
      continue
    }

    // ── AÇMA ── referans: son sayaç okuması; hiç yoksa iş başlangıcı.
    const refTs = sonTs ?? t.baslatildiAt
    if (!refTs) { ozet.atlanan.push({ kod: t.kod, sebep: 'referans_yok' }); continue }
    const yasSn = (simdi.getTime() - refTs.getTime()) / 1000

    // Çevrim: son ~50 gap medyanı; yoksa IFS planlı çevrim.
    let cevrimSn: number | null = null
    if (sonrows.length >= 3) {
      const asc = sonrows.map((r) => r.ts.getTime()).sort((a, b) => a - b)
      const gaps: number[] = []
      for (let i = 1; i < asc.length; i++) gaps.push((asc[i] - asc[i - 1]) / 1000)
      cevrimSn = cevrimMedyaniGaplerden(gaps)
    }
    if (cevrimSn == null) cevrimSn = cevrimSaniye(t.mach, t.kod2)
    const esik = esikSaniye(cevrimSn)

    if (yasSn > esik) {
      if (!dryRun) {
        await prisma.iproMachineDowntime.create({
          data: { tezgahId: t.tezgahId, durusSebebiId: otoSebepId, baslangic: refTs, kaynak: KAYNAK_OTO, yorum: 'Otomatik: PLC sayacı durdu' },
        })
      }
      ozet.acilan++
      if (ozet.ornekler.length < 10) {
        ozet.ornekler.push({ kod: t.kod, yasSn: Math.round(yasSn), esik, cevrimSn: cevrimSn != null ? Math.round(cevrimSn) : null, ifsOrderNo: t.ifsOrderNo })
      }
    }
  }

  // ── İŞ KAPANDI: açık işi olmayan tezgahlardaki açık OTO/TAKVIM duruşlarını kapat (duruş iş penceresine bağlı). ──
  const acikOtoTakvim = await prisma.iproMachineDowntime.findMany({
    where: { kaynak: { in: [KAYNAK_OTO, KAYNAK_TAKVIM] }, bitis: null },
    select: { id: true, tezgahId: true, kaynak: true },
  })
  for (const md of acikOtoTakvim) {
    if (byTezgah.has(md.tezgahId)) continue // hâlâ açık iş var → yukarıda ele alındı
    if (!dryRun) await prisma.iproMachineDowntime.update({ where: { id: md.id }, data: { bitis: simdi } })
    if (md.kaynak === KAYNAK_TAKVIM) ozet.takvimKapatilan++
    else ozet.kapatilanIsKapandi++
  }

  return ozet
}

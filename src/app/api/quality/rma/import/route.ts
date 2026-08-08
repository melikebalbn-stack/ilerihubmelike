import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { canManageRma } from '@/lib/quality/rma-access'
import { generateNextRmaNo } from '@/lib/quality/rma-no'
import { RmaTip, RmaIadeTuru, RmaKarar } from '@/generated/prisma'
import {
  IMPORT_COLS,
  MAX_SATIR,
  MAX_FILE_SIZE,
  trNormalize,
  parseTip,
  parseIadeTuru,
  parseKarar,
  parseExcelDate,
  TIP_GECERLI_DEGERLER,
  IADE_TURU_GECERLI_DEGERLER,
  KARAR_GECERLI_DEGERLER,
} from '@/lib/quality/rma-excel'

export const dynamic = 'force-dynamic'

type Hata = { row: number; message: string }

// Kayıt (grup) düzeyi alanlar — bir GRUP içindeki tüm satırlarda AYNI olmalı.
interface KayitAlan {
  tip: RmaTip
  musteriKodu: string
  urunGelisTarihi: Date | null
  irsaliyeTarihi: Date | null
  irsaliyeNo: string | null
  iadeTuru: RmaIadeTuru | null
  sorumluSicilNo: string | null
  termin: Date | null
}
interface SatirAlan {
  excelRow: number
  urunKodu: string
  lotNo: string | null
  iadeMiktari: number
  musteriIadeSebebi: string
  ilkIncelemeSonucu: string | null
  karar: RmaKarar | null
  kararAciklama: string | null
  hurdaAdedi: number | null
  reworkAdedi: number | null
  kokNeden: string | null
  aksiyon: string | null
}
interface Grup {
  grup: string
  ilkRow: number
  kayit: KayitAlan
  satirlar: SatirAlan[]
}

/**
 * POST /api/quality/rma/import — Excel'den toplu YENİ kayıt (KAL-KYT-16, PR-3).
 * Auth: canManageRma. YALNIZ EKLER (güncelleme/silme/upsert YOK).
 * ?mod=onizleme → hiçbir şey yazmaz, özet + hata listesi döner.
 * ?mod=uygula → hata yoksa tek transaction; numaralar advisory lock içinde üretilir.
 * Hata varsa HİÇBİRİ yazılmaz (kısmi yükleme YASAK).
 */
export async function POST(request: NextRequest) {
  const { session, userId, error } = await requireSession()
  if (error) return error
  if (!canManageRma(session)) {
    return NextResponse.json({ error: 'İçe aktarma yetkiniz yok' }, { status: 403 })
  }

  const mod = request.nextUrl.searchParams.get('mod') === 'uygula' ? 'uygula' : 'onizleme'

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 })
  }
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return NextResponse.json({ error: 'Geçersiz dosya formatı — yalnızca .xlsx kabul edilir' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Dosya boyutu 2MB sınırını aşıyor' }, { status: 400 })
  }

  let rows: Record<string, unknown>[]
  try {
    const ab = await file.arrayBuffer()
    const wb = XLSX.read(ab, { type: 'array' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    if (!sheet) {
      return NextResponse.json({ error: 'Geçersiz dosya — sayfa bulunamadı' }, { status: 400 })
    }
    rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  } catch {
    return NextResponse.json({ error: 'Geçersiz dosya — Excel içeriği okunamadı' }, { status: 400 })
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Dosya boş — veri satırı yok' }, { status: 400 })
  }
  if (rows.length > MAX_SATIR) {
    return NextResponse.json(
      { error: `En fazla ${MAX_SATIR} satır aktarılabilir (bu dosyada ${rows.length} satır var)` },
      { status: 400 },
    )
  }

  // ── Başlık eşleme (sıra önemsiz, isimle; TR-normalize) ──
  const presentHeaders = Object.keys(rows[0])
  const colLookup: Partial<Record<keyof typeof IMPORT_COLS, string>> = {}
  for (const [field, label] of Object.entries(IMPORT_COLS) as [keyof typeof IMPORT_COLS, string][]) {
    const norm = trNormalize(label)
    const match = presentHeaders.find((h) => trNormalize(h) === norm)
    if (match) colLookup[field] = match
  }
  const zorunluBaslik: (keyof typeof IMPORT_COLS)[] = [
    'grup', 'tip', 'musteriKodu', 'urunKodu', 'iadeMiktari', 'musteriIadeSebebi',
  ]
  const eksikBaslik = zorunluBaslik.filter((f) => !colLookup[f]).map((f) => IMPORT_COLS[f])
  if (eksikBaslik.length > 0) {
    return NextResponse.json(
      { error: `Zorunlu kolon başlığı eksik: ${eksikBaslik.join(', ')}` },
      { status: 400 },
    )
  }

  const cell = (row: Record<string, unknown>, field: keyof typeof IMPORT_COLS): unknown => {
    const h = colLookup[field]
    return h ? row[h] : undefined
  }
  const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v).trim())
  const numOrNull = (v: unknown): number | null | 'NaN' => {
    if (v === undefined || v === null || String(v).trim() === '') return null
    const n = typeof v === 'number' ? v : Number(String(v).trim())
    return Number.isFinite(n) ? n : 'NaN'
  }

  const hatalar: Hata[] = []
  const gruplar = new Map<string, Grup>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const excelRow = i + 2 // başlık satırı + 1-indexed
    const rowHata = (message: string) => hatalar.push({ row: excelRow, message })

    const grup = str(cell(row, 'grup'))
    const tipRaw = str(cell(row, 'tip'))
    const musteriKodu = str(cell(row, 'musteriKodu'))
    const urunKodu = str(cell(row, 'urunKodu'))
    const musteriIadeSebebi = str(cell(row, 'musteriIadeSebebi'))
    const iadeMiktariN = numOrNull(cell(row, 'iadeMiktari'))

    let satirGecerli = true

    if (!grup) { rowHata('GRUP zorunlu'); satirGecerli = false }
    if (!musteriKodu) { rowHata('MÜŞTERİ KODU zorunlu'); satirGecerli = false }
    if (!urunKodu) { rowHata('ÜRÜN KODU zorunlu'); satirGecerli = false }
    if (!musteriIadeSebebi) { rowHata('MÜŞTERİ İADE SEBEBİ zorunlu'); satirGecerli = false }

    let tip: RmaTip | undefined
    if (!tipRaw) { rowHata('TİP zorunlu'); satirGecerli = false }
    else {
      tip = parseTip(tipRaw)
      if (!tip) { rowHata(`Tanınmayan TİP: "${tipRaw}" (geçerli: ${TIP_GECERLI_DEGERLER})`); satirGecerli = false }
    }

    let iadeMiktari = 0
    if (iadeMiktariN === null) { rowHata('İADE MİKTARI zorunlu'); satirGecerli = false }
    else if (iadeMiktariN === 'NaN') { rowHata('İADE MİKTARI sayı olmalı'); satirGecerli = false }
    else if (!Number.isInteger(iadeMiktariN) || iadeMiktariN < 1) { rowHata('İADE MİKTARI en az 1 (tam sayı) olmalı'); satirGecerli = false }
    else iadeMiktari = iadeMiktariN

    // iade türü (opsiyonel)
    let iadeTuru: RmaIadeTuru | null = null
    const iadeTuruRaw = str(cell(row, 'iadeTuru'))
    if (iadeTuruRaw) {
      const p = parseIadeTuru(iadeTuruRaw)
      if (!p) { rowHata(`Tanınmayan İADE TÜRÜ: "${iadeTuruRaw}" (geçerli: ${IADE_TURU_GECERLI_DEGERLER})`); satirGecerli = false }
      else iadeTuru = p
    }
    // karar (opsiyonel)
    let karar: RmaKarar | null = null
    const kararRaw = str(cell(row, 'karar'))
    if (kararRaw) {
      const p = parseKarar(kararRaw)
      if (!p) { rowHata(`Tanınmayan KARAR: "${kararRaw}" (geçerli: ${KARAR_GECERLI_DEGERLER})`); satirGecerli = false }
      else karar = p
    }

    // hurda / rework (opsiyonel, >=0)
    const hurdaN = numOrNull(cell(row, 'hurdaAdedi'))
    const reworkN = numOrNull(cell(row, 'reworkAdedi'))
    let hurdaAdedi: number | null = null
    let reworkAdedi: number | null = null
    if (hurdaN === 'NaN' || (typeof hurdaN === 'number' && (!Number.isInteger(hurdaN) || hurdaN < 0))) { rowHata('HURDA ADEDİ 0 veya üzeri tam sayı olmalı'); satirGecerli = false }
    else hurdaAdedi = hurdaN as number | null
    if (reworkN === 'NaN' || (typeof reworkN === 'number' && (!Number.isInteger(reworkN) || reworkN < 0))) { rowHata('REWORK ADEDİ 0 veya üzeri tam sayı olmalı'); satirGecerli = false }
    else reworkAdedi = reworkN as number | null
    if (satirGecerli && (hurdaAdedi ?? 0) + (reworkAdedi ?? 0) > iadeMiktari) {
      rowHata(`Hurda (${hurdaAdedi ?? 0}) + rework (${reworkAdedi ?? 0}) iade miktarını (${iadeMiktari}) aşamaz`)
      satirGecerli = false
    }

    // tarihler
    const ssf = (n: number) => XLSX.SSF.parse_date_code(n)
    const dateCell = (field: keyof typeof IMPORT_COLS, etiket: string): Date | null => {
      const raw = cell(row, field)
      if (str(raw) === '') return null
      const d = parseExcelDate(raw as string | number | Date, ssf)
      if (!d) { rowHata(`Geçersiz tarih (${etiket}): "${str(raw)}"`); satirGecerli = false }
      return d
    }
    const urunGelisTarihi = dateCell('urunGelisTarihi', 'ÜRÜN GELİŞ TARİHİ')
    const irsaliyeTarihi = dateCell('irsaliyeTarihi', 'İRSALİYE TARİHİ')
    const termin = dateCell('termin', 'TERMİN')

    const sorumluSicilNo = str(cell(row, 'sorumluSicilNo')) || null
    const irsaliyeNo = str(cell(row, 'irsaliyeNo')) || null

    if (!satirGecerli || !tip) continue // hatalı satır — gruba eklenmez (yine de tüm hatalar toplanır)

    const kayit: KayitAlan = {
      tip, musteriKodu, urunGelisTarihi, irsaliyeTarihi, irsaliyeNo, iadeTuru, sorumluSicilNo, termin,
    }
    const satir: SatirAlan = {
      excelRow,
      urunKodu: urunKodu.toUpperCase(),
      lotNo: str(cell(row, 'lotNo')) || null,
      iadeMiktari,
      musteriIadeSebebi,
      ilkIncelemeSonucu: str(cell(row, 'ilkIncelemeSonucu')) || null,
      karar,
      kararAciklama: str(cell(row, 'kararAciklama')) || null,
      hurdaAdedi,
      reworkAdedi,
      kokNeden: str(cell(row, 'kokNeden')) || null,
      aksiyon: str(cell(row, 'aksiyon')) || null,
    }

    const mevcut = gruplar.get(grup)
    if (!mevcut) {
      gruplar.set(grup, { grup, ilkRow: excelRow, kayit, satirlar: [satir] })
    } else {
      // GRUP tutarlılığı — kayıt düzeyi alanlar ilk satırla aynı olmalı.
      const c = mevcut.kayit
      const t = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null)
      const celiski: string[] = []
      if (c.tip !== kayit.tip) celiski.push('TİP')
      if (c.musteriKodu !== kayit.musteriKodu) celiski.push('MÜŞTERİ KODU')
      if (!t(c.urunGelisTarihi, kayit.urunGelisTarihi)) celiski.push('ÜRÜN GELİŞ TARİHİ')
      if (!t(c.irsaliyeTarihi, kayit.irsaliyeTarihi)) celiski.push('İRSALİYE TARİHİ')
      if ((c.irsaliyeNo ?? '') !== (kayit.irsaliyeNo ?? '')) celiski.push('İRSALİYE NO')
      if ((c.iadeTuru ?? '') !== (kayit.iadeTuru ?? '')) celiski.push('İADE TÜRÜ')
      if ((c.sorumluSicilNo ?? '') !== (kayit.sorumluSicilNo ?? '')) celiski.push('SORUMLU SİCİL NO')
      if (!t(c.termin, kayit.termin)) celiski.push('TERMİN')
      if (celiski.length > 0) {
        rowHata(`GRUP "${grup}" içinde çelişen alan(lar): ${celiski.join(', ')} (grup ilk satır: ${mevcut.ilkRow})`)
      }
      mevcut.satirlar.push(satir)
    }
  }

  // ── FK doğrulama (toplu sorgu): müşteri kodu + sorumlu sicil ──
  const musteriKodlar = [...new Set([...gruplar.values()].map((g) => g.kayit.musteriKodu))]
  const musteriMap = new Map<string, { id: string; isActive: boolean; name: string }>()
  if (musteriKodlar.length > 0) {
    const found = await prisma.costCustomer.findMany({
      where: { code: { in: musteriKodlar } },
      select: { id: true, code: true, isActive: true, name: true },
    })
    for (const m of found) musteriMap.set(m.code, { id: m.id, isActive: m.isActive, name: m.name })
  }

  const sicilNolar = [...new Set([...gruplar.values()].map((g) => g.kayit.sorumluSicilNo).filter((s): s is string => !!s))]
  const sicilMap = new Map<string, string>() // sicilNo -> personnelId
  if (sicilNolar.length > 0) {
    const found = await prisma.personnel.findMany({
      where: { sicilNo: { in: sicilNolar } },
      select: { id: true, sicilNo: true },
    })
    for (const p of found) if (p.sicilNo) sicilMap.set(p.sicilNo, p.id)
  }

  for (const g of gruplar.values()) {
    const m = musteriMap.get(g.kayit.musteriKodu)
    if (!m) hatalar.push({ row: g.ilkRow, message: `Müşteri kodu bulunamadı: "${g.kayit.musteriKodu}"` })
    else if (!m.isActive) hatalar.push({ row: g.ilkRow, message: `Müşteri pasif: "${g.kayit.musteriKodu}"` })
    if (g.kayit.sorumluSicilNo && !sicilMap.has(g.kayit.sorumluSicilNo)) {
      hatalar.push({ row: g.ilkRow, message: `Sorumlu sicil no personelde bulunamadı: "${g.kayit.sorumluSicilNo}"` })
    }
  }

  // ── Özet ──
  const gecerliGruplar = [...gruplar.values()]
  const satirSayisi = gecerliGruplar.reduce((s, g) => s + g.satirlar.length, 0)
  const musteriOzetMap = new Map<string, { musteriKodu: string; musteriAd: string; kayit: number; satir: number }>()
  for (const g of gecerliGruplar) {
    const ad = musteriMap.get(g.kayit.musteriKodu)?.name ?? '(bilinmiyor)'
    const cur = musteriOzetMap.get(g.kayit.musteriKodu) ?? { musteriKodu: g.kayit.musteriKodu, musteriAd: ad, kayit: 0, satir: 0 }
    cur.kayit += 1
    cur.satir += g.satirlar.length
    musteriOzetMap.set(g.kayit.musteriKodu, cur)
  }
  hatalar.sort((a, b) => a.row - b.row)

  const ozet = {
    mod,
    kayitSayisi: gecerliGruplar.length,
    satirSayisi,
    musteriOzet: [...musteriOzetMap.values()].sort((a, b) => b.kayit - a.kayit),
    hatalar,
  }

  // ── ÖNİZLEME: hiçbir şey yazma ──
  if (mod === 'onizleme') {
    return NextResponse.json(ozet)
  }

  // ── UYGULA: hata varsa hiçbiri yazılmaz ──
  if (hatalar.length > 0) {
    return NextResponse.json({ ...ozet, error: 'Hatalar giderilmeden aktarım yapılamaz' }, { status: 400 })
  }
  if (gecerliGruplar.length === 0) {
    return NextResponse.json({ ...ozet, error: 'Aktarılacak geçerli kayıt yok' }, { status: 400 })
  }

  const atananNolar: number[] = []
  await prisma.$transaction(
    async (tx) => {
      for (const g of gecerliGruplar) {
        const no = await generateNextRmaNo(tx)
        atananNolar.push(no)
        const m = musteriMap.get(g.kayit.musteriKodu)! // FK doğrulandı
        const sorumluId = g.kayit.sorumluSicilNo ? sicilMap.get(g.kayit.sorumluSicilNo)! : null
        await tx.rmaKayit.create({
          data: {
            tip: g.kayit.tip,
            no,
            urunGelisTarihi: g.kayit.urunGelisTarihi,
            irsaliyeTarihi: g.kayit.irsaliyeTarihi,
            irsaliyeNo: g.kayit.irsaliyeNo,
            musteriId: m.id,
            iadeTuru: g.kayit.iadeTuru,
            sorumluId,
            termin: g.kayit.termin,
            olusturanId: userId,
            guncelleyenId: userId,
            satirlar: {
              create: g.satirlar.map((s, idx) => ({
                siraNo: idx + 1,
                urunKodu: s.urunKodu,
                lotNo: s.lotNo,
                iadeMiktari: s.iadeMiktari,
                musteriIadeSebebi: s.musteriIadeSebebi,
                ilkIncelemeSonucu: s.ilkIncelemeSonucu,
                karar: s.karar,
                kararAciklama: s.kararAciklama,
                hurdaAdedi: s.hurdaAdedi,
                reworkAdedi: s.reworkAdedi,
                kokNeden: s.kokNeden,
                aksiyon: s.aksiyon,
              })),
            },
          },
        })
      }
    },
    { timeout: 30000, maxWait: 10000 },
  )

  return NextResponse.json({
    ...ozet,
    olusturulan: gecerliGruplar.length,
    noAralik: atananNolar.length > 0 ? { min: Math.min(...atananNolar), max: Math.max(...atananNolar) } : null,
  })
}

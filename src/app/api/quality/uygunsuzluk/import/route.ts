import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { canManageUygunsuzluk } from '@/lib/quality/uygunsuzluk-access'
import { generateNextUygunsuzlukNo } from '@/lib/quality/uygunsuzluk-no'
import { UygunsuzlukKarar } from '@/generated/prisma'
import {
  IMPORT_COLS,
  MAX_SATIR,
  MAX_FILE_SIZE,
  KARAR_GECERLI_DEGERLER,
  BOLUM_AD_ISTISNA,
  trNormalize,
  parseKarar,
  parseExcelDate,
  grupAnahtari,
  sayfaSec,
} from '@/lib/quality/uygunsuzluk-excel'

export const dynamic = 'force-dynamic'

type Hata = { row: number; message: string }
type Uyari = { row: number; message: string }

type SatirTaslak = {
  siraNo: number
  row: number
  yariMamulKodu: string | null
  malzemeAdi: string | null
  redAdeti: number
  reworkAdedi: number | null
  /** Ham hücre: sayı ise kod, metin ise bölüm adı. */
  olusanBolumRaw: string | null
  hataKodu: number | null
  hataDetayi: string | null
  karar: UygunsuzlukKarar | null
}

type Grup = {
  ilkRow: number
  anahtar: string
  kayit: {
    tarih: Date
    mamulUrunKodu: string
    isEmriNo: string
    isEmriAdeti: number | null
    tespitEdenBolumRaw: string | null
    kokNeden: string | null
    duzelticiFaaliyet: string | null
    sorumluRaw: string | null
    termin: Date | null
    kapanisTarihi: Date | null
  }
  satirlar: SatirTaslak[]
}

/**
 * POST /api/quality/uygunsuzluk/import?mod=onizleme|uygula&sayfa=<ad>
 *
 * Auth: canManageUygunsuzluk. YALNIZ EKLER (güncelleme/silme/upsert YOK).
 * ?mod=onizleme → hiçbir şey yazmaz, özet + hata listesi döner.
 * ?mod=uygula   → hata yoksa tek transaction; numaralar advisory lock içinde üretilir.
 *
 * MODÜLE ÖZEL:
 *  • Satır limiti 1000 / 5MB (RMA 500 / 2MB) — 873 satırlık geçmiş göç tek dosyada geçsin.
 *  • SAYFA: ?sayfa= verilmezse adı salt rakam olan sekme (ör. "2026"), o da yoksa ilki.
 *    Gerçek dosyada veri 3. sekmede olduğu için bu şart.
 *  • GRUP kolonu YOK: aynı (tarih günü + isEmriNo + mamulUrunKodu) üçlüsü DOSYANIN
 *    NERESİNDE OLURSA OLSUN tek başlığa toplanır (GLOBAL).
 *  • Başlık alanları grup içinde çelişirse İLK satırdaki kazanır; çelişki UYARI (hata değil).
 *  • Bölüm sütunları KOD ya da AD kabul eder; hata kodu sütunu yalnız KOD.
 *  • Sorumlu sütunu sicil no ya da ad kabul eder.
 *  • ?bolumKoduToleransi=1 → HATA KODU'na bölüm kodu yazılmışsa satır reddedilmez,
 *    alan boş bırakılır ve uyarı üretilir (varsayılan: kapalı, 400 hata).
 */
export async function POST(request: NextRequest) {
  const { session, userId, error } = await requireSession()
  if (error) return error
  if (!canManageUygunsuzluk(session)) {
    return NextResponse.json({ error: 'İçe aktarım yetkiniz yok' }, { status: 403 })
  }

  const sp = request.nextUrl.searchParams
  const mod = sp.get('mod') === 'uygula' ? 'uygula' : 'onizleme'
  const istenenSayfa = sp.get('sayfa')
  /**
   * Bölüm kodu toleransı — VARSAYILAN KAPALI.
   * Açıkken HATA KODU sütununda bölüm kodu gelirse satır REDDEDİLMEZ:
   * hataKoduId null kalır ve UYARI üretilir. Gerçek KAL-KYT-15 '2026'
   * sayfasında 595 satırda bu sütun bölüm koduyla doldurulmuş; göçün
   * geri kalanı bu yüzden bloke olmasın diye bilinçli bir kaçış kapısı.
   */
  const bolumKoduToleransi = sp.get('bolumKoduToleransi') === '1'

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 })
  }
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return NextResponse.json(
      { error: 'Geçersiz dosya formatı — yalnızca .xlsx kabul edilir' },
      { status: 400 },
    )
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `Dosya çok büyük (en fazla ${MAX_FILE_SIZE / 1024 / 1024}MB)` },
      { status: 400 },
    )
  }

  let rows: Record<string, unknown>[]
  let secilenSayfa: string
  try {
    const ab = await file.arrayBuffer()
    const wb = XLSX.read(ab, { type: 'array' })
    const ad = sayfaSec(wb.SheetNames, istenenSayfa)
    if (!ad) {
      return NextResponse.json(
        {
          error: istenenSayfa
            ? `"${istenenSayfa}" adlı sayfa yok. Mevcut sayfalar: ${wb.SheetNames.join(', ')}`
            : 'Dosyada sayfa yok',
        },
        { status: 400 },
      )
    }
    secilenSayfa = ad
    const sheet = wb.Sheets[ad]
    if (!sheet) return NextResponse.json({ error: 'Sayfa okunamadı' }, { status: 400 })
    rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  } catch {
    return NextResponse.json({ error: 'Excel dosyası okunamadı' }, { status: 400 })
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: `"${secilenSayfa}" sayfasında veri satırı yok` },
      { status: 400 },
    )
  }
  // ── Başlık eşleme (sıra önemsiz, isimle; TR-normalize + iç boşluk sadeleştirme) ──
  const presentHeaders = Object.keys(rows[0])
  const colLookup: Partial<Record<keyof typeof IMPORT_COLS, string>> = {}
  for (const [field, label] of Object.entries(IMPORT_COLS) as [keyof typeof IMPORT_COLS, string][]) {
    const norm = trNormalize(label)
    const match = presentHeaders.find((h) => trNormalize(h) === norm)
    if (match) colLookup[field] = match
  }
  const zorunluBaslik: (keyof typeof IMPORT_COLS)[] = [
    'tarih', 'mamulUrunKodu', 'isEmriNo', 'redAdeti',
  ]
  const eksikBaslik = zorunluBaslik.filter((f) => !colLookup[f]).map((f) => IMPORT_COLS[f])
  if (eksikBaslik.length > 0) {
    return NextResponse.json(
      {
        error: `"${secilenSayfa}" sayfasında zorunlu kolon başlığı eksik: ${eksikBaslik.join(', ')}`,
        secilenSayfa,
      },
      { status: 400 },
    )
  }

  const cell = (row: Record<string, unknown>, field: keyof typeof IMPORT_COLS): unknown => {
    const h = colLookup[field]
    return h ? row[h] : undefined
  }
  const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v).trim())
  const intOrNull = (v: unknown): number | null | 'NaN' => {
    if (v === undefined || v === null || String(v).trim() === '') return null
    const n = typeof v === 'number' ? v : Number(String(v).trim())
    return Number.isFinite(n) && Number.isInteger(n) ? n : 'NaN'
  }
  const ssf = (n: number) => XLSX.SSF.parse_date_code(n)

  /**
   * VERİ SATIRI filtresi — limit kontrolünden ÖNCE.
   *
   * Gerçek dosyada `sheet_to_json` 1624 satır döndürüyor ama yalnız 873'ü veri:
   * kalan 751 satır TAMAMEN BOŞ DEĞİL, her birinde `HATA DETAYI` sütununda
   * sürüklenmiş bir " HATASI" artığı var. "Bütün hücreler boş" filtresi bunları
   * yakalamaz; kimlik sütunlarına (tarih / mamul kodu / iş emri no) bakmak gerekiyor.
   *
   * ÜÇÜ DE boşsa satır veri değildir → atlanır ve limite sayılmaz.
   * En az biri doluysa satır KORUNUR — eksik olanlar için hata üretilsin diye
   * (yarım doldurulmuş satır sessizce kaybolmasın).
   */
  const veriSatirlari = rows
    .map((row, i) => ({ row, excelRow: i + 2 })) // başlık satırı + 1-indexed
    .filter(
      ({ row }) =>
        str(cell(row, 'tarih')) !== '' ||
        str(cell(row, 'mamulUrunKodu')) !== '' ||
        str(cell(row, 'isEmriNo')) !== '',
    )

  if (veriSatirlari.length === 0) {
    return NextResponse.json(
      { error: `"${secilenSayfa}" sayfasında veri satırı bulunamadı`, secilenSayfa },
      { status: 400 },
    )
  }
  if (veriSatirlari.length > MAX_SATIR) {
    return NextResponse.json(
      {
        error: `En fazla ${MAX_SATIR} satır aktarılabilir (bu sayfada ${veriSatirlari.length} veri satırı var)`,
        secilenSayfa,
      },
      { status: 400 },
    )
  }

  const hatalar: Hata[] = []
  const uyarilar: Uyari[] = []
  // GLOBAL gruplama: anahtar → grup. Map ekleme sırası = başlığın ilk görüldüğü satır.
  const grupMap = new Map<string, Grup>()

  for (const { row, excelRow } of veriSatirlari) {
    const rowHata = (message: string) => hatalar.push({ row: excelRow, message })

    const tarih = parseExcelDate(cell(row, 'tarih') as string | number | Date, ssf)
    const mamulUrunKodu = str(cell(row, 'mamulUrunKodu'))
    const isEmriNo = str(cell(row, 'isEmriNo'))
    const redAdetiRaw = intOrNull(cell(row, 'redAdeti'))

    let satirGecerli = true
    if (!tarih) {
      rowHata('TARİH okunamadı ya da boş')
      satirGecerli = false
    }
    if (!mamulUrunKodu) {
      rowHata('MAMUL ÜRÜN KODU zorunlu')
      satirGecerli = false
    }
    if (!isEmriNo) {
      rowHata('İŞ EMRİ NO zorunlu')
      satirGecerli = false
    }
    if (redAdetiRaw === 'NaN') {
      rowHata('RED ADETİ sayı olmalı')
      satirGecerli = false
    } else if (redAdetiRaw === null || redAdetiRaw < 1) {
      rowHata('RED ADETİ en az 1 olmalı')
      satirGecerli = false
    }

    const reworkRaw = intOrNull(cell(row, 'reworkAdedi'))
    if (reworkRaw === 'NaN') {
      rowHata('REWORK ADEDİ sayı olmalı')
      satirGecerli = false
    } else if (
      reworkRaw !== null &&
      redAdetiRaw !== null &&
      redAdetiRaw !== 'NaN' &&
      reworkRaw > redAdetiRaw
    ) {
      rowHata(`REWORK ADEDİ (${reworkRaw}), RED ADETİ (${redAdetiRaw}) değerini aşamaz`)
      satirGecerli = false
    }

    const isEmriAdetiRaw = intOrNull(cell(row, 'isEmriAdeti'))
    if (isEmriAdetiRaw === 'NaN') {
      rowHata('İŞ EMRİ ADETİ sayı olmalı')
      satirGecerli = false
    }

    const kararStr = str(cell(row, 'karar'))
    let karar: UygunsuzlukKarar | null = null
    if (kararStr) {
      const k = parseKarar(kararStr)
      if (!k) {
        rowHata(`KARAR geçersiz: "${kararStr}" (geçerli: ${KARAR_GECERLI_DEGERLER})`)
        satirGecerli = false
      } else karar = k
    }

    // Hata kodu YALNIZ sayısal kod.
    const hataKoduRaw = intOrNull(cell(row, 'hataKodu'))
    if (hataKoduRaw === 'NaN') {
      rowHata(`${IMPORT_COLS.hataKodu}: sayısal bir KOD olmalı (ad değil)`)
      satirGecerli = false
    }

    const termin = parseExcelDate(cell(row, 'termin') as string | number | Date, ssf)
    const kapanisTarihi = parseExcelDate(cell(row, 'kapanisTarihi') as string | number | Date, ssf)
    if (kapanisTarihi && tarih && kapanisTarihi.getTime() < tarih.getTime()) {
      rowHata('KAPANIŞ TARİHİ, TARİH değerinden önce olamaz')
      satirGecerli = false
    }

    if (!satirGecerli || !tarih) continue

    const anahtar = grupAnahtari(tarih, isEmriNo, mamulUrunKodu)
    const satir: SatirTaslak = {
      siraNo: 0,
      row: excelRow,
      yariMamulKodu: str(cell(row, 'yariMamulKodu')) || null,
      malzemeAdi: str(cell(row, 'malzemeAdi')) || null,
      redAdeti: redAdetiRaw as number,
      reworkAdedi: reworkRaw === 'NaN' ? null : reworkRaw,
      olusanBolumRaw: str(cell(row, 'olusanBolum')) || null,
      hataKodu: hataKoduRaw === 'NaN' ? null : hataKoduRaw,
      hataDetayi: str(cell(row, 'hataDetayi')) || null,
      karar,
    }

    const mevcut = grupMap.get(anahtar)
    if (mevcut) {
      satir.siraNo = mevcut.satirlar.length + 1
      mevcut.satirlar.push(satir)

      // Başlık alanı çatışması: İLK satırdaki kazanır, fark UYARI.
      const cakisma = (alan: string, ilk: unknown, simdi: unknown) => {
        const a = ilk instanceof Date ? ilk.getTime() : (ilk ?? null)
        const b = simdi instanceof Date ? simdi.getTime() : (simdi ?? null)
        if (a !== b) {
          uyarilar.push({
            row: excelRow,
            message: `${alan}: bu satırdaki değer yok sayıldı, ${mevcut.ilkRow}. satırdaki kullanıldı`,
          })
        }
      }
      cakisma(IMPORT_COLS.kokNeden, mevcut.kayit.kokNeden, str(cell(row, 'kokNeden')) || null)
      cakisma(IMPORT_COLS.duzelticiFaaliyet, mevcut.kayit.duzelticiFaaliyet, str(cell(row, 'duzelticiFaaliyet')) || null)
      cakisma(IMPORT_COLS.sorumlu, mevcut.kayit.sorumluRaw, str(cell(row, 'sorumlu')) || null)
      cakisma(IMPORT_COLS.termin, mevcut.kayit.termin, termin)
      cakisma(IMPORT_COLS.kapanisTarihi, mevcut.kayit.kapanisTarihi, kapanisTarihi)
      cakisma(IMPORT_COLS.isEmriAdeti, mevcut.kayit.isEmriAdeti, isEmriAdetiRaw === 'NaN' ? null : isEmriAdetiRaw)
      cakisma(IMPORT_COLS.tespitEdenBolum, mevcut.kayit.tespitEdenBolumRaw, str(cell(row, 'tespitEdenBolum')) || null)
    } else {
      satir.siraNo = 1
      grupMap.set(anahtar, {
        ilkRow: excelRow,
        anahtar,
        kayit: {
          tarih,
          mamulUrunKodu,
          isEmriNo,
          isEmriAdeti: isEmriAdetiRaw === 'NaN' ? null : isEmriAdetiRaw,
          tespitEdenBolumRaw: str(cell(row, 'tespitEdenBolum')) || null,
          kokNeden: str(cell(row, 'kokNeden')) || null,
          duzelticiFaaliyet: str(cell(row, 'duzelticiFaaliyet')) || null,
          sorumluRaw: str(cell(row, 'sorumlu')) || null,
          termin,
          kapanisTarihi,
        },
        satirlar: [satir],
      })
    }
  }

  const gruplar = [...grupMap.values()]

  // ── Referans çözümü ──
  // Bölümler: KOD (sayısal) ya da AD. Hata kodu: yalnız KOD.
  const bolumler = await prisma.hataKodu.findMany({
    where: { tip: 'BOLUM' },
    select: { id: true, kod: true, ad: true },
  })
  const bolumByKod = new Map(bolumler.map((b) => [b.kod, b]))
  const bolumByAd = new Map(bolumler.map((b) => [trNormalize(b.ad), b]))
  const ornekBolumAdlari = bolumler
    .slice(0, 4)
    .map((b) => b.ad)
    .join(', ')

  /** Bölüm hücresi → HataKodu.id. Sayı ise kod, metin ise ad (istisna tablosu dahil). */
  const bolumCoz = (raw: string | null, label: string, row: number): string | null => {
    if (!raw) return null
    const n = Number(raw)
    if (Number.isFinite(n) && Number.isInteger(n)) {
      const b = bolumByKod.get(n)
      if (b) return b.id
      hatalar.push({ row, message: `${label}: ${n} kodu bir bölüm değil ya da bulunamadı` })
      return null
    }
    const norm = trNormalize(raw)
    const dogrudan = bolumByAd.get(norm)
    if (dogrudan) return dogrudan.id
    const istisnaKod = BOLUM_AD_ISTISNA[norm]
    if (istisnaKod !== undefined) {
      const b = bolumByKod.get(istisnaKod)
      if (b) return b.id
    }
    hatalar.push({
      row,
      message: `${label}: "${raw}" bölümü çözülemedi (örnek geçerli adlar: ${ornekBolumAdlari}…)`,
    })
    return null
  }

  // Hata kodları — tek sorgu, tip doğrulaması
  const hataKodlari = [
    ...new Set(gruplar.flatMap((g) => g.satirlar.map((s) => s.hataKodu).filter((k): k is number => k !== null))),
  ]
  const kodMap = new Map<number, { id: string; tip: 'BOLUM' | 'KOD'; ad: string }>()
  if (hataKodlari.length > 0) {
    const found = await prisma.hataKodu.findMany({
      where: { kod: { in: hataKodlari } },
      select: { id: true, kod: true, tip: true, ad: true },
    })
    for (const k of found) kodMap.set(k.kod, { id: k.id, tip: k.tip, ad: k.ad })
  }

  // Sorumlu: sicil no VEYA ad
  const sorumluRawlar = [
    ...new Set(gruplar.map((g) => g.kayit.sorumluRaw).filter((s): s is string => !!s)),
  ]
  const personelByS = new Map<string, string>() // sicilNo -> id
  const personelByAd = new Map<string, string>() // normalize(adSoyad) -> id
  if (sorumluRawlar.length > 0) {
    const found = await prisma.personnel.findMany({
      where: {
        OR: [
          { sicilNo: { in: sorumluRawlar } },
          { adSoyad: { in: sorumluRawlar, mode: 'insensitive' } },
        ],
      },
      select: { id: true, sicilNo: true, adSoyad: true },
    })
    for (const p of found) {
      if (p.sicilNo) personelByS.set(p.sicilNo, p.id)
      personelByAd.set(trNormalize(p.adSoyad), p.id)
    }
  }

  const cozulmus = gruplar.map((g) => {
    const tespitEdenBolumId = bolumCoz(
      g.kayit.tespitEdenBolumRaw, IMPORT_COLS.tespitEdenBolum, g.ilkRow,
    )

    let sorumluId: string | null = null
    if (g.kayit.sorumluRaw) {
      sorumluId =
        personelByS.get(g.kayit.sorumluRaw) ??
        personelByAd.get(trNormalize(g.kayit.sorumluRaw)) ??
        null
      if (!sorumluId) {
        hatalar.push({
          row: g.ilkRow,
          message: `${IMPORT_COLS.sorumlu}: "${g.kayit.sorumluRaw}" personelde bulunamadı (sicil no ya da ad yazın)`,
        })
      }
    }

    const satirlar = g.satirlar.map((s) => {
      let hataKoduId: string | null = null
      if (s.hataKodu !== null) {
        const k = kodMap.get(s.hataKodu)
        if (!k) {
          hatalar.push({ row: s.row, message: `${IMPORT_COLS.hataKodu}: ${s.hataKodu} kodu bulunamadı` })
        } else if (k.tip !== 'KOD') {
          // Bölüm kodu yazılmış. Tolerans açıksa satır kurtarılır, alan boş kalır.
          if (bolumKoduToleransi) {
            uyarilar.push({
              row: s.row,
              message: `${IMPORT_COLS.hataKodu}: ${s.hataKodu} ${k.ad} bir bölüm, hata kodu boş bırakıldı`,
            })
          } else {
            hatalar.push({
              row: s.row,
              message: `${IMPORT_COLS.hataKodu}: ${s.hataKodu} bir bölüm, hata kodu olmalı`,
            })
          }
        } else hataKoduId = k.id
      }
      return {
        ...s,
        olusanBolumId: bolumCoz(s.olusanBolumRaw, IMPORT_COLS.olusanBolum, s.row),
        hataKoduId,
      }
    })
    return { g, tespitEdenBolumId, sorumluId, satirlar }
  })

  hatalar.sort((a, b) => a.row - b.row)
  uyarilar.sort((a, b) => a.row - b.row)

  const satirSayisi = gruplar.reduce((s, g) => s + g.satirlar.length, 0)
  const ozet = {
    mod,
    secilenSayfa,
    // ── Sayım görünürlüğü: her aşama ayrı ayrı ──
    hamSatir: rows.length, // sheet_to_json'ın döndürdüğü ham satır (artıklar dahil)
    okunanSatir: veriSatirlari.length, // kimlik sütunlarından en az biri dolu olanlar
    gecerliSatir: satirSayisi, // gruba giren, yani aktarılacak satırlar
    hataliSatir: veriSatirlari.length - satirSayisi, // doğrulamada düşenler
    kayitSayisi: gruplar.length, // oluşacak başlık (yalnız geçerlilerden)
    satirSayisi, // = gecerliSatir, geriye dönük ad
    gruplar: gruplar.map((g) => ({
      ilkRow: g.ilkRow,
      isEmriNo: g.kayit.isEmriNo,
      mamulUrunKodu: g.kayit.mamulUrunKodu,
      satirSayisi: g.satirlar.length,
    })),
    hatalar,
    uyarilar,
  }

  if (mod === 'onizleme') {
    return NextResponse.json(ozet)
  }

  if (hatalar.length > 0) {
    return NextResponse.json(
      { ...ozet, error: 'Hatalar giderilmeden aktarım yapılamaz' },
      { status: 400 },
    )
  }
  if (gruplar.length === 0) {
    return NextResponse.json({ ...ozet, error: 'Aktarılacak geçerli kayıt yok' }, { status: 400 })
  }

  const atananNolar: number[] = []
  await prisma.$transaction(
    async (tx) => {
      for (const c of cozulmus) {
        const no = await generateNextUygunsuzlukNo(tx)
        atananNolar.push(no)
        await tx.kaliteUygunsuzluk.create({
          data: {
            no,
            tarih: c.g.kayit.tarih,
            mamulUrunKodu: c.g.kayit.mamulUrunKodu,
            isEmriNo: c.g.kayit.isEmriNo,
            isEmriAdeti: c.g.kayit.isEmriAdeti,
            tespitEdenBolumId: c.tespitEdenBolumId,
            kokNeden: c.g.kayit.kokNeden,
            duzelticiFaaliyet: c.g.kayit.duzelticiFaaliyet,
            sorumluId: c.sorumluId,
            termin: c.g.kayit.termin,
            kapanisTarihi: c.g.kayit.kapanisTarihi,
            olusturanId: userId,
            guncelleyenId: userId,
            satirlar: {
              create: c.satirlar.map((s) => ({
                siraNo: s.siraNo,
                yariMamulKodu: s.yariMamulKodu,
                malzemeAdi: s.malzemeAdi,
                redAdeti: s.redAdeti,
                reworkAdedi: s.reworkAdedi,
                olusanBolumId: s.olusanBolumId,
                hataKoduId: s.hataKoduId,
                hataDetayi: s.hataDetayi,
                karar: s.karar,
              })),
            },
          },
        })
      }
    },
    { timeout: 120_000 },
  )

  return NextResponse.json({ ...ozet, atananNolar })
}

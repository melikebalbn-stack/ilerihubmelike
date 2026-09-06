import { NextRequest, NextResponse } from 'next/server'
import { personelFkAlanlari } from '@/lib/personnel/fk-cozum'
import { prisma } from '@/lib/prisma'
import { personelEklendiginde } from '@/lib/org/personel-koltuk-senkron'
import * as XLSX from 'xlsx'
import { EXCEL_COLUMN_MAP, YAKA_DETAY_MAP } from '@/lib/personnel-constants'
import { requireUser } from '@/lib/auth/require-user'
import { logAuditEvent } from '@/lib/audit-log'
import { isInsanVarliklari } from '@/lib/auth/personnel-access'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']

function isHRDepartment(dept: string | undefined | null): boolean {
  return isInsanVarliklari(dept)
}

// Hassas alan isimleri - PersonnelSensitive tablosuna gidecekler
const SENSITIVE_FIELDS = ['tcKimlikNo', 'sgkNo', 'dogumTarihi', 'bankaSube', 'bankaHesapNo', 'ibanNo']

function normalizeGender(value: string | null | undefined): string | null {
  if (!value) return null
  const v = value.toString().toUpperCase().trim()
  if (v === 'ERKEK' || v === 'BAY' || v === 'E' || v === 'MALE') return 'MALE'
  if (v === 'KADIN' || v === 'BAYAN' || v === 'K' || v === 'FEMALE') return 'FEMALE'
  return null
}

function normalizeYaka(value: string | null | undefined): string | null {
  if (!value) return null
  const v = value.toString().toUpperCase().trim()
    .replace(/İ/g, 'I')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
  if (v === 'GRI' || v.includes('GRI')) return 'GRI'
  if (v === 'MAVI' || v.includes('MAVI')) return 'MAVI'
  if (v === 'BEYAZ' || v.includes('BEYAZ')) return 'BEYAZ'
  return null
}

// Yaka Aşama 1: "YAKA DETAYI" sütunundaki Türkçe metni YakaDetayi enum'una çevir.
// Sütun yoksa/eşleşmezse yakaRengi'nin taban değerine düşer (MAVI/BEYAZ/GRI). Sonuç her
// zaman YAKA_DETAY_MAP[yakaRengi] içinde tutulur (tutarlılık garantisi).
function normalizeYakaDetayi(value: string | null | undefined, yakaRengi: string | null): string | null {
  const izinli = yakaRengi ? (YAKA_DETAY_MAP[yakaRengi] ?? []) : []
  const base = izinli[0] ?? null // MAVI→'MAVI', BEYAZ→'BEYAZ', GRI→'GRI'
  if (!value) return base
  const v = value.toString().toUpperCase().trim()
    .replace(/İ/g, 'I').replace(/Ğ/g, 'G').replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
    .replace(/[\s.]+/g, ' ').trim()
  const patterns: [RegExp, string][] = [
    [/GENEL MUDUR YRD|G MUDUR YRD/, 'BEYAZ_GMUDUR_YRD'],
    [/GENEL MUDUR/, 'BEYAZ_GENEL_MDR'],
    [/MUHENDIS.*(MDR YRD|MUDUR YRD)/, 'BEYAZ_MUHENDIS_MDRYRD'],
    [/MUHENDIS.*MUDUR/, 'BEYAZ_MUHENDIS_MUDUR'],
    [/MUHENDIS/, 'BEYAZ_MUHENDIS'],
    [/SORUMLU TEKNIKER/, 'BEYAZ_SORUMLU_TEKNIKER'],
    [/TEKNIKER/, 'BEYAZ_TEKNIKER'],
    [/MUDUR YRD/, 'BEYAZ_MUDUR_YRD'],
    [/MUDUR/, 'BEYAZ_MUDUR'],
    [/VEKALET/, 'GRI_VEKALET'],
  ]
  let match: string | null = null
  for (const [re, enumVal] of patterns) {
    if (re.test(v)) { match = enumVal; break }
  }
  if (!match) {
    if (v.includes('GRI')) match = 'GRI'
    else if (v.includes('MAVI')) match = 'MAVI'
    else if (v.includes('BEYAZ')) match = 'BEYAZ'
  }
  // Tutarlılık: bulunan değer seçili yaka'nın altında değilse taban değere düş.
  if (match && izinli.includes(match)) return match
  return base
}

function normalizeDirektEndirekt(value: string | null | undefined): string | null {
  if (!value) return null
  const v = value.toString().toUpperCase().trim()
    .replace(/İ/g, 'I')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
  // Ayraçları (boşluk/tire/altçizgi) temizle: "A-DIREK" → "ADIREK", "EN DIREK" → "ENDIREK".
  const t = v.replace(/[\s\-_]/g, '')
  // NOT: "DIREK" alt-dizesi "ENDIREK" içinde de bulunur → DIREKT ayrımı hep !hasEndirek ile.
  const hasDirek = t.includes('DIREK')
  const hasEndirek = t.includes('ENDIREK') || t.includes('INDIREK')
  const isA = t.startsWith('A')
  const isB = t.startsWith('B')

  // A/B ÖNCE (sıralama kritik). Excel: A hep direkt, B hep endirekt.
  if (isA && hasDirek && !hasEndirek) return 'A_DIREKT'
  if (isB && hasEndirek) return 'B_ENDIREKT'

  // Beklenmedik kombinasyonlar (Excel'de görülmez) — güvenlik için logla, baz kurala düş.
  if (isA && hasEndirek) console.warn(`[normalizeDirektEndirekt] beklenmedik A+ENDIREK: "${value}" → ENDIREKT`)
  if (isB && hasDirek && !hasEndirek) console.warn(`[normalizeDirektEndirekt] beklenmedik B+DIREK: "${value}" → DIREKT`)

  // Baz kurallar (A/B yok veya beklenmedik kombinasyon fallback'i)
  if (hasDirek && !hasEndirek) return 'DIREKT'
  if (hasEndirek) return 'ENDIREKT'
  return null
}

function normalizeAsansorMekanik(value: string | null | undefined): string | null {
  if (!value) return null
  const v = value.toString().toUpperCase().trim()
    .replace(/Ö/g, 'O')
    .replace(/Ü/g, 'U')
  if (v.includes('ASANSOR') || v.includes('ASANSÖR')) return 'ASANSOR'
  if (v.includes('MEKANIK')) return 'MEKANIK'
  if (v === 'YOK' || v === '-' || v === '') return 'YOK'
  return null
}

function normalizeBloodType(value: string | null | undefined): string | null {
  if (!value) return null
  const v = value.toString().trim()
  const map: Record<string, string> = {
    'A+': 'A_POSITIVE', 'A Rh+': 'A_POSITIVE', 'A RH+': 'A_POSITIVE',
    'A-': 'A_NEGATIVE', 'A Rh-': 'A_NEGATIVE', 'A RH-': 'A_NEGATIVE',
    'B+': 'B_POSITIVE', 'B Rh+': 'B_POSITIVE', 'B RH+': 'B_POSITIVE',
    'B-': 'B_NEGATIVE', 'B Rh-': 'B_NEGATIVE', 'B RH-': 'B_NEGATIVE',
    'AB+': 'AB_POSITIVE', 'AB Rh+': 'AB_POSITIVE', 'AB RH+': 'AB_POSITIVE',
    'AB-': 'AB_NEGATIVE', 'AB Rh-': 'AB_NEGATIVE', 'AB RH-': 'AB_NEGATIVE',
    '0+': 'O_POSITIVE', '0 Rh+': 'O_POSITIVE', '0 RH+': 'O_POSITIVE', 'O+': 'O_POSITIVE', 'O Rh+': 'O_POSITIVE',
    '0-': 'O_NEGATIVE', '0 Rh-': 'O_NEGATIVE', '0 RH-': 'O_NEGATIVE', 'O-': 'O_NEGATIVE', 'O Rh-': 'O_NEGATIVE',
  }
  return map[v] || null
}

function parseBoolean(value: any): boolean {
  if (value === null || value === undefined || value === '') return false
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  const v = value.toString().toUpperCase().trim()
  return ['E', 'EVET', '1', 'TRUE', 'VAR', 'X'].includes(v)
}

function parseDate(value: any): Date | null {
  if (!value) return null
  // Excel serial date number
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    if (date) return new Date(date.y, date.m - 1, date.d)
    return null
  }
  const parsed = new Date(value)
  return isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Bir tarihe ay ekler (deneme süresi hesaplaması için).
 * Ay taşmasını düzeltir (örn. 31 Ocak + 1 ay = 28 Şubat, 3 Mart değil).
 */
function addMonthsToDate(date: Date | null, months: number): Date | null {
  if (!date) return null
  const d = new Date(date)
  const day = d.getDate()
  d.setMonth(d.getMonth() + months)
  if (d.getDate() !== day) d.setDate(0) // ay taşması fix
  return d
}

/**
 * Denetim izini yazar: 1 özet + N kayıt satırı.
 *
 * İMPORT'U ASLA DÜŞÜRMEZ: tümü try/catch içinde; log yazılamazsa yalnız
 * console.error düşer, yüklenen veri geçerli kalır (veri > iz).
 * Kayıt satırları özete `importId` ile bağlanır.
 */
async function denetimIziYaz(args: {
  actorId: string
  actorEmail: string
  importId: string
  dosyaAdi: string
  satirSayisi: number
  olusturulan: number
  guncellenen: number
  hataliSatir: number
  alanSayaclari: Record<string, number>
  kayitIzleri: { personnelId: string; sicilNo: string; islem: string; degisenAlanlar: string[] }[]
  durum: 'TAMAMLANDI' | 'HATA'
  hataMesaji?: string
}): Promise<void> {
  try {
    await logAuditEvent({
      action: 'PERSONNEL_BULK_IMPORT',
      actorId: args.actorId,
      targetType: 'PERSONNEL',
      targetId: args.importId,
      details: {
        actorEmail: args.actorEmail,
        importId: args.importId,
        dosyaAdi: args.dosyaAdi,
        satirSayisi: args.satirSayisi,
        olusturulan: args.olusturulan,
        guncellenen: args.guncellenen,
        hataliSatir: args.hataliSatir,
        // Alan bazlı sayaç: hangi alan kaç kayıtta değişti (DEĞER YOK).
        alanSayaclari: args.alanSayaclari,
        durum: args.durum,
        ...(args.hataMesaji ? { hataMesaji: args.hataMesaji } : {}),
      },
    })
  } catch (e) {
    console.error('[import-audit] ozet kaydi yazilamadi:', e)
  }

  // Kayıt bazında iz — tekil düzenlemedeki (PERSONNEL_UPDATED) izlenebilirliğin
  // toplu karşılığı. Biri patlarsa diğerleri yazılmaya devam eder.
  for (const iz of args.kayitIzleri) {
    try {
      await logAuditEvent({
        action: 'PERSONNEL_IMPORT_KAYIT',
        actorId: args.actorId,
        targetType: 'PERSONNEL',
        // targetId = Personnel.id — PERSONNEL_UPDATED ile aynı gelenek, böylece
        // kayıt bazlı bir geçmiş sorgusu tekil ve toplu izi birlikte görür.
        targetId: iz.personnelId,
        details: {
          importId: args.importId,
          sicilNo: iz.sicilNo,
          islem: iz.islem,
          // Yalnız alan ADLARI — eski/yeni değer KVKK gereği yazılmaz.
          degisenAlanlar: iz.degisenAlanlar,
        },
      })
    } catch (e) {
      console.error(`[import-audit] kayit izi yazilamadi (${iz.sicilNo}):`, e)
    }
  }
}

export async function POST(request: NextRequest) {
  // Hata dalında da iz bırakabilmek için durum dış kapsamda tutulur: try içinde
  // patlarsa "nereye kadar işlendi" bilgisi kaybolmasın.
  let izDurumu:
    | (Omit<Parameters<typeof denetimIziYaz>[0], 'durum' | 'hataMesaji'>)
    | null = null
  try {
    // PR-Y2.5-personnel: requireUser — Excel import + createdBy/updatedBy yazımı
    const { user, error } = await requireUser()
    if (error) return error

    if (!ALLOWED_ROLES.includes(user.role) && !isHRDepartment(user.department)) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Dosya yüklenmedi' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]

    // Başlık satırını otomatik bul ("SİCİL NO" içeren satır)
    const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })
    let headerRowIndex = 0
    for (let i = 0; i < Math.min(10, rawRows.length); i++) {
      const row = rawRows[i]
      if (row && row.some((cell: any) => cell && cell.toString().includes('SİCİL'))) {
        headerRowIndex = i
        break
      }
    }
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null, range: headerRowIndex })

    let created = 0
    let updated = 0
    const errors: { row: number; message: string }[] = []

    // ─── DENETİM İZİ (2026-09) ────────────────────────────────────────────────
    // Bu uç HİÇBİR iz bırakmıyordu: 30.08.2026'da 783 Personnel satırı tek seferde
    // değişti ve denetim kaydında karşılığı yok — kim, hangi dosyayla, neyi
    // değiştirdi bilinmiyor. Toplu yükleme tekil düzenlemeden (PERSONNEL_UPDATED)
    // daha geniş etki taşıdığı için iz ZORUNLU.
    //
    // İKİ KADEME (mevcut konvansiyonun ikisi de kullanılıyor):
    //   · özet     → PERSONNEL_BULK_IMPORT  (PERSONNEL_BULK_BACKFILL deseni: tek satır)
    //   · kayıt    → PERSONNEL_IMPORT_KAYIT (PERSONNEL_UPDATED deseni: personel başına)
    // Kayıt satırları özete `importId` ile bağlanır.
    //
    // KVKK: DEĞER YAZILMAZ. Yalnız sicilNo + hangi alanların değiştiği (alan ADI).
    // TC/IBAN/adres içerikleri denetim kaydına GİRMEZ.
    const importId = `imp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    const dosyaAdi = file.name || '(isimsiz)'
    const alanSayaclari: Record<string, number> = {}
    const kayitIzleri: {
      personnelId: string
      sicilNo: string
      islem: 'OLUSTURULDU' | 'GUNCELLENDI'
      degisenAlanlar: string[]
    }[] = []
    // Değer karşılaştırması: Date/null/undefined normalize edilir; içerik LOGLANMAZ.
    const ayniMi = (a: unknown, b: unknown): boolean => {
      if (a instanceof Date || b instanceof Date) {
        const t = (v: unknown) => (v instanceof Date ? v.getTime() : v ? new Date(v as string).getTime() : null)
        return t(a) === t(b)
      }
      const n = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v).trim())
      return n(a) === n(b)
    }
    // Alanı hem satırın izine hem genel sayaca ekler. `alanlar` dizisi
    // kayitIzleri'ndeki nesnenin İÇİNDEKİ referans — mutasyon oraya da yansır.
    const izEkle = (alanlar: string[], alan: string) => {
      alanlar.push(alan)
      alanSayaclari[alan] = (alanSayaclari[alan] ?? 0) + 1
    }

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2 // Excel row (header is 1)
      const raw = rows[i]

      try {
        // Map Excel columns to field names
        const mapped: Record<string, any> = {}
        for (const [excelCol, fieldName] of Object.entries(EXCEL_COLUMN_MAP)) {
          if (raw[excelCol] !== undefined && raw[excelCol] !== null) {
            mapped[fieldName] = raw[excelCol]
          }
        }

        // Validate required fields
        if (!mapped.sicilNo) {
          errors.push({ row: rowNum, message: 'Sicil No boş' })
          continue
        }
        if (!mapped.adSoyad) {
          errors.push({ row: rowNum, message: 'Ad Soyad boş' })
          continue
        }

        const sicilNo = mapped.sicilNo.toString().trim()

        // Normalize enums
        const cinsiyet = normalizeGender(mapped.cinsiyet)
        if (!cinsiyet) {
          errors.push({ row: rowNum, message: `Geçersiz cinsiyet: ${mapped.cinsiyet}` })
          continue
        }

        const yakaRengi = normalizeYaka(mapped.yakaRengi)
        if (!yakaRengi) {
          errors.push({ row: rowNum, message: `Geçersiz yaka rengi: ${mapped.yakaRengi}` })
          continue
        }
        // Yaka Aşama 1: yakaDetayi (sütun varsa metinden, yoksa yaka tabanı — hep tutarlı).
        const yakaDetayi = normalizeYakaDetayi(mapped.yakaDetayi, yakaRengi)

        const iseGirisTarihi = parseDate(mapped.iseGirisTarihi)
        if (!iseGirisTarihi) {
          errors.push({ row: rowNum, message: `Geçersiz işe giriş tarihi: ${mapped.iseGirisTarihi}` })
          continue
        }

        if (!mapped.gorev) {
          errors.push({ row: rowNum, message: 'Görev boş' })
          continue
        }

        if (!mapped.bolum) {
          errors.push({ row: rowNum, message: 'Bölüm boş' })
          continue
        }

        // Build personnel data
        const personnelData: any = {
          sicilNo,
          adSoyad: mapped.adSoyad.toString().trim(),
          cinsiyet,
          yakaRengi,
          yakaDetayi,
          iseGirisTarihi,
          gorev: mapped.gorev.toString().trim(),
          bolum: mapped.bolum.toString().trim(),
          sinif: mapped.sinif?.toString().trim() || null,
          bolumDetay: mapped.bolumDetay?.toString().trim() || null,
          birimSorumlusu: mapped.birimSorumlusu?.toString().trim() || null,
          sorumlu2: mapped.sorumlu2?.toString().trim() || null,
          sorumlu3: mapped.sorumlu3?.toString().trim() || null,
          bolumMuduru: mapped.bolumMuduru?.toString().trim() || null,
          masrafMerkezi: mapped.masrafMerkezi?.toString().trim() || null,
          interKepMail: mapped.interKepMail?.toString().trim() || null,
          mailAdresi: mapped.mailAdresi?.toString().trim() || null,
          ikametAdresi: mapped.ikametAdresi?.toString().trim() || null,
          serviceRoute: mapped.serviceRoute?.toString().trim() || null,
          serviceStop: mapped.serviceStop?.toString().trim() || null,
          telefon: mapped.telefon?.toString().trim() || null,
          egitimYeri: mapped.egitimYeri?.toString().trim() || null,
          egitimTipi: mapped.egitimTipi?.toString().trim() || null,
          egitimAlani: mapped.egitimAlani?.toString().trim() || null,
          // Excel'de tarih varsa onu kullan; yoksa iseGirisTarihi + 2/6 ay
          // (deneme süresi yasal sabit hesap; Excel'deki manuel girişler tutarsız oluyordu)
          denemeDegerlendirme: mapped.denemeDegerlendirme
            ? parseDate(mapped.denemeDegerlendirme)
            : addMonthsToDate(iseGirisTarihi, 2),
          altiAyDegerlendirme: mapped.altiAyDegerlendirme
            ? parseDate(mapped.altiAyDegerlendirme)
            : addMonthsToDate(iseGirisTarihi, 6),
          createdBy: user.id,
        }

        // Optional enums
        const direktEndirekt = normalizeDirektEndirekt(mapped.direktEndirekt)
        if (direktEndirekt) personnelData.direktEndirekt = direktEndirekt

        const asansorMekanik = normalizeAsansorMekanik(mapped.asansorMekanik)
        if (asansorMekanik) personnelData.asansorMekanik = asansorMekanik

        const kanGrubu = normalizeBloodType(mapped.kanGrubu)
        if (kanGrubu) personnelData.kanGrubu = kanGrubu

        if (mapped.mezuniyetYili) {
          const year = parseInt(mapped.mezuniyetYili)
          if (!isNaN(year)) personnelData.mezuniyetYili = year
        }

        // Booleans
        // ilkYardimciBelgesi tarih alanı
        if (mapped.ilkYardimciBelgesi) {
          const ilkYardimciDate = parseDate(mapped.ilkYardimciBelgesi)
          if (ilkYardimciDate) personnelData.ilkYardimciBelgesi = ilkYardimciDate
        }
        personnelData.emekli = parseBoolean(mapped.emekli)
        personnelData.engelli = parseBoolean(mapped.engelli)
        personnelData.forkliftEhliyeti = parseBoolean(mapped.forkliftEhliyeti)
        personnelData.eTrans = parseBoolean(mapped.eTrans)
        // yanginSertifikasi tarih alanı
        if (mapped.yanginSertifikasi) {
          const yanginDate = parseDate(mapped.yanginSertifikasi)
          if (yanginDate) personnelData.yanginSertifikasi = yanginDate
        }
        personnelData.ustaOgreticiBelgesi = parseBoolean(mapped.ustaOgreticiBelgesi)

        // Belge tarihleri
        if (mapped.kalfalikBelgesi) {
          const kalfalikDate = parseDate(mapped.kalfalikBelgesi)
          if (kalfalikDate) personnelData.kalfalikBelgesi = kalfalikDate
        }
        if (mapped.ustalikBelgesi) {
          const ustalikDate = parseDate(mapped.ustalikBelgesi)
          if (ustalikDate) personnelData.ustalikBelgesi = ustalikDate
        }

        // FAZ 1 · ÇİFT YAZIM: metin alanları AYNEN yazılır (yukarıda kuruldu),
        // yanlarına FK'lar doldurulur. Excel'den serbest metin geldiği için ad
        // çözülemeyebilir → FK null + uyarı logu; SATIR REDDEDİLMEZ.
        Object.assign(
          personnelData,
          await personelFkAlanlari(prisma, {
            bolum: personnelData.bolum,
            birimSorumlusu: personnelData.birimSorumlusu,
            sorumlu2: personnelData.sorumlu2,
            sorumlu3: personnelData.sorumlu3,
          }),
        )

        // Upsert personnel
        const existing = await prisma.personnel.findUnique({ where: { sicilNo } })

        let personnelId: string
        // Hassas alanlar (TC/IBAN) aşağıda yazılıyor; izleri bu diziye eklenir.
        let satirAlanlari: string[] = []
        if (existing) {
          delete personnelData.createdBy
          // Denetim izi: YAZMADAN ÖNCE hangi alanların gerçekten değiştiğini bul.
          // Yalnız alan ADI toplanır; eski/yeni DEĞER hiçbir yere yazılmaz (KVKK).
          const degisenAlanlar = Object.keys(personnelData).filter(
            (k) => k !== 'updatedBy' && !ayniMi((existing as Record<string, unknown>)[k], personnelData[k]),
          )
          const updatedRecord = await prisma.personnel.update({
            where: { sicilNo },
            data: personnelData,
          })
          personnelId = updatedRecord.id
          updated++
          for (const alan of degisenAlanlar) alanSayaclari[alan] = (alanSayaclari[alan] ?? 0) + 1
          kayitIzleri.push({ personnelId, sicilNo, islem: 'GUNCELLENDI', degisenAlanlar })
          satirAlanlari = degisenAlanlar
        } else {
          const createdRecord = await prisma.personnel.create({
            data: personnelData,
          })
          personnelId = createdRecord.id
          created++
          kayitIzleri.push({ personnelId, sicilNo, islem: 'OLUSTURULDU', degisenAlanlar: [] })
          // Org koltugu — toplu ice aktarimda da yeni personel semada yer bulsun.
          // NOT: bu akista satir basina $transaction YOK (mevcut desen); helper
          // dogrudan prisma ile cagrilir. Eslesme yoksa koltuk acilmaz, import DEVAM eder.
          await personelEklendiginde(prisma, personnelId, { actorId: user.id })
        }

        // Handle sensitive fields
        const sensitiveData: any = {}
        let hasSensitive = false

        if (mapped.tcKimlikNo) {
          sensitiveData.tcKimlikNo = mapped.tcKimlikNo.toString().trim()
          hasSensitive = true
        }
        if (mapped.sgkNo) {
          sensitiveData.sgkNo = mapped.sgkNo.toString().trim()
          hasSensitive = true
        }
        // PR-1: banka alanları artık PersonnelBankAccount'a yazılır (aşağıda), sensitive'e DEĞİL.
        if (mapped.dogumTarihi) {
          const dogumTarihi = parseDate(mapped.dogumTarihi)
          if (dogumTarihi) {
            sensitiveData.dogumTarihi = dogumTarihi
            hasSensitive = true
          }
        }

        if (hasSensitive) {
          // Denetim izi: TC gerçekten değişti mi? Değer YALNIZ karşılaştırma için
          // belleğe alınır, hiçbir yere yazılmaz (KVKK).
          const tcOncesi =
            existing && mapped.tcKimlikNo
              ? (
                  await prisma.personnelSensitive.findUnique({
                    where: { personnelId },
                    select: { tcKimlikNo: true },
                  })
                )?.tcKimlikNo ?? null
              : null

          sensitiveData.updatedBy = user.id
          await prisma.personnelSensitive.upsert({
            where: { personnelId },
            update: sensitiveData,
            create: {
              personnelId,
              ...sensitiveData,
            },
          })

          if (existing && mapped.tcKimlikNo && !ayniMi(tcOncesi, sensitiveData.tcKimlikNo)) {
            izEkle(satirAlanlari, 'tcKimlikNo')
          }
        }

        // PR-1: banka bilgisi → PersonnelBankAccount (primary). IDEMPOTENT: hesabı olan kişiyi atla.
        const hasBankData = !!(mapped.bankaSube || mapped.bankaHesapNo || mapped.ibanNo)
        if (hasBankData) {
          // count yerine kaydın kendisi: yazma koşulu AYNI (hesap yoksa oluştur),
          // ek olarak "Excel farklı IBAN getirdi ama atlandı" durumu ayırt edilebiliyor.
          // orderBy determinist: önce primary, sonra en eski, eşitlikte id.
          const mevcutHesap = await prisma.personnelBankAccount.findFirst({
            where: { personnelId },
            select: { ibanNo: true },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
          })
          const yeniIban = mapped.ibanNo ? mapped.ibanNo.toString().trim() : null
          if (!mevcutHesap) {
            await prisma.personnelBankAccount.create({
              data: {
                personnelId,
                bankaSube: mapped.bankaSube ? mapped.bankaSube.toString().trim() : null,
                hesapNo: mapped.bankaHesapNo ? mapped.bankaHesapNo.toString().trim() : null,
                ibanNo: yeniIban,
                isPrimary: true,
                aktif: true,
                updatedBy: user.id,
              },
            })
            if (existing && yeniIban) izEkle(satirAlanlari, 'ibanNo:yeni')
          } else if (existing && yeniIban && !ayniMi(mevcutHesap.ibanNo, yeniIban)) {
            // Hesap zaten var → bu uç mevcut hesabı GÜNCELLEMİYOR (idempotent).
            // Excel farklı bir IBAN getirdiyse yazılmadı; iz bunu kayda geçirir.
            izEkle(satirAlanlari, 'ibanNo:atlandi')
          }
        }
      } catch (rowError: any) {
        errors.push({ row: rowNum, message: rowError.message || 'Bilinmeyen hata' })
      }

      // Her satırdan sonra tazelenir: beklenmeyen bir hata olursa hata dalı
      // en son işlenen satıra kadarki sayaçlarla iz yazabilsin.
      izDurumu = {
        actorId: user.id,
        actorEmail: user.email,
        importId,
        dosyaAdi,
        satirSayisi: rows.length,
        olusturulan: created,
        guncellenen: updated,
        hataliSatir: errors.length,
        alanSayaclari,
        kayitIzleri,
      }
    }

    await denetimIziYaz({
      actorId: user.id,
      actorEmail: user.email,
      importId,
      dosyaAdi,
      satirSayisi: rows.length,
      olusturulan: created,
      guncellenen: updated,
      hataliSatir: errors.length,
      alanSayaclari,
      kayitIzleri,
      durum: 'TAMAMLANDI',
    })

    return NextResponse.json({ created, updated, errors, importId })
  } catch (error) {
    console.error('Excel import hatası:', error)
    // HATA DURUMUNDA DA İZ: nereye kadar işlendiği kaybolmasın. Sayaçlar try
    // bloğunda tanımlı olduğu için burada erişilemez → her satırdan sonra
    // tazelenen dış kapsamdaki `izDurumu` üzerinden yazılır. Hiç satır
    // işlenmeden patladıysa (dosya okunamadı vb.) izDurumu null'dır, iz yazılmaz.
    if (izDurumu) {
      await denetimIziYaz({ ...izDurumu, durum: 'HATA', hataMesaji: error instanceof Error ? error.message : String(error) })
    }
    return NextResponse.json({ error: 'Excel import sırasında bir hata oluştu' }, { status: 500 })
  }
}

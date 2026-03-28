import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { EXCEL_COLUMN_MAP } from '@/lib/personnel-constants'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['ADMIN', 'HR_MANAGER', 'SUPER_ADMIN']

function isHRDepartment(dept: string | undefined | null): boolean {
  if (!dept) return false
  const d = dept.toLowerCase()
  return d.includes('insan') || d.includes('human') || d.includes('hr') || d.includes('ik')
}

// Hassas alan isimleri - PersonnelSensitive tablosuna gidecekler
const SENSITIVE_FIELDS = ['tcKimlikNo', 'sgkNo', 'dogumTarihi', 'bankaSube', 'bankaHesapNo']

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
  if (v === 'MAVI' || v.includes('MAVI')) return 'MAVI'
  if (v === 'BEYAZ' || v.includes('BEYAZ')) return 'BEYAZ'
  return null
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
  if (v.includes('DIREKT') && !v.includes('ENDIREKT')) return 'DIREKT'
  if (v.includes('ENDIREKT') || v.includes('INDIREKT')) return 'ENDIREKT'
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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userRole = (session.user as any).role
    const userDept = (session.user as any).department
    if (!ALLOWED_ROLES.includes(userRole) && !isHRDepartment(userDept)) {
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
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null })

    let created = 0
    let updated = 0
    const errors: { row: number; message: string }[] = []

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
          iseGirisTarihi,
          gorev: mapped.gorev.toString().trim(),
          bolum: mapped.bolum.toString().trim(),
          sinif: mapped.sinif?.toString().trim() || null,
          bolumDetay: mapped.bolumDetay?.toString().trim() || null,
          birimSorumlusu: mapped.birimSorumlusu?.toString().trim() || null,
          bolumMuduru: mapped.bolumMuduru?.toString().trim() || null,
          masrafMerkezi: mapped.masrafMerkezi?.toString().trim() || null,
          interKepMail: mapped.interKepMail?.toString().trim() || null,
          telefon: mapped.telefon?.toString().trim() || null,
          egitimYeri: mapped.egitimYeri?.toString().trim() || null,
          egitimTipi: mapped.egitimTipi?.toString().trim() || null,
          egitimAlani: mapped.egitimAlani?.toString().trim() || null,
          denemeDegerlendirme: mapped.denemeDegerlendirme?.toString().trim() || null,
          altiAyDegerlendirme: mapped.altiAyDegerlendirme?.toString().trim() || null,
          createdBy: session.user.id,
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
        personnelData.mykUstalikKalfalik = parseBoolean(mapped.mykUstalikKalfalik)
        personnelData.ilkYardimci = parseBoolean(mapped.ilkYardimci)
        personnelData.emekli = parseBoolean(mapped.emekli)
        personnelData.engelli = parseBoolean(mapped.engelli)

        // Upsert personnel
        const existing = await prisma.personnel.findUnique({ where: { sicilNo } })

        let personnelId: string
        if (existing) {
          delete personnelData.createdBy
          const updatedRecord = await prisma.personnel.update({
            where: { sicilNo },
            data: personnelData,
          })
          personnelId = updatedRecord.id
          updated++
        } else {
          const createdRecord = await prisma.personnel.create({
            data: personnelData,
          })
          personnelId = createdRecord.id
          created++
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
        if (mapped.bankaSube) {
          sensitiveData.bankaSube = mapped.bankaSube.toString().trim()
          hasSensitive = true
        }
        if (mapped.bankaHesapNo) {
          sensitiveData.bankaHesapNo = mapped.bankaHesapNo.toString().trim()
          hasSensitive = true
        }
        if (mapped.dogumTarihi) {
          const dogumTarihi = parseDate(mapped.dogumTarihi)
          if (dogumTarihi) {
            sensitiveData.dogumTarihi = dogumTarihi
            hasSensitive = true
          }
        }

        if (hasSensitive) {
          sensitiveData.updatedBy = session.user.id
          await prisma.personnelSensitive.upsert({
            where: { personnelId },
            update: sensitiveData,
            create: {
              personnelId,
              ...sensitiveData,
            },
          })
        }
      } catch (rowError: any) {
        errors.push({ row: rowNum, message: rowError.message || 'Bilinmeyen hata' })
      }
    }

    return NextResponse.json({ created, updated, errors })
  } catch (error) {
    console.error('Excel import hatası:', error)
    return NextResponse.json({ error: 'Excel import sırasında bir hata oluştu' }, { status: 500 })
  }
}

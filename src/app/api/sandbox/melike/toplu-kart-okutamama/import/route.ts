import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { requireUser } from '@/lib/auth/require-user'
import { getBulkCardScanAccess } from '../_lib/access'
import { VALID_NEDEN, NEDEN_LABELS, type KartOkutamamaNedeni } from '../_lib/neden'
import { hasDuplicateRecord, DUPLICATE_ERROR_MESSAGE } from '../_lib/duplicate-check'
import { notifyApproverOfPendingRecord } from '../_lib/notify-hr'
import { resolveApprovers, getManagedPersonnelIds } from '../_lib/approvers'

export const dynamic = 'force-dynamic'

interface ImportRow {
  'SİCİL NO'?: string | number
  'ADI VE SOYADI'?: string
  'TARİH'?: string | number | Date
  'GİRİŞ SAATİ'?: string
  'ÇIKIŞ SAATİ'?: string
  'NEDEN'?: string
}

const NEDEN_LABEL_TO_KEY: Record<string, KartOkutamamaNedeni> = Object.fromEntries(
  VALID_NEDEN.map((key) => [NEDEN_LABELS[key].toLocaleUpperCase('tr-TR'), key])
) as Record<string, KartOkutamamaNedeni>

function parseNeden(value: string | undefined): { neden: KartOkutamamaNedeni | null; invalid: boolean } {
  if (!value || !value.trim()) return { neden: null, invalid: false }
  const normalized = value.trim().toLocaleUpperCase('tr-TR')
  if ((VALID_NEDEN as readonly string[]).includes(normalized)) {
    return { neden: normalized as KartOkutamamaNedeni, invalid: false }
  }
  if (NEDEN_LABEL_TO_KEY[normalized]) {
    return { neden: NEDEN_LABEL_TO_KEY[normalized], invalid: false }
  }
  return { neden: null, invalid: true }
}

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const MAX_ROWS = 500
const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream', // bazı tarayıcılar/OS'ler .xlsx için bunu gönderir
]

function parseExcelDate(value: string | number | Date | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return null
    return new Date(parsed.y, parsed.m - 1, parsed.d)
  }
  // "DD.MM.YYYY" veya "DD/MM/YYYY"
  const match = String(value).trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (match) {
    const [, d, m, y] = match
    return new Date(Number(y), Number(m) - 1, Number(d))
  }
  const fallback = new Date(value)
  return isNaN(fallback.getTime()) ? null : fallback
}

interface PersonnelLite {
  id: string
  sicilNo: string | null
  adSoyad: string
  bolum: string
}

/**
 * POST /api/sandbox/melike/toplu-kart-okutamama/import
 * Excel dosyasından toplu kayıt oluşturur. Her satır SİCİL NO ile
 * Personnel (İV) tablosunda eşleştirilir — isim/sicil client'tan güvenilmez,
 * sadece gerçek Personnel kaydına bağlanan satırlar kabul edilir.
 * GRİ kullanıcı yalnızca kendi adına veya ekibi (1./2./3. Sorumlusu olduğu
 * kişiler) için kayıt açabilir (POST /toplu-kart-okutamama route'undaki
 * kuralla birebir aynı).
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    const access = await getBulkCardScanAccess(user.id)
    if (access.level === 'NONE' || access.level === 'SELF') {
      return NextResponse.json({ error: 'Bu forma erişim yetkiniz yok' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith('.xlsx') || !ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Geçersiz dosya formatı — yalnızca .xlsx kabul edilir' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Dosya boyutu 2MB sınırını aşıyor' }, { status: 400 })
    }

    let rows: ImportRow[]
    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      rows = XLSX.utils.sheet_to_json(sheet)
    } catch {
      return NextResponse.json({ error: 'Geçersiz dosya — Excel içeriği okunamadı' }, { status: 400 })
    }

    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `En fazla ${MAX_ROWS} satır aktarılabilir (bu dosyada ${rows.length} satır var)` },
        { status: 400 },
      )
    }

    const results: { created: number; errors: { row: number; message: string }[] } = {
      created: 0,
      errors: [],
    }

    interface ParsedRow {
      rowIndex: number
      sicilNo: string
      adSoyad: string
      tarih: Date
      girisSaati: string | null
      cikisSaati: string | null
      neden: KartOkutamamaNedeni | null
    }
    const parsed: ParsedRow[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const sicilNo = row['SİCİL NO'] ? String(row['SİCİL NO']).trim() : ''
      const adSoyad = row['ADI VE SOYADI'] ? String(row['ADI VE SOYADI']).trim() : ''
      const tarih = parseExcelDate(row['TARİH'])

      if (!sicilNo && !adSoyad) {
        results.errors.push({ row: i + 2, message: 'Sicil No veya Ad Soyad boş' })
        continue
      }
      if (!tarih) {
        results.errors.push({ row: i + 2, message: 'Tarih okunamadı' })
        continue
      }

      const { neden, invalid } = parseNeden(row['NEDEN'])
      if (invalid) {
        results.errors.push({ row: i + 2, message: `Geçersiz neden: "${row['NEDEN']}"` })
        continue
      }

      parsed.push({
        rowIndex: i + 2,
        sicilNo,
        adSoyad,
        tarih,
        girisSaati: row['GİRİŞ SAATİ'] ? String(row['GİRİŞ SAATİ']).trim() : null,
        cikisSaati: row['ÇIKIŞ SAATİ'] ? String(row['ÇIKIŞ SAATİ']).trim() : null,
        neden,
      })
    }

    // Satır başına findFirst yerine TEK toplu sorgu + Map: sicilNo'lu satırlar
    // sicilNo IN (...), sicilNo'suz (yalnız ad-soyad) satırlar OR/insensitive IN (...).
    const bySicil = new Map<string, PersonnelLite>()
    const byAdSoyad = new Map<string, PersonnelLite>()

    const sicilNos = [...new Set(parsed.filter((p) => p.sicilNo).map((p) => p.sicilNo))]
    const adSoyadlarSicilsiz = [...new Set(parsed.filter((p) => !p.sicilNo && p.adSoyad).map((p) => p.adSoyad))]

    if (sicilNos.length > 0) {
      const found = await prisma.personnel.findMany({
        where: { aktif: true, sicilNo: { in: sicilNos } },
        select: { id: true, sicilNo: true, adSoyad: true, bolum: true },
      })
      for (const p of found) {
        if (p.sicilNo) bySicil.set(p.sicilNo, p)
      }
    }

    if (adSoyadlarSicilsiz.length > 0) {
      const found = await prisma.personnel.findMany({
        where: {
          aktif: true,
          OR: adSoyadlarSicilsiz.map((name) => ({ adSoyad: { equals: name, mode: 'insensitive' as const } })),
        },
        select: { id: true, sicilNo: true, adSoyad: true, bolum: true },
      })
      for (const p of found) {
        byAdSoyad.set(p.adSoyad.toLowerCase(), p)
      }
    }

    interface ToCreate {
      personnelId: string
      sicilNo: string | null
      adSoyad: string
      tarih: Date
      girisSaati: string | null
      cikisSaati: string | null
      neden: KartOkutamamaNedeni | null
      onayDurumu: 'BEKLIYOR' | 'ONAYLANDI'
      approverId: string | null
      approverId2: string | null
      approverId3: string | null
    }
    const toCreate: ToCreate[] = []

    // GRI: kendi adına veya (varsa) 1./2./3. Sorumlusu olduğu kişiler için kayıt
    // açabilir — bölüm eşleşmesi yerine bu esas alınır (Full'da kısıtlama yok).
    const managedIds =
      access.level === 'GRI' && access.personnelId ? await getManagedPersonnelIds(access.personnelId) : []

    for (const p of parsed) {
      const personnel = p.sicilNo ? bySicil.get(p.sicilNo) : byAdSoyad.get(p.adSoyad.toLowerCase())

      if (!personnel) {
        results.errors.push({
          row: p.rowIndex,
          message: `Personel bulunamadı (Sicil No: ${p.sicilNo || '-'}, Ad Soyad: ${p.adSoyad || '-'})`,
        })
        continue
      }

      if (access.level === 'GRI' && personnel.id !== access.personnelId && !managedIds.includes(personnel.id)) {
        results.errors.push({
          row: p.rowIndex,
          message: `Yetki dışı — sadece kendi adınıza veya ekibiniz için kayıt açabilirsiniz (Sicil No: ${personnel.sicilNo || '-'}, Ad Soyad: ${personnel.adSoyad})`,
        })
        continue
      }

      const isDuplicate = await hasDuplicateRecord({
        personnelId: personnel.id,
        tarih: p.tarih,
        girisSaati: p.girisSaati,
        cikisSaati: p.cikisSaati,
      })
      if (isDuplicate) {
        results.errors.push({ row: p.rowIndex, message: DUPLICATE_ERROR_MESSAGE })
        continue
      }

      let onayDurumu: 'BEKLIYOR' | 'ONAYLANDI' = 'ONAYLANDI'
      let approverId: string | null = null
      let approverId2: string | null = null
      let approverId3: string | null = null
      if (access.level === 'GRI' && personnel.id === access.personnelId) {
        onayDurumu = 'BEKLIYOR'
        const resolved = await resolveApprovers(personnel.id)
        approverId = resolved.approverId
        approverId2 = resolved.approverId2
        approverId3 = resolved.approverId3
      }

      toCreate.push({
        personnelId: personnel.id,
        sicilNo: personnel.sicilNo,
        adSoyad: personnel.adSoyad,
        tarih: p.tarih,
        girisSaati: p.girisSaati,
        cikisSaati: p.cikisSaati,
        neden: p.neden,
        onayDurumu,
        approverId,
        approverId2,
        approverId3,
      })
    }

    if (toCreate.length > 0) {
      const created = await prisma.$transaction(
        toCreate.map((c) =>
          prisma.bulkCardScanFailure.create({
            data: {
              personnelId: c.personnelId,
              sicilNo: c.sicilNo,
              adSoyad: c.adSoyad,
              tarih: c.tarih,
              girisSaati: c.girisSaati,
              cikisSaati: c.cikisSaati,
              neden: c.neden,
              createdById: user.id,
              onayDurumu: c.onayDurumu,
              approverId: c.approverId,
              approverId2: c.approverId2,
              approverId3: c.approverId3,
            },
          }),
        ),
      )
      results.created = toCreate.length

      for (const record of created) {
        if (record.onayDurumu === 'BEKLIYOR') {
          notifyApproverOfPendingRecord(
            [record.approverId, record.approverId2, record.approverId3].filter((id): id is string => !!id),
            { sicilNo: record.sicilNo, adSoyad: record.adSoyad },
            user.name || user.email
          )
        }
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Toplu kart okutamama import hatası:', error)
    return NextResponse.json({ error: 'Import başarısız' }, { status: 500 })
  }
}

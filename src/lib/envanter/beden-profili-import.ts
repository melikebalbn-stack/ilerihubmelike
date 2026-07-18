import { prisma } from '@/lib/prisma'

// `import XLSX from 'xlsx'` Next.js server ortamında CJS/ESM interop tutarsızlığı
// yüzünden undefined dönebiliyor (import.ts'te de aynı sebeple require kullanılıyor).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx') as typeof import('xlsx')

export type BedenProfilImportHata = {
  satirNo: number
  sicilNo: string
  mesaj: string
}

export type BedenProfilValidateSonuc = {
  gecerliSayisi: number
  hatalar: BedenProfilImportHata[]
  eslesenSicil: string[]
  eslesmeyenSicil: string[]
}

export type BedenProfilExecuteSonuc = {
  guncellenen: number
  atlanan: number
  hatalar: BedenProfilImportHata[]
}

type BedenProfilSatiri = {
  satirNo: number
  sicilNo: string
  ustBeden: string
  altBeden: string
  ayakkabiNo: string
  eldivenNo: string
  aciklama: string
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function upper(v: string) {
  return v.trim().toLocaleUpperCase('tr-TR')
}

function col(headers: string[], name: string): number {
  return headers.findIndex((h) => h === name)
}

// Basit tek-sayfa okuma: 1. satır başlık, 2. satırdan itibaren veri (import.ts'teki
// ZORUNLU/opsiyonel işaret satırı ve "örnek satır" atlama mantığı burada YOK — bu
// şablon daha basit, sadece boş satırlar atlanır).
function parseSatirlar(buffer: Buffer): BedenProfilSatiri[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return []

  const ws = wb.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })

  const headers = (raw[0] ?? []).map((h) => cellToString(h))
  const idx = {
    sicilNo: col(headers, 'sicilNo'),
    ustBeden: col(headers, 'ustBeden'),
    altBeden: col(headers, 'altBeden'),
    ayakkabiNo: col(headers, 'ayakkabiNo'),
    eldivenNo: col(headers, 'eldivenNo'),
    aciklama: col(headers, 'aciklama'),
  }

  const satirlar: BedenProfilSatiri[] = []

  for (let i = 1; i < raw.length; i++) {
    const row = raw[i] as unknown[]
    if (row.every((c) => cellToString(c) === '')) continue

    satirlar.push({
      satirNo: i + 1,
      sicilNo: cellToString(row[idx.sicilNo]),
      ustBeden: cellToString(row[idx.ustBeden]),
      altBeden: cellToString(row[idx.altBeden]),
      ayakkabiNo: cellToString(row[idx.ayakkabiNo]),
      eldivenNo: cellToString(row[idx.eldivenNo]),
      aciklama: cellToString(row[idx.aciklama]),
    })
  }

  return satirlar
}

export async function validateBedenProfilImport(buffer: Buffer): Promise<BedenProfilValidateSonuc> {
  const satirlar = parseSatirlar(buffer)

  const personeller = await prisma.personnel.findMany({ select: { sicilNo: true } })
  const dbSicilSet = new Set(personeller.filter((p) => p.sicilNo).map((p) => upper(p.sicilNo!)))

  const hatalar: BedenProfilImportHata[] = []
  const eslesenSicilSet = new Set<string>()
  const eslesmeyenSicilSet = new Set<string>()

  for (const satir of satirlar) {
    if (!satir.sicilNo) {
      hatalar.push({ satirNo: satir.satirNo, sicilNo: '', mesaj: 'sicilNo zorunludur.' })
      continue
    }

    if (!dbSicilSet.has(upper(satir.sicilNo))) {
      hatalar.push({
        satirNo: satir.satirNo,
        sicilNo: satir.sicilNo,
        mesaj: `"${satir.sicilNo}" sicil no personel listesinde bulunamadı.`,
      })
      eslesmeyenSicilSet.add(satir.sicilNo)
      continue
    }

    eslesenSicilSet.add(satir.sicilNo)
  }

  return {
    gecerliSayisi: eslesenSicilSet.size,
    hatalar,
    eslesenSicil: Array.from(eslesenSicilSet),
    eslesmeyenSicil: Array.from(eslesmeyenSicilSet),
  }
}

export async function executeBedenProfilImport(
  buffer: Buffer,
  updatedById?: string,
): Promise<BedenProfilExecuteSonuc> {
  const satirlar = parseSatirlar(buffer)

  const personeller = await prisma.personnel.findMany({ select: { id: true, sicilNo: true } })
  const personelIdBySicil = new Map(
    personeller.filter((p) => p.sicilNo).map((p) => [upper(p.sicilNo!), p.id]),
  )

  let guncellenen = 0
  let atlanan = 0
  const hatalar: BedenProfilImportHata[] = []

  for (const satir of satirlar) {
    if (!satir.sicilNo) {
      atlanan++
      hatalar.push({ satirNo: satir.satirNo, sicilNo: '', mesaj: 'sicilNo zorunludur.' })
      continue
    }

    const personnelId = personelIdBySicil.get(upper(satir.sicilNo))
    if (!personnelId) {
      atlanan++
      hatalar.push({
        satirNo: satir.satirNo,
        sicilNo: satir.sicilNo,
        mesaj: `"${satir.sicilNo}" sicil no personel listesinde bulunamadı.`,
      })
      continue
    }

    const veri = {
      ustBeden: satir.ustBeden || null,
      altBeden: satir.altBeden || null,
      ayakkabiNo: satir.ayakkabiNo || null,
      eldivenNo: satir.eldivenNo || null,
      not: satir.aciklama || null,
      updatedById: updatedById || null,
    }

    await prisma.envanterPersonelBedenProfili.upsert({
      where: { personnelId },
      create: { personnelId, ...veri },
      update: veri,
    })

    guncellenen++
  }

  return { guncellenen, atlanan, hatalar }
}

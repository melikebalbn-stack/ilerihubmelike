import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"

// Turkce karakter normalizasyonu
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "c")
    .trim()
}

// Kolon eslestirme tablosu
const COLUMN_MAP: Record<string, string[]> = {
  name: ["ad", "varlik adi", "asset name", "name", "cihaz adi", "bilgisayar adi", "cihaz"],
  hostname: ["hostname", "bilgisayar adi", "pc adi", "computer name", "host"],
  ipAddress: ["ip", "ip adresi", "ip address"],
  macAddress: ["mac", "mac adresi", "mac address"],
  operatingSystem: ["isletim sistemi", "os", "operating system", "isletim"],
  processor: ["islemci", "cpu", "processor"],
  ram: ["ram", "bellek", "memory"],
  diskSize: ["disk", "disk boyutu", "hdd", "ssd", "storage", "depolama"],
  serialNumber: ["seri no", "seri numarasi", "serial", "serial number", "sn"],
  manufacturer: ["marka", "uretici", "brand", "manufacturer"],
  model: ["model", "model adi"],
  barcode: ["barkod", "barcode", "barkod no"],
  location: ["konum", "lokasyon", "location", "yer"],
  department: ["departman", "bolum", "department", "birim"],
  assignedTo: ["kullanici", "atanan kisi", "assigned to", "user", "sahip", "kullanan", "zimmetli", "ad soyad"],
  assignedToEmail: ["email", "e-posta", "kullanici email", "mail"],
  warrantyEndDate: ["garanti bitis", "garanti tarihi", "warranty end", "warranty", "garanti"],
  notes: ["not", "notlar", "notes", "aciklama"],
}

// Kolon eslestirme fonksiyonu
function mapColumns(headers: string[]): Record<string, string | null> {
  const mapping: Record<string, string | null> = {}

  for (const [field, aliases] of Object.entries(COLUMN_MAP)) {
    mapping[field] = null
    for (const header of headers) {
      const normalizedHeader = normalize(header)
      for (const alias of aliases) {
        if (normalizedHeader === alias || normalizedHeader.includes(alias)) {
          mapping[field] = header
          break
        }
      }
      if (mapping[field]) break
    }
  }

  return mapping
}

// Tarih parse etme
function parseDate(value: unknown): Date | null {
  if (!value) return null

  if (value instanceof Date) return value

  const str = String(value).trim()
  if (!str) return null

  // DD.MM.YYYY veya DD/MM/YYYY
  const parts = str.split(/[./-]/)
  if (parts.length === 3) {
    const day = parseInt(parts[0])
    const month = parseInt(parts[1]) - 1
    const year = parseInt(parts[2])
    if (year > 100) {
      const d = new Date(year, month, day)
      if (!isNaN(d.getTime())) return d
    }
  }

  // ISO format
  const d = new Date(str)
  if (!isNaN(d.getTime())) return d

  return null
}

// Tip tespiti
function detectType(model: string | null, name: string | null): string {
  const combined = normalize(`${model || ""} ${name || ""}`)

  if (combined.includes("laptop") || combined.includes("notebook") || combined.includes("dizustu")) {
    return "LAPTOP"
  }
  if (combined.includes("sunucu") || combined.includes("server")) {
    return "SERVER"
  }
  if (combined.includes("yazici") || combined.includes("printer")) {
    return "PRINTER"
  }
  if (combined.includes("mobil") || combined.includes("tablet") || combined.includes("telefon")) {
    return "MOBILE_DEVICE"
  }
  if (combined.includes("switch") || combined.includes("anahtar")) {
    return "SWITCH"
  }
  if (combined.includes("router") || combined.includes("yonlendirici")) {
    return "ROUTER"
  }
  if (combined.includes("firewall") || combined.includes("guvenlik duvari")) {
    return "FIREWALL"
  }
  if (combined.includes("nas") || combined.includes("depolama") || combined.includes("storage")) {
    return "STORAGE"
  }

  return "DESKTOP"
}

// CIA ve kritiklik otomatik atama
function getCIAValues(type: string): { c: number; i: number; a: number } {
  switch (type) {
    case "SERVER":
      return { c: 4, i: 4, a: 5 }
    case "FIREWALL":
      return { c: 5, i: 5, a: 5 }
    case "SWITCH":
    case "ROUTER":
      return { c: 3, i: 4, a: 5 }
    case "STORAGE":
      return { c: 4, i: 4, a: 4 }
    case "PRINTER":
      return { c: 1, i: 1, a: 2 }
    case "MOBILE_DEVICE":
      return { c: 3, i: 2, a: 2 }
    default: // DESKTOP, LAPTOP
      return { c: 3, i: 3, a: 3 }
  }
}

function getCriticality(total: number): string {
  if (total >= 12) return "CRITICAL"
  if (total >= 9) return "HIGH"
  if (total >= 6) return "MEDIUM"
  return "LOW"
}

// Kategori tespiti
function detectCategory(type: string): string {
  if (["SWITCH", "ROUTER", "FIREWALL", "ACCESS_POINT"].includes(type)) {
    return "NETWORK"
  }
  return "HARDWARE"
}

// POST - Excel'den toplu varlik import
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const allowedRoles = ["ADMIN", "SUPER_ADMIN", "QUALITY_MANAGER"]
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Bu islem icin yetkiniz yok" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const defaultCategory = formData.get("category") as string | null

    if (!file) {
      return NextResponse.json({ error: "Dosya bulunamadi" }, { status: 400 })
    }

    // Dosyayi oku
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false }) as Record<string, string>[]

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Dosya bos veya gecersiz format" }, { status: 400 })
    }

    // Kolon eslestirme
    const headers = Object.keys(data[0])
    const columnMap = mapColumns(headers)

    // Mevcut son asset numarasini al
    const lastAsset = await prisma.iso27001Asset.findFirst({
      orderBy: { assetNumber: "desc" },
    })
    let nextNumber = 1
    if (lastAsset?.assetNumber) {
      const match = lastAsset.assetNumber.match(/ASSET-(\d+)/)
      if (match) nextNumber = parseInt(match[1]) + 1
    }

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
      columnMapping: columnMap,
    }

    // Her satiri isle
    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNum = i + 2 // Excel satir numarasi (baslik + 1-indexed)

      try {
        // Degerler cikart
        const getValue = (field: string): string | null => {
          const col = columnMap[field]
          if (!col) return null
          const val = row[col]?.trim()
          return val || null
        }

        const name = getValue("name") || getValue("hostname") || getValue("manufacturer")
        if (!name) {
          results.skipped++
          continue
        }

        const model = getValue("model")
        const manufacturer = getValue("manufacturer")
        const assetType = detectType(model, name)
        const category = defaultCategory || detectCategory(assetType)
        const cia = getCIAValues(assetType)
        const assetValue = cia.c + cia.i + cia.a
        const criticality = getCriticality(assetValue)

        const assetNumber = `ASSET-${String(nextNumber).padStart(3, "0")}`

        // Varlik adi olustur
        let assetName = name
        if (manufacturer && model && !name.includes(manufacturer) && !name.includes(model)) {
          assetName = `${manufacturer} ${model}`
        } else if (!model && manufacturer) {
          assetName = manufacturer
        }

        // Hostname varsa ve name'den farkliysa, name'i daha anlamli yap
        const hostname = getValue("hostname")
        if (hostname && hostname !== assetName) {
          assetName = `${assetName} (${hostname})`
        }

        await prisma.iso27001Asset.create({
          data: {
            assetNumber,
            name: assetName,
            category: category as any,
            type: assetType as any,
            location: getValue("location"),
            department: getValue("department"),
            confidentiality: cia.c,
            integrity: cia.i,
            availability: cia.a,
            assetValue,
            criticality: criticality as any,
            classification: "INTERNAL",
            status: "ACTIVE",
            manufacturer: manufacturer,
            model: model,
            serialNumber: getValue("serialNumber"),
            hostname: hostname,
            ipAddress: getValue("ipAddress"),
            macAddress: getValue("macAddress"),
            operatingSystem: getValue("operatingSystem"),
            processor: getValue("processor"),
            ram: getValue("ram"),
            diskSize: getValue("diskSize"),
            barcode: getValue("barcode"),
            warrantyEndDate: parseDate(getValue("warrantyEndDate")),
            assignedTo: getValue("assignedTo"),
            assignedToEmail: getValue("assignedToEmail"),
            notes: getValue("notes"),
            nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          },
        })

        nextNumber++
        results.success++
      } catch (error) {
        results.failed++
        results.errors.push(
          `Satir ${rowNum}: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`
        )
      }
    }

    return NextResponse.json({
      message: `${results.success} varlik basariyla import edildi`,
      ...results,
    })
  } catch (error) {
    console.error("Varlik import hatasi:", error)
    return NextResponse.json({ error: "Import islemi basarisiz" }, { status: 500 })
  }
}

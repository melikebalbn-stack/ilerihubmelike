import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { calculateMaterialRow, calculateLaborRow, recalculateCosts } from '@/lib/cost-analysis/calculations'
import { requireUser } from '@/lib/auth/require-user'

// ===================== LABEL REVERSE MAPS =====================

const materialCategoryMap: Record<string, string> = {
  'Hammadde': 'RAW_MATERIAL',
  'Yarı Mamul': 'SEMI_FINISHED',
  'Satın Alınan': 'PURCHASED_PART',
  'Standart Parça': 'STANDARD_PART',
  'Sarf Malzeme': 'CONSUMABLE',
}

const laborTypeMap: Record<string, string> = {
  'Dahili': 'INTERNAL',
  'Dış Hizmet': 'EXTERNAL',
  'Montaj': 'ASSEMBLY',
}

const serviceTypeMap: Record<string, string> = {
  'İşleme': 'PROCESSING',
  'Yüzey İşleme': 'SURFACE_TREATMENT',
  'Test': 'TESTING',
  'Sertifikasyon': 'CERTIFICATION',
  'Nakliye': 'TRANSPORT',
  'Diğer': 'OTHER',
}

const otherCostCategoryMap: Record<string, string> = {
  'Montaj İşçiliği': 'ASSEMBLY_LABOR',
  'Bağlantı Elemanları': 'CONNECTION_PARTS',
  'Kalite Kontrol': 'QUALITY_CONTROL',
  'Nakliye': 'TRANSPORT',
  'Paketleme': 'PACKAGING',
  'Mühendislik': 'ENGINEERING',
  'Takım/Kalıp': 'TOOLING',
  'Sertifikasyon': 'CERTIFICATION',
  'Diğer': 'OTHER',
}

const VALID_MATERIAL_CATEGORIES = Object.values(materialCategoryMap)
const VALID_LABOR_TYPES = Object.values(laborTypeMap)
const VALID_SERVICE_TYPES = Object.values(serviceTypeMap)
const VALID_OTHER_CATEGORIES = Object.values(otherCostCategoryMap)

// ===================== HELPERS =====================

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || value === '-') return null
  const str = String(value).replace(/[^\d.,-]/g, '').replace(',', '.')
  const num = parseFloat(str)
  return isNaN(num) ? null : num
}

function getString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function resolveEnum(value: string, map: Record<string, string>, validValues: string[]): string | null {
  if (!value) return null
  // Direct enum value match
  const upper = value.toUpperCase().replace(/\s+/g, '_')
  if (validValues.includes(upper)) return upper
  // Turkish label match
  if (map[value]) return map[value]
  // Case-insensitive label match
  for (const [label, enumVal] of Object.entries(map)) {
    if (label.toLowerCase() === value.toLowerCase()) return enumVal
  }
  return null
}

type ParsedMaterial = {
  materialCode: string
  name: string
  specification: string
  category: string
  unit: string
  grossQuantity: number
  wasteRate: number
  unitPrice: number
  valid: boolean
  errors: string[]
}

type ParsedLabor = {
  operationCode: string
  operationName: string
  workCenter: string
  laborType: string
  setupTime: number
  processTime: number
  hourlyRate: number
  valid: boolean
  errors: string[]
}

type ParsedExternalService = {
  serviceCode: string
  serviceName: string
  description: string
  serviceType: string
  quantity: number
  unit: string
  unitPrice: number
  valid: boolean
  errors: string[]
}

type ParsedOtherCost = {
  name: string
  description: string
  category: string
  quantity: number
  unitPrice: number
  valid: boolean
  errors: string[]
}

// ===================== SHEET PARSERS =====================

function parseMaterialsSheet(sheet: XLSX.WorkSheet): ParsedMaterial[] {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
  const results: ParsedMaterial[] = []

  for (const row of rows) {
    const errors: string[] = []

    const name = getString(row['Malzeme Adı'] ?? row['name'] ?? row['Adı'] ?? row['Malzeme'])
    if (!name) {
      errors.push('Malzeme adı zorunludur')
    }

    const grossQuantity = parseNumber(row['Brüt Miktar'] ?? row['grossQuantity'] ?? row['Miktar'])
    if (grossQuantity === null || grossQuantity < 0) {
      errors.push('Brüt miktar geçerli bir sayı olmalıdır')
    }

    const unitPrice = parseNumber(row['Birim Fiyat'] ?? row['unitPrice'] ?? row['Fiyat'])
    if (unitPrice === null || unitPrice < 0) {
      errors.push('Birim fiyat geçerli bir sayı olmalıdır')
    }

    const wasteRate = parseNumber(row['Fire (%)'] ?? row['Fire'] ?? row['wasteRate']) ?? 0

    const categoryStr = getString(row['Kategori'] ?? row['category'] ?? '')
    const category = resolveEnum(categoryStr, materialCategoryMap, VALID_MATERIAL_CATEGORIES) || 'RAW_MATERIAL'

    results.push({
      materialCode: getString(row['Malzeme Kodu'] ?? row['materialCode'] ?? row['Kod'] ?? ''),
      name,
      specification: getString(row['Spesifikasyon'] ?? row['specification'] ?? ''),
      category,
      unit: getString(row['Birim'] ?? row['unit'] ?? '') || 'kg',
      grossQuantity: grossQuantity ?? 0,
      wasteRate,
      unitPrice: unitPrice ?? 0,
      valid: errors.length === 0,
      errors,
    })
  }

  return results
}

function parseLaborSheet(sheet: XLSX.WorkSheet): ParsedLabor[] {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
  const results: ParsedLabor[] = []

  for (const row of rows) {
    const errors: string[] = []

    const operationName = getString(row['Operasyon Adı'] ?? row['operationName'] ?? row['Operasyon'])
    if (!operationName) {
      errors.push('Operasyon adı zorunludur')
    }

    const processTime = parseNumber(row['İşlem Süresi (sa)'] ?? row['İşlem Süresi'] ?? row['processTime'])
    if (processTime === null || processTime < 0) {
      errors.push('İşlem süresi geçerli bir sayı olmalıdır')
    }

    const hourlyRate = parseNumber(row['Saat Ücreti'] ?? row['hourlyRate'] ?? row['Ücret'])
    if (hourlyRate === null || hourlyRate < 0) {
      errors.push('Saat ücreti geçerli bir sayı olmalıdır')
    }

    const setupTime = parseNumber(row['Hazırlık Süresi (sa)'] ?? row['Hazırlık Süresi'] ?? row['setupTime']) ?? 0

    const typeStr = getString(row['Tip'] ?? row['laborType'] ?? row['Tür'] ?? '')
    const laborType = resolveEnum(typeStr, laborTypeMap, VALID_LABOR_TYPES) || 'INTERNAL'

    results.push({
      operationCode: getString(row['Operasyon Kodu'] ?? row['operationCode'] ?? row['Kod'] ?? ''),
      operationName,
      workCenter: getString(row['İş Merkezi'] ?? row['workCenter'] ?? row['Makine'] ?? ''),
      laborType,
      setupTime,
      processTime: processTime ?? 0,
      hourlyRate: hourlyRate ?? 0,
      valid: errors.length === 0,
      errors,
    })
  }

  return results
}

function parseExternalServicesSheet(sheet: XLSX.WorkSheet): ParsedExternalService[] {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
  const results: ParsedExternalService[] = []

  for (const row of rows) {
    const errors: string[] = []

    const serviceName = getString(row['Hizmet Adı'] ?? row['serviceName'] ?? row['Hizmet'])
    if (!serviceName) {
      errors.push('Hizmet adı zorunludur')
    }

    const unitPrice = parseNumber(row['Birim Fiyat'] ?? row['unitPrice'] ?? row['Fiyat'])
    if (unitPrice === null || unitPrice < 0) {
      errors.push('Birim fiyat geçerli bir sayı olmalıdır')
    }

    const quantity = parseNumber(row['Miktar'] ?? row['quantity']) ?? 1

    const typeStr = getString(row['Tip'] ?? row['serviceType'] ?? row['Tür'] ?? '')
    const serviceType = resolveEnum(typeStr, serviceTypeMap, VALID_SERVICE_TYPES) || 'PROCESSING'

    results.push({
      serviceCode: getString(row['Hizmet Kodu'] ?? row['serviceCode'] ?? row['Kod'] ?? ''),
      serviceName,
      description: getString(row['Açıklama'] ?? row['description'] ?? ''),
      serviceType,
      quantity,
      unit: getString(row['Birim'] ?? row['unit'] ?? '') || 'adet',
      unitPrice: unitPrice ?? 0,
      valid: errors.length === 0,
      errors,
    })
  }

  return results
}

function parseOtherCostsSheet(sheet: XLSX.WorkSheet): ParsedOtherCost[] {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
  const results: ParsedOtherCost[] = []

  for (const row of rows) {
    const errors: string[] = []

    const name = getString(row['Kalem Adı'] ?? row['name'] ?? row['Kalem'] ?? row['Adı'])
    if (!name) {
      errors.push('Kalem adı zorunludur')
    }

    const unitPrice = parseNumber(row['Birim Fiyat'] ?? row['unitPrice'] ?? row['Fiyat'] ?? row['Tutar'])
    if (unitPrice === null || unitPrice < 0) {
      errors.push('Birim fiyat geçerli bir sayı olmalıdır')
    }

    const quantity = parseNumber(row['Miktar'] ?? row['quantity']) ?? 1

    const categoryStr = getString(row['Kategori'] ?? row['category'] ?? '')
    const category = resolveEnum(categoryStr, otherCostCategoryMap, VALID_OTHER_CATEGORIES) || 'OTHER'

    results.push({
      name,
      description: getString(row['Açıklama'] ?? row['description'] ?? ''),
      category,
      quantity,
      unitPrice: unitPrice ?? 0,
      valid: errors.length === 0,
      errors,
    })
  }

  return results
}

// ===================== SHEET FINDER =====================

function findSheet(wb: XLSX.WorkBook, names: string[]): XLSX.WorkSheet | null {
  for (const name of names) {
    if (wb.SheetNames.includes(name)) {
      return wb.Sheets[name]
    }
  }
  // Fuzzy match
  for (const sheetName of wb.SheetNames) {
    const lower = sheetName.toLowerCase().replace(/\s+/g, '')
    for (const name of names) {
      if (lower.includes(name.toLowerCase().replace(/\s+/g, ''))) {
        return wb.Sheets[sheetName]
      }
    }
  }
  return null
}

// ===================== POST - PARSE EXCEL =====================

export async function POST(request: NextRequest) {
  try {
    // PR-Y2.5-cost-analysis: requireUser + hasCostAnalysisAccess (Excel parse)
    const { session, user, error } = await requireUser()
    if (error) return error
    if (!(session.user.permissions?.includes('costanalysis.admin') ?? false)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Dosya yüklenmedi' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Dosya boyutu 10MB\'dan büyük olamaz' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: 'buffer' })

    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      return NextResponse.json({ error: 'Excel dosyası boş veya okunamıyor' }, { status: 400 })
    }

    // Parse sheets
    const matSheet = findSheet(wb, ['Malzemeler', 'Materials', 'Malzeme'])
    const laborSheet = findSheet(wb, ['İşçilik', 'Labor', 'Iscilik'])
    const extSheet = findSheet(wb, ['Dış Hizmetler', 'Dis Hizmetler', 'External Services', 'External'])
    const otherSheet = findSheet(wb, ['Diğer Maliyetler', 'Diger Maliyetler', 'Other Costs', 'Other'])

    const materials = matSheet ? parseMaterialsSheet(matSheet) : []
    const laborItems = laborSheet ? parseLaborSheet(laborSheet) : []
    const externalServices = extSheet ? parseExternalServicesSheet(extSheet) : []
    const otherCosts = otherSheet ? parseOtherCostsSheet(otherSheet) : []

    const totalItems = materials.length + laborItems.length + externalServices.length + otherCosts.length

    if (totalItems === 0) {
      return NextResponse.json({
        error: 'Excel dosyasında tanınabilir veri bulunamadı. Sayfalar "Malzemeler", "İşçilik", "Dış Hizmetler", "Diğer Maliyetler" adlarında olmalıdır.',
      }, { status: 400 })
    }

    const errorCount =
      materials.filter(m => !m.valid).length +
      laborItems.filter(l => !l.valid).length +
      externalServices.filter(s => !s.valid).length +
      otherCosts.filter(o => !o.valid).length

    return NextResponse.json({
      materials,
      laborItems,
      externalServices,
      otherCosts,
      summary: {
        totalItems,
        errorCount,
        materialCount: materials.length,
        laborCount: laborItems.length,
        externalServiceCount: externalServices.length,
        otherCostCount: otherCosts.length,
        sheetsFound: [
          matSheet && 'Malzemeler',
          laborSheet && 'İşçilik',
          extSheet && 'Dış Hizmetler',
          otherSheet && 'Diğer Maliyetler',
        ].filter(Boolean),
      },
    })
  } catch (error) {
    console.error('Excel import parse hatası:', error)
    return NextResponse.json({ error: 'Excel dosyası işlenirken hata oluştu' }, { status: 500 })
  }
}

// ===================== PUT - SAVE IMPORTED DATA =====================

export async function PUT(request: NextRequest) {
  try {
    // PR-Y2.5-cost-analysis: requireUser + hasCostAnalysisAccess (Excel save)
    const { session, user, error } = await requireUser()
    if (error) return error
    if (!(session.user.permissions?.includes('costanalysis.admin') ?? false)) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
    }

    const body = await request.json()
    const {
      code,
      name,
      description,
      finishedWeight,
      currency,
      categoryId,
      customerId,
      overheadRate,
      profitRate,
      materials,
      laborItems,
      externalServices,
      otherCosts,
    } = body

    if (!code || !code.trim()) {
      return NextResponse.json({ error: 'Ürün kodu zorunludur' }, { status: 400 })
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Ürün adı zorunludur' }, { status: 400 })
    }

    // Check unique code
    const existingAnalysis = await prisma.costAnalysis.findFirst({
      where: { code: code.trim(), revisionNumber: 0 },
    })

    if (existingAnalysis) {
      return NextResponse.json({ error: 'Bu ürün kodu zaten mevcut' }, { status: 400 })
    }

    // Create analysis with all items in a transaction
    const analysis = await prisma.$transaction(async (tx) => {
      // Create main analysis
      const newAnalysis = await tx.costAnalysis.create({
        data: {
          code: code.trim(),
          name: name.trim(),
          description: description?.trim() || null,
          revision: 'Rev.00',
          revisionNumber: 0,
          isLatest: true,
          finishedWeight: parseFloat(finishedWeight) || 0,
          currency: currency || 'EUR',
          categoryId: categoryId || null,
          customerId: customerId || null,
          overheadRate: parseFloat(overheadRate) || 25,
          profitRate: parseFloat(profitRate) || 20,
          createdById: user.id,
          status: 'DRAFT',
        },
      })

      // Create materials
      if (materials && materials.length > 0) {
        const matData = materials.filter((m: ParsedMaterial) => m.valid !== false).map((m: ParsedMaterial, i: number) => {
          const { netQuantity, totalPrice } = calculateMaterialRow(m.grossQuantity, m.wasteRate, m.unitPrice)
          return {
            costAnalysisId: newAnalysis.id,
            materialCode: m.materialCode || null,
            name: m.name,
            specification: m.specification || null,
            category: m.category as 'RAW_MATERIAL' | 'SEMI_FINISHED' | 'PURCHASED_PART' | 'STANDARD_PART' | 'CONSUMABLE',
            unit: m.unit || 'kg',
            currency: (currency || 'EUR') as 'TRY' | 'EUR' | 'USD' | 'GBP',
            grossQuantity: m.grossQuantity,
            wasteRate: m.wasteRate,
            netQuantity,
            unitPrice: m.unitPrice,
            totalPrice,
            sortOrder: i,
          }
        })

        if (matData.length > 0) {
          await tx.costMaterial.createMany({ data: matData })
        }
      }

      // Create labor items
      if (laborItems && laborItems.length > 0) {
        const laborData = laborItems.filter((l: ParsedLabor) => l.valid !== false).map((l: ParsedLabor, i: number) => {
          const { totalTime, totalCost } = calculateLaborRow(l.setupTime, l.processTime, l.hourlyRate)
          return {
            costAnalysisId: newAnalysis.id,
            operationCode: l.operationCode || null,
            operationName: l.operationName,
            workCenter: l.workCenter || null,
            laborType: l.laborType as 'INTERNAL' | 'EXTERNAL' | 'ASSEMBLY',
            setupTime: l.setupTime,
            processTime: l.processTime,
            totalTime,
            hourlyRate: l.hourlyRate,
            totalCost,
            sortOrder: i,
          }
        })

        if (laborData.length > 0) {
          await tx.costLabor.createMany({ data: laborData })
        }
      }

      // Create external services
      if (externalServices && externalServices.length > 0) {
        const extData = externalServices.filter((s: ParsedExternalService) => s.valid !== false).map((s: ParsedExternalService, i: number) => ({
          costAnalysisId: newAnalysis.id,
          serviceCode: s.serviceCode || null,
          serviceName: s.serviceName,
          description: s.description || null,
          serviceType: s.serviceType as 'PROCESSING' | 'SURFACE_TREATMENT' | 'TESTING' | 'CERTIFICATION' | 'TRANSPORT' | 'OTHER',
          quantity: s.quantity,
          unit: s.unit || 'adet',
          unitPrice: s.unitPrice,
          totalPrice: s.quantity * s.unitPrice,
          sortOrder: i,
        }))

        if (extData.length > 0) {
          await tx.costExternalService.createMany({ data: extData })
        }
      }

      // Create other costs
      if (otherCosts && otherCosts.length > 0) {
        const otherData = otherCosts.filter((o: ParsedOtherCost) => o.valid !== false).map((o: ParsedOtherCost, i: number) => ({
          costAnalysisId: newAnalysis.id,
          name: o.name,
          description: o.description || null,
          category: o.category as 'ASSEMBLY_LABOR' | 'CONNECTION_PARTS' | 'QUALITY_CONTROL' | 'TRANSPORT' | 'PACKAGING' | 'ENGINEERING' | 'TOOLING' | 'CERTIFICATION' | 'OTHER',
          quantity: o.quantity,
          unit: 'adet',
          unitPrice: o.unitPrice,
          totalPrice: o.quantity * o.unitPrice,
          sortOrder: i,
        }))

        if (otherData.length > 0) {
          await tx.costOtherItem.createMany({ data: otherData })
        }
      }

      return newAnalysis
    })

    // Recalculate costs
    await recalculateCosts(analysis.id)

    return NextResponse.json({
      id: analysis.id,
      message: 'Maliyet analizi başarıyla oluşturuldu',
    })
  } catch (error) {
    console.error('Excel import kaydetme hatası:', error)
    return NextResponse.json({ error: 'Veriler kaydedilirken hata oluştu' }, { status: 500 })
  }
}

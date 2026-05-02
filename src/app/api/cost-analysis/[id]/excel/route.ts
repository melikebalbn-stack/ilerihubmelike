import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { hasCostAnalysisAccess } from '@/lib/cost-analysis/access'

const materialCategoryLabels: Record<string, string> = {
  RAW_MATERIAL: 'Hammadde',
  SEMI_FINISHED: 'Yarı Mamul',
  PURCHASED_PART: 'Satın Alınan',
  STANDARD_PART: 'Standart Parça',
  CONSUMABLE: 'Sarf Malzeme',
}

const laborTypeLabels: Record<string, string> = {
  INTERNAL: 'Dahili',
  EXTERNAL: 'Dış Hizmet',
  ASSEMBLY: 'Montaj',
}

const serviceTypeLabels: Record<string, string> = {
  PROCESSING: 'İşleme',
  SURFACE_TREATMENT: 'Yüzey İşleme',
  TESTING: 'Test',
  CERTIFICATION: 'Sertifikasyon',
  TRANSPORT: 'Nakliye',
  OTHER: 'Diğer',
}

const otherCostCategoryLabels: Record<string, string> = {
  ASSEMBLY_LABOR: 'Montaj İşçiliği',
  CONNECTION_PARTS: 'Bağlantı Elemanları',
  QUALITY_CONTROL: 'Kalite Kontrol',
  TRANSPORT: 'Nakliye',
  PACKAGING: 'Paketleme',
  ENGINEERING: 'Mühendislik',
  TOOLING: 'Takım/Kalıp',
  CERTIFICATION: 'Sertifikasyon',
  OTHER: 'Diğer',
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Taslak',
  PENDING_REVIEW: 'İncelemede',
  APPROVED: 'Onaylı',
  REJECTED: 'Reddedildi',
  ARCHIVED: 'Arşivlenmiş',
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const analysis = await prisma.costAnalysis.findUnique({
      where: { id },
      include: {
        category: true,
        customer: true,
        materials: {
          include: { supplier: true },
          orderBy: { sortOrder: 'asc' },
        },
        laborItems: {
          include: { machine: true },
          orderBy: { sortOrder: 'asc' },
        },
        externalServices: {
          include: { supplier: true },
          orderBy: { sortOrder: 'asc' },
        },
        otherCosts: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    if (!analysis) {
      return NextResponse.json({ error: 'Maliyet analizi bulunamadı' }, { status: 404 })
    }

    // Yetki kontrolü
    const userRole = session.user.role || 'EMPLOYEE'

    if (!hasCostAnalysisAccess(userRole, session.user.email)) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      })
      if (!user || analysis.createdById !== user.id) {
        return NextResponse.json({ error: 'Bu analize erişim yetkiniz yok' }, { status: 403 })
      }
    }

    const createdBy = await prisma.user.findUnique({
      where: { id: analysis.createdById },
      select: { name: true, email: true },
    })

    const wb = XLSX.utils.book_new()

    // ========== SHEET 1: ÖZET ==========
    const summaryData = [
      { 'Bilgi': 'Ürün Kodu', 'Değer': analysis.code },
      { 'Bilgi': 'Ürün Adı', 'Değer': analysis.name },
      { 'Bilgi': 'Revizyon', 'Değer': analysis.revision },
      { 'Bilgi': 'Revizyon Notu', 'Değer': analysis.revisionNote || '-' },
      { 'Bilgi': 'Revizyon Tarihi', 'Değer': analysis.revisionDate ? new Date(analysis.revisionDate).toLocaleDateString('tr-TR') : '-' },
      { 'Bilgi': 'Durum', 'Değer': statusLabels[analysis.status] || analysis.status },
      { 'Bilgi': 'Müşteri', 'Değer': analysis.customer?.name || '-' },
      { 'Bilgi': 'Kategori', 'Değer': analysis.category?.name || '-' },
      { 'Bilgi': 'Para Birimi', 'Değer': analysis.currency },
      { 'Bilgi': 'Bitmiş Ağırlık (kg)', 'Değer': Number(analysis.finishedWeight).toString() },
      { 'Bilgi': 'Hazırlayan', 'Değer': createdBy?.name || createdBy?.email || '-' },
      { 'Bilgi': '', 'Değer': '' },
      { 'Bilgi': 'MALİYET ÖZETİ', 'Değer': '' },
      { 'Bilgi': 'Malzeme Maliyeti', 'Değer': Number(analysis.materialCost).toFixed(2) },
      { 'Bilgi': 'İşçilik Maliyeti', 'Değer': Number(analysis.laborCost).toFixed(2) },
      { 'Bilgi': 'Dış Hizmet Maliyeti', 'Değer': Number(analysis.externalCost).toFixed(2) },
      { 'Bilgi': 'Diğer Maliyetler', 'Değer': Number(analysis.otherCost).toFixed(2) },
      { 'Bilgi': 'Ara Toplam', 'Değer': Number(analysis.subtotal).toFixed(2) },
      { 'Bilgi': `İşletme Gideri (%${Number(analysis.overheadRate)})`, 'Değer': Number(analysis.overheadAmount).toFixed(2) },
      { 'Bilgi': 'Toplam Maliyet', 'Değer': Number(analysis.totalCost).toFixed(2) },
      { 'Bilgi': `Kar (%${Number(analysis.profitRate)})`, 'Değer': Number(analysis.profitAmount).toFixed(2) },
      { 'Bilgi': 'Satış Fiyatı', 'Değer': Number(analysis.salesPrice).toFixed(2) },
      { 'Bilgi': '', 'Değer': '' },
      { 'Bilgi': 'BİRİM FİYATLAR', 'Değer': '' },
      { 'Bilgi': 'kg Başına Maliyet', 'Değer': (Number(analysis.finishedWeight) > 0 ? (Number(analysis.totalCost) / Number(analysis.finishedWeight)).toFixed(2) : '0.00') },
      { 'Bilgi': 'kg Başına Fiyat', 'Değer': Number(analysis.pricePerKg).toFixed(2) },
    ]

    const summarySheet = XLSX.utils.json_to_sheet(summaryData)
    summarySheet['!cols'] = [{ wch: 30 }, { wch: 25 }]
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Özet')

    // ========== SHEET 2: MALZEMELER ==========
    if (analysis.materials.length > 0) {
      const matData = analysis.materials.map((m, i) => ({
        'No': i + 1,
        'Malzeme Kodu': m.materialCode || '-',
        'Malzeme Adı': m.name,
        'Spesifikasyon': m.specification || '-',
        'Kategori': materialCategoryLabels[m.category] || m.category,
        'Birim': m.unit,
        'Brüt Miktar': Number(m.grossQuantity),
        'Fire (%)': Number(m.wasteRate),
        'Net Miktar': Number(m.netQuantity),
        'Birim Fiyat': Number(m.unitPrice),
        'Toplam': Number(m.totalPrice),
        'Tedarikçi': m.supplier?.name || '-',
      }))

      const matSheet = XLSX.utils.json_to_sheet(matData)
      matSheet['!cols'] = [
        { wch: 5 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 18 },
        { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
        { wch: 14 }, { wch: 20 },
      ]
      XLSX.utils.book_append_sheet(wb, matSheet, 'Malzemeler')
    }

    // ========== SHEET 3: İŞÇİLİK ==========
    if (analysis.laborItems.length > 0) {
      const laborData = analysis.laborItems.map((l, i) => ({
        'No': i + 1,
        'Operasyon Kodu': l.operationCode || '-',
        'Operasyon Adı': l.operationName,
        'Makine': l.machine?.name || '-',
        'İş Merkezi': l.workCenter || '-',
        'Tip': laborTypeLabels[l.laborType] || l.laborType,
        'Hazırlık Süresi (sa)': Number(l.setupTime),
        'İşlem Süresi (sa)': Number(l.processTime),
        'Toplam Süre (sa)': Number(l.totalTime),
        'Saat Ücreti': Number(l.hourlyRate),
        'Toplam Maliyet': Number(l.totalCost),
      }))

      const laborSheet = XLSX.utils.json_to_sheet(laborData)
      laborSheet['!cols'] = [
        { wch: 5 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 18 },
        { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 14 },
        { wch: 16 },
      ]
      XLSX.utils.book_append_sheet(wb, laborSheet, 'İşçilik')
    }

    // ========== SHEET 4: DIŞ HİZMETLER ==========
    if (analysis.externalServices.length > 0) {
      const extData = analysis.externalServices.map((s, i) => ({
        'No': i + 1,
        'Hizmet Kodu': s.serviceCode || '-',
        'Hizmet Adı': s.serviceName,
        'Açıklama': s.description || '-',
        'Tip': serviceTypeLabels[s.serviceType] || s.serviceType,
        'Miktar': Number(s.quantity),
        'Birim': s.unit,
        'Birim Fiyat': Number(s.unitPrice),
        'Toplam': Number(s.totalPrice),
        'Tedarikçi': s.supplier?.name || '-',
      }))

      const extSheet = XLSX.utils.json_to_sheet(extData)
      extSheet['!cols'] = [
        { wch: 5 }, { wch: 15 }, { wch: 30 }, { wch: 30 }, { wch: 18 },
        { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 20 },
      ]
      XLSX.utils.book_append_sheet(wb, extSheet, 'Dış Hizmetler')
    }

    // ========== SHEET 5: DİĞER MALİYETLER ==========
    if (analysis.otherCosts.length > 0) {
      const otherData = analysis.otherCosts.map((o, i) => ({
        'No': i + 1,
        'Kalem Adı': o.name,
        'Kategori': otherCostCategoryLabels[o.category] || o.category,
        'Açıklama': o.description || '-',
        'Miktar': Number(o.quantity),
        'Birim Fiyat': Number(o.unitPrice),
        'Toplam': Number(o.totalPrice),
      }))

      const otherSheet = XLSX.utils.json_to_sheet(otherData)
      otherSheet['!cols'] = [
        { wch: 5 }, { wch: 30 }, { wch: 22 }, { wch: 30 },
        { wch: 10 }, { wch: 14 }, { wch: 14 },
      ]
      XLSX.utils.book_append_sheet(wb, otherSheet, 'Diğer Maliyetler')
    }

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })

    const fileName = `Maliyet_Analizi_${analysis.code}_${analysis.revision}.xlsx`

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': excelBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Maliyet analizi Excel oluşturulurken hata:', error)
    return NextResponse.json({ error: 'Excel oluşturulamadı' }, { status: 500 })
  }
}

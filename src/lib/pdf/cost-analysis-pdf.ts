import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { PoppinsRegular, PoppinsBold, PoppinsSemiBold } from "./fonts/poppins"
import { IleriGroupLogo } from "./fonts/logo"

export interface CostAnalysisForPDF {
  id: string
  code: string
  name: string
  description: string | null
  revision: string
  finishedWeight: number
  currency: string
  status: string
  materialCost: number
  laborCost: number
  externalCost: number
  otherCost: number
  subtotal: number
  overheadRate: number
  overheadAmount: number
  totalCost: number
  profitRate: number
  profitAmount: number
  salesPrice: number
  pricePerKg: number
  createdAt: string
  updatedAt: string
  categoryName: string | null
  customerName: string | null
  createdByName: string | null
  materials: {
    name: string
    materialCode: string | null
    specification: string | null
    category: string
    unit: string
    grossQuantity: number
    wasteRate: number
    netQuantity: number
    unitPrice: number
    totalPrice: number
    supplierName: string | null
  }[]
  laborItems: {
    operationName: string
    operationCode: string | null
    workCenter: string | null
    laborType: string
    setupTime: number
    processTime: number
    totalTime: number
    hourlyRate: number
    totalCost: number
    machineName: string | null
  }[]
  externalServices: {
    serviceName: string
    serviceCode: string | null
    description: string | null
    serviceType: string
    quantity: number
    unit: string
    unitPrice: number
    totalPrice: number
    supplierName: string | null
  }[]
  otherCosts: {
    name: string
    description: string | null
    category: string
    quantity: number
    unitPrice: number
    totalPrice: number
  }[]
}

const statusLabels: Record<string, string> = {
  DRAFT: "Taslak",
  PENDING_REVIEW: "İncelemede",
  APPROVED: "Onaylı",
  REJECTED: "Reddedildi",
  ARCHIVED: "Arşivlenmiş",
}

const materialCategoryLabels: Record<string, string> = {
  RAW_MATERIAL: "Hammadde",
  SEMI_FINISHED: "Yarı Mamul",
  PURCHASED_PART: "Satın Alınan",
  STANDARD_PART: "Standart Parça",
  CONSUMABLE: "Sarf Malzeme",
}

const laborTypeLabels: Record<string, string> = {
  INTERNAL: "Dahili",
  EXTERNAL: "Dış Hizmet",
  ASSEMBLY: "Montaj",
}

const serviceTypeLabels: Record<string, string> = {
  PROCESSING: "İşleme",
  SURFACE_TREATMENT: "Yüzey İşleme",
  TESTING: "Test",
  CERTIFICATION: "Sertifikasyon",
  TRANSPORT: "Nakliye",
  OTHER: "Diğer",
}

const otherCostCategoryLabels: Record<string, string> = {
  ASSEMBLY_LABOR: "Montaj İşçiliği",
  CONNECTION_PARTS: "Bağlantı Elemanları",
  QUALITY_CONTROL: "Kalite Kontrol",
  TRANSPORT: "Nakliye",
  PACKAGING: "Paketleme",
  ENGINEERING: "Mühendislik",
  TOOLING: "Takım/Kalıp",
  CERTIFICATION: "Sertifikasyon",
  OTHER: "Diğer",
}

const currencySymbols: Record<string, string> = {
  EUR: "€",
  USD: "$",
  TRY: "₺",
  GBP: "£",
}

function fmtCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function fmtNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

function fmtDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function generateCostAnalysisPDFBuffer(data: CostAnalysisForPDF): Buffer {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  })

  // Register Poppins fonts
  doc.addFileToVFS("Poppins-Regular.ttf", PoppinsRegular)
  doc.addFileToVFS("Poppins-Bold.ttf", PoppinsBold)
  doc.addFileToVFS("Poppins-SemiBold.ttf", PoppinsSemiBold)

  doc.addFont("Poppins-Regular.ttf", "Poppins", "normal")
  doc.addFont("Poppins-Bold.ttf", "Poppins", "bold")
  doc.addFont("Poppins-SemiBold.ttf", "Poppins", "semibold")

  doc.setFont("Poppins", "normal")

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 12
  const contentWidth = pageWidth - margin * 2
  let yPos = margin

  // Colors
  const primaryColor: [number, number, number] = [30, 58, 95]
  const accentColor: [number, number, number] = [41, 128, 185]
  const lightGray: [number, number, number] = [245, 247, 250]
  const darkGray: [number, number, number] = [80, 80, 80]
  const mediumGray: [number, number, number] = [120, 120, 120]
  const tealColor: [number, number, number] = [13, 148, 136]

  function checkPageBreak(requiredSpace: number) {
    if (yPos + requiredSpace > pageHeight - 20) {
      doc.addPage()
      yPos = margin + 5
      return true
    }
    return false
  }

  function drawSectionHeader(title: string) {
    checkPageBreak(15)
    doc.setFillColor(...primaryColor)
    doc.rect(margin, yPos, contentWidth, 7, "F")
    doc.setFont("Poppins", "bold")
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text(title, margin + 3, yPos + 5)
    yPos += 10
  }

  function drawInfoRow(label: string, value: string, x: number = margin + 2, labelWidth: number = 35) {
    doc.setFont("Poppins", "semibold")
    doc.setFontSize(8)
    doc.setTextColor(...darkGray)
    doc.text(label + ":", x, yPos)
    doc.setFont("Poppins", "normal")
    doc.setTextColor(...primaryColor)
    doc.text(value || "-", x + labelWidth, yPos)
  }

  function addFooter() {
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFont("Poppins", "normal")
      doc.setFontSize(7)
      doc.setTextColor(...mediumGray)
      doc.text(
        `${data.code} - ${data.name} | ${data.revision}`,
        margin,
        pageHeight - 8
      )
      doc.text(
        `Sayfa ${i} / ${totalPages}`,
        pageWidth - margin,
        pageHeight - 8,
        { align: "right" }
      )
      doc.text(
        `Oluşturulma: ${fmtDate(new Date().toISOString())}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: "center" }
      )
    }
  }

  // ========== HEADER ==========
  try {
    doc.addImage(IleriGroupLogo, "PNG", margin, yPos, 30, 12)
  } catch {
    doc.setFont("Poppins", "bold")
    doc.setFontSize(12)
    doc.setTextColor(...primaryColor)
    doc.text("ILERI GROUP", margin, yPos + 8)
  }

  doc.setFont("Poppins", "bold")
  doc.setFontSize(14)
  doc.setTextColor(...primaryColor)
  doc.text("MALİYET ANALİZİ RAPORU", pageWidth / 2, yPos + 5, { align: "center" })

  doc.setFont("Poppins", "normal")
  doc.setFontSize(9)
  doc.setTextColor(...mediumGray)
  doc.text(`${data.code} - ${data.revision}`, pageWidth / 2, yPos + 10, { align: "center" })

  // Status badge
  const statusText = statusLabels[data.status] || data.status
  doc.setFont("Poppins", "semibold")
  doc.setFontSize(9)
  doc.setTextColor(...accentColor)
  doc.text(statusText, pageWidth - margin, yPos + 5, { align: "right" })

  doc.setFont("Poppins", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...mediumGray)
  doc.text(fmtDate(data.updatedAt), pageWidth - margin, yPos + 10, { align: "right" })

  yPos += 16

  // Separator line
  doc.setDrawColor(...accentColor)
  doc.setLineWidth(0.4)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 6

  // ========== ANALYSIS INFO ==========
  drawSectionHeader("ANALİZ BİLGİLERİ")

  // Two columns
  drawInfoRow("Ürün Kodu", data.code, margin + 2, 28)
  drawInfoRow("Ürün Adı", data.name, contentWidth / 2 + margin, 28)
  yPos += 5

  drawInfoRow("Müşteri", data.customerName || "-", margin + 2, 28)
  drawInfoRow("Kategori", data.categoryName || "-", contentWidth / 2 + margin, 28)
  yPos += 5

  drawInfoRow("Bitmiş Ağırlık", `${fmtNumber(data.finishedWeight, 2)} kg`, margin + 2, 28)
  drawInfoRow("Para Birimi", `${data.currency} (${currencySymbols[data.currency] || data.currency})`, contentWidth / 2 + margin, 28)
  yPos += 5

  if (data.description) {
    drawInfoRow("Açıklama", data.description, margin + 2, 28)
    yPos += 5
  }

  drawInfoRow("Hazırlayan", data.createdByName || "-", margin + 2, 28)
  drawInfoRow("Oluşturma Tarihi", fmtDate(data.createdAt), contentWidth / 2 + margin, 28)
  yPos += 8

  // ========== MATERIALS ==========
  if (data.materials.length > 0) {
    drawSectionHeader("MALZEME MALİYETLERİ")

    const matData = data.materials.map((m, i) => [
      String(i + 1),
      m.materialCode || "-",
      m.name,
      materialCategoryLabels[m.category] || m.category,
      m.unit,
      fmtNumber(m.grossQuantity, 3),
      `%${fmtNumber(m.wasteRate, 1)}`,
      fmtNumber(m.netQuantity, 3),
      fmtCurrency(m.unitPrice, data.currency),
      fmtCurrency(m.totalPrice, data.currency),
      m.supplierName || "-",
    ])

    autoTable(doc, {
      startY: yPos,
      head: [["No", "Kod", "Malzeme Adı", "Kategori", "Birim", "Brüt Miktar", "Fire %", "Net Miktar", "Birim Fiyat", "Toplam", "Tedarikçi"]],
      body: matData,
      margin: { left: margin, right: margin },
      styles: {
        font: "Poppins",
        fontSize: 7,
        cellPadding: 2,
        textColor: darkGray,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: accentColor,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7,
      },
      alternateRowStyles: { fillColor: lightGray },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 18 },
        2: { cellWidth: 40 },
        3: { cellWidth: 22 },
        4: { cellWidth: 12, halign: "center" },
        5: { cellWidth: 18, halign: "right" },
        6: { cellWidth: 14, halign: "center" },
        7: { cellWidth: 18, halign: "right" },
        8: { cellWidth: 22, halign: "right" },
        9: { cellWidth: 24, halign: "right" },
        10: { cellWidth: "auto" },
      },
      foot: [[
        "", "", "", "", "", "", "", "",
        { content: "Toplam:", styles: { fontStyle: "bold", halign: "right" as const } },
        { content: fmtCurrency(data.materialCost, data.currency), styles: { fontStyle: "bold", halign: "right" as const } },
        "",
      ]],
      footStyles: {
        fillColor: [230, 240, 250],
        textColor: primaryColor,
        fontStyle: "bold",
        fontSize: 7,
      },
    })

    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  }

  // ========== LABOR ==========
  if (data.laborItems.length > 0) {
    drawSectionHeader("İŞÇİLİK MALİYETLERİ")

    const laborData = data.laborItems.map((l, i) => [
      String(i + 1),
      l.operationCode || "-",
      l.operationName,
      l.machineName || "-",
      laborTypeLabels[l.laborType] || l.laborType,
      fmtNumber(l.setupTime, 2),
      fmtNumber(l.processTime, 2),
      fmtNumber(l.totalTime, 2),
      fmtCurrency(l.hourlyRate, data.currency),
      fmtCurrency(l.totalCost, data.currency),
    ])

    autoTable(doc, {
      startY: yPos,
      head: [["No", "Kod", "Operasyon", "Makine", "Tip", "Hazırlık (sa)", "İşlem (sa)", "Toplam (sa)", "Saat Ücreti", "Toplam Maliyet"]],
      body: laborData,
      margin: { left: margin, right: margin },
      styles: {
        font: "Poppins",
        fontSize: 7,
        cellPadding: 2,
        textColor: darkGray,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: accentColor,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7,
      },
      alternateRowStyles: { fillColor: lightGray },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 18 },
        2: { cellWidth: 45 },
        3: { cellWidth: 35 },
        4: { cellWidth: 22 },
        5: { cellWidth: 22, halign: "right" },
        6: { cellWidth: 22, halign: "right" },
        7: { cellWidth: 22, halign: "right" },
        8: { cellWidth: 25, halign: "right" },
        9: { cellWidth: "auto", halign: "right" },
      },
      foot: [[
        "", "", "", "", "", "", "", "",
        { content: "Toplam:", styles: { fontStyle: "bold", halign: "right" as const } },
        { content: fmtCurrency(data.laborCost, data.currency), styles: { fontStyle: "bold", halign: "right" as const } },
      ]],
      footStyles: {
        fillColor: [230, 240, 250],
        textColor: primaryColor,
        fontStyle: "bold",
        fontSize: 7,
      },
    })

    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  }

  // ========== EXTERNAL SERVICES ==========
  if (data.externalServices.length > 0) {
    drawSectionHeader("DIŞ HİZMET MALİYETLERİ")

    const extData = data.externalServices.map((s, i) => [
      String(i + 1),
      s.serviceCode || "-",
      s.serviceName,
      serviceTypeLabels[s.serviceType] || s.serviceType,
      fmtNumber(s.quantity, 2),
      s.unit,
      fmtCurrency(s.unitPrice, data.currency),
      fmtCurrency(s.totalPrice, data.currency),
      s.supplierName || "-",
    ])

    autoTable(doc, {
      startY: yPos,
      head: [["No", "Kod", "Hizmet Adı", "Tip", "Miktar", "Birim", "Birim Fiyat", "Toplam", "Tedarikçi"]],
      body: extData,
      margin: { left: margin, right: margin },
      styles: {
        font: "Poppins",
        fontSize: 7,
        cellPadding: 2,
        textColor: darkGray,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: accentColor,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7,
      },
      alternateRowStyles: { fillColor: lightGray },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 18 },
        2: { cellWidth: 50 },
        3: { cellWidth: 28 },
        4: { cellWidth: 18, halign: "right" },
        5: { cellWidth: 15, halign: "center" },
        6: { cellWidth: 28, halign: "right" },
        7: { cellWidth: 28, halign: "right" },
        8: { cellWidth: "auto" },
      },
      foot: [[
        "", "", "", "", "", "",
        { content: "Toplam:", styles: { fontStyle: "bold", halign: "right" as const } },
        { content: fmtCurrency(data.externalCost, data.currency), styles: { fontStyle: "bold", halign: "right" as const } },
        "",
      ]],
      footStyles: {
        fillColor: [230, 240, 250],
        textColor: primaryColor,
        fontStyle: "bold",
        fontSize: 7,
      },
    })

    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  }

  // ========== OTHER COSTS ==========
  if (data.otherCosts.length > 0) {
    drawSectionHeader("DİĞER MALİYETLER")

    const otherData = data.otherCosts.map((o, i) => [
      String(i + 1),
      o.name,
      otherCostCategoryLabels[o.category] || o.category,
      o.description || "-",
      fmtNumber(o.quantity, 2),
      fmtCurrency(o.unitPrice, data.currency),
      fmtCurrency(o.totalPrice, data.currency),
    ])

    autoTable(doc, {
      startY: yPos,
      head: [["No", "Kalem Adı", "Kategori", "Açıklama", "Miktar", "Birim Fiyat", "Toplam"]],
      body: otherData,
      margin: { left: margin, right: margin },
      styles: {
        font: "Poppins",
        fontSize: 7,
        cellPadding: 2,
        textColor: darkGray,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: accentColor,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7,
      },
      alternateRowStyles: { fillColor: lightGray },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 45 },
        2: { cellWidth: 35 },
        3: { cellWidth: "auto" },
        4: { cellWidth: 18, halign: "right" },
        5: { cellWidth: 28, halign: "right" },
        6: { cellWidth: 28, halign: "right" },
      },
      foot: [[
        "", "", "", "",
        { content: "Toplam:", styles: { fontStyle: "bold", halign: "right" as const } },
        "",
        { content: fmtCurrency(data.otherCost, data.currency), styles: { fontStyle: "bold", halign: "right" as const } },
      ]],
      footStyles: {
        fillColor: [230, 240, 250],
        textColor: primaryColor,
        fontStyle: "bold",
        fontSize: 7,
      },
    })

    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  }

  // ========== COST SUMMARY ==========
  drawSectionHeader("MALİYET ÖZETİ")

  const cur = data.currency
  const summaryData = [
    ["Malzeme Maliyeti", fmtCurrency(data.materialCost, cur)],
    ["İşçilik Maliyeti", fmtCurrency(data.laborCost, cur)],
    ["Dış Hizmet Maliyeti", fmtCurrency(data.externalCost, cur)],
    ["Diğer Maliyetler", fmtCurrency(data.otherCost, cur)],
    ["Ara Toplam", fmtCurrency(data.subtotal, cur)],
    [`İşletme Gideri (%${fmtNumber(data.overheadRate, 1)})`, fmtCurrency(data.overheadAmount, cur)],
    ["Toplam Maliyet", fmtCurrency(data.totalCost, cur)],
    [`Kar (%${fmtNumber(data.profitRate, 1)})`, fmtCurrency(data.profitAmount, cur)],
    ["Satış Fiyatı", fmtCurrency(data.salesPrice, cur)],
  ]

  autoTable(doc, {
    startY: yPos,
    body: summaryData,
    margin: { left: margin + contentWidth * 0.55, right: margin },
    styles: {
      font: "Poppins",
      fontSize: 8,
      cellPadding: 3,
      textColor: darkGray,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: "auto" },
      1: { halign: "right", cellWidth: 40 },
    },
    didParseCell: function (hookData) {
      const rowIndex = hookData.row.index
      // Ara Toplam row
      if (rowIndex === 4) {
        hookData.cell.styles.fillColor = [230, 240, 250]
        hookData.cell.styles.fontStyle = "bold"
      }
      // Toplam Maliyet row
      if (rowIndex === 6) {
        hookData.cell.styles.fillColor = [230, 240, 250]
        hookData.cell.styles.fontStyle = "bold"
      }
      // Satış Fiyatı row
      if (rowIndex === 8) {
        hookData.cell.styles.fillColor = primaryColor as unknown as [number, number, number]
        hookData.cell.styles.textColor = [255, 255, 255]
        hookData.cell.styles.fontStyle = "bold"
        hookData.cell.styles.fontSize = 9
      }
    },
  })

  // Unit prices box (left side)
  const summaryStartY = yPos
  doc.setFillColor(245, 247, 250)
  doc.roundedRect(margin, summaryStartY, contentWidth * 0.5, 35, 2, 2, "F")

  doc.setFont("Poppins", "bold")
  doc.setFontSize(9)
  doc.setTextColor(...primaryColor)
  doc.text("BİRİM FİYATLAR", margin + 5, summaryStartY + 7)

  doc.setFont("Poppins", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...darkGray)
  doc.text(`Bitmiş Ağırlık: ${fmtNumber(data.finishedWeight, 2)} kg`, margin + 5, summaryStartY + 14)

  const costPerKg = data.finishedWeight > 0 ? data.totalCost / data.finishedWeight : 0
  doc.text(`kg Başına Maliyet: ${fmtCurrency(costPerKg, cur)}`, margin + 5, summaryStartY + 20)

  doc.setFont("Poppins", "bold")
  doc.setFontSize(10)
  doc.setTextColor(...tealColor)
  doc.text(`kg Başına Fiyat: ${fmtCurrency(data.pricePerKg, cur)}`, margin + 5, summaryStartY + 28)

  yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // ========== FOOTER ==========
  addFooter()

  return Buffer.from(doc.output("arraybuffer"))
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import * as QRCode from "qrcode"
import { requireSession } from "@/lib/auth/require-session"

// GET - Onay bilgisi ve QR kod eklenmiş PDF'i indir
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-qdms: requireSession (basit auth gate)
    const { error } = await requireSession()
    if (error) return error

    const { id } = await params

    // Dokümanı ve onay bilgilerini getir
    const document = await prisma.qdmsDocument.findUnique({
      where: { id },
      include: {
        approvals: {
          where: { status: "APPROVED" },
          include: {
            approver: {
              select: { name: true, email: true },
            },
          },
          orderBy: { actionDate: "desc" },
          take: 1,
        },
      },
    })

    if (!document) {
      return NextResponse.json({ message: "Doküman bulunamadı" }, { status: 404 })
    }

    // Sadece yayınlanmış dokümanlar için imzalı PDF oluştur
    if (document.status !== "PUBLISHED") {
      return NextResponse.json(
        { message: "Sadece yayınlanmış dokümanlar için imzalı PDF oluşturulabilir" },
        { status: 400 }
      )
    }

    const approval = document.approvals[0]
    if (!approval || !approval.verificationCode) {
      return NextResponse.json(
        { message: "Bu doküman için dijital imza bilgisi bulunamadı" },
        { status: 400 }
      )
    }

    if (!document.fileName || !document.mimeType?.includes("pdf")) {
      return NextResponse.json(
        { message: "Bu doküman PDF formatında değil" },
        { status: 400 }
      )
    }

    // Orijinal PDF dosyasını bul ve oku
    const uploadDir = path.join(process.cwd(), "uploads", "qdms", "documents")
    const files = await import("fs/promises").then((fs) => fs.readdir(uploadDir))
    const matchingFile = files.find((f) => f.startsWith(document.documentNumber))

    if (!matchingFile) {
      return NextResponse.json({ message: "PDF dosyası bulunamadı" }, { status: 404 })
    }

    const filePath = path.join(uploadDir, matchingFile)
    if (!existsSync(filePath)) {
      return NextResponse.json({ message: "PDF dosyası bulunamadı" }, { status: 404 })
    }

    const originalPdfBytes = await readFile(filePath)

    // PDF'i yükle
    const pdfDoc = await PDFDocument.load(originalPdfBytes)
    const pages = pdfDoc.getPages()
    const firstPage = pages[0]
    const { width, height } = firstPage.getSize()

    // Font yükle
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    // QR kod oluştur
    const baseUrl = process.env.NEXTAUTH_URL || "https://ilerihub.ilerigroup.com"
    const verificationUrl = `${baseUrl}/verify/${approval.verificationCode}`
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 80,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })

    // QR kod resmini PDF'e ekle
    const qrImageBytes = Buffer.from(qrCodeDataUrl.split(",")[1], "base64")
    const qrImage = await pdfDoc.embedPng(qrImageBytes)

    // Onay bilgi kutusu boyutları
    const boxWidth = 220
    const boxHeight = 100
    const boxX = width - boxWidth - 20
    const boxY = 20
    const padding = 8

    // Beyaz arka plan kutusu çiz
    firstPage.drawRectangle({
      x: boxX,
      y: boxY,
      width: boxWidth,
      height: boxHeight,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.2, 0.4, 0.8),
      borderWidth: 1,
    })

    // QR kodu ekle
    const qrSize = 60
    firstPage.drawImage(qrImage, {
      x: boxX + padding,
      y: boxY + boxHeight - qrSize - padding,
      width: qrSize,
      height: qrSize,
    })

    // Onay bilgileri
    const textX = boxX + qrSize + padding + 8
    let textY = boxY + boxHeight - padding - 10

    // Başlık
    firstPage.drawText("Dijital Onay", {
      x: textX,
      y: textY,
      size: 9,
      font: boldFont,
      color: rgb(0.2, 0.4, 0.8),
    })
    textY -= 14

    // Onaylayan
    const approverName = approval.approver.name || approval.approver.email
    firstPage.drawText(truncateText(approverName, 18), {
      x: textX,
      y: textY,
      size: 7,
      font: font,
      color: rgb(0, 0, 0),
    })
    textY -= 10

    // Tarih ve Saat
    const signedDate = approval.signatureTimestamp || approval.actionDate
    let dateStr = "-"
    let timeStr = "-"
    if (signedDate) {
      const d = new Date(signedDate)
      // UTC+3 Türkiye saati için düzeltme
      const turkeyOffset = 3 * 60 * 60 * 1000
      const turkeyDate = new Date(d.getTime() + turkeyOffset)

      const day = String(turkeyDate.getUTCDate()).padStart(2, "0")
      const month = String(turkeyDate.getUTCMonth() + 1).padStart(2, "0")
      const year = turkeyDate.getUTCFullYear()
      dateStr = `${day}.${month}.${year}`

      const hours = String(turkeyDate.getUTCHours()).padStart(2, "0")
      const minutes = String(turkeyDate.getUTCMinutes()).padStart(2, "0")
      timeStr = `${hours}:${minutes}`
    }

    firstPage.drawText(`Tarih: ${dateStr}`, {
      x: textX,
      y: textY,
      size: 7,
      font: font,
      color: rgb(0, 0, 0),
    })
    textY -= 10

    firstPage.drawText(`Saat: ${timeStr}`, {
      x: textX,
      y: textY,
      size: 7,
      font: font,
      color: rgb(0, 0, 0),
    })

    // Alt kısımda hash (kısa versiyon)
    const shortHash = approval.signatureHash
      ? approval.signatureHash.substring(0, 16) + "..."
      : ""
    firstPage.drawText(shortHash, {
      x: boxX + padding,
      y: boxY + padding,
      size: 5,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    })

    // "Doğrula" metni
    firstPage.drawText("QR ile dogrula", {
      x: boxX + padding,
      y: boxY + padding + 10,
      size: 6,
      font: font,
      color: rgb(0.3, 0.3, 0.3),
    })

    // PDF'i kaydet
    const signedPdfBytes = await pdfDoc.save()

    // Response headers
    const headers = new Headers()
    headers.set("Content-Type", "application/pdf")
    headers.set("Content-Length", String(signedPdfBytes.length))

    const signedFileName = document.fileName.replace(".pdf", "_imzali.pdf")
    headers.set(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(signedFileName)}"`
    )

    return new NextResponse(Buffer.from(signedPdfBytes), {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error("İmzalı PDF oluşturma hatası:", error)
    return NextResponse.json(
      { message: "İmzalı PDF oluşturulurken hata oluştu" },
      { status: 500 }
    )
  }
}

// Metni belirli uzunlukta kes
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + "..."
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { requireSession } from "@/lib/auth/require-session"

// Egitim icerigini (PDF) yukle
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-B: requireSession
    const { error } = await requireSession()
    if (error) return error

    const { id: trainingId } = await params

    // Egitimi kontrol et
    const training = await prisma.iso27001Training.findUnique({
      where: { id: trainingId },
      select: { id: true, title: true, trainingNumber: true },
    })

    if (!training) {
      return NextResponse.json({ error: "Egitim bulunamadi" }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "Dosya secilmedi" }, { status: 400 })
    }

    // Sadece PDF kabul et
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Sadece PDF dosyalari kabul edilir" },
        { status: 400 }
      )
    }

    // Dosya boyutu kontrolu (max 50MB)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Dosya boyutu 50MB'dan buyuk olamaz" },
        { status: 400 }
      )
    }

    // Dosya kayit dizini
    const uploadDir = path.join(process.cwd(), "public", "trainings")
    await mkdir(uploadDir, { recursive: true })

    // Dosya adi: training-id-timestamp.pdf
    const fileName = `${trainingId}-${Date.now()}.pdf`
    const filePath = path.join(uploadDir, fileName)

    // Dosyayi kaydet
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // URL olustur
    const contentUrl = `/trainings/${fileName}`

    // Egitimi guncelle
    const updated = await prisma.iso27001Training.update({
      where: { id: trainingId },
      data: {
        contentUrl,
        contentType: "PDF",
        isOnline: true,
      },
      select: {
        id: true,
        title: true,
        contentUrl: true,
        contentType: true,
        isOnline: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Egitim icerigi yuklendi",
      training: updated,
    })
  } catch (error) {
    console.error("Icerik yukleme hatasi:", error)
    return NextResponse.json(
      { error: "Icerik yuklenemedi" },
      { status: 500 }
    )
  }
}

// Egitim icerigini sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-B: requireSession
    const { error } = await requireSession()
    if (error) return error

    const { id: trainingId } = await params

    // Egitimi guncelle - icerigi kaldir
    await prisma.iso27001Training.update({
      where: { id: trainingId },
      data: {
        contentUrl: null,
        contentType: null,
        isOnline: false,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Egitim icerigi silindi",
    })
  } catch (error) {
    console.error("Icerik silme hatasi:", error)
    return NextResponse.json(
      { error: "Icerik silinemedi" },
      { status: 500 }
    )
  }
}

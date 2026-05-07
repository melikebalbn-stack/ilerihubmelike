import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth/require-session"

// Tek egitim getir
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-B: requireSession
    const { error } = await requireSession()
    if (error) return error

    const { id } = await params

    const training = await prisma.iso27001Training.findUnique({
      where: { id },
      include: {
        participants: true,
      },
    })

    if (!training) {
      return NextResponse.json({ error: "Egitim bulunamadi" }, { status: 404 })
    }

    return NextResponse.json(training)
  } catch (error) {
    console.error("Egitim getirme hatasi:", error)
    return NextResponse.json(
      { error: "Egitim alinamadi" },
      { status: 500 }
    )
  }
}

// Egitim guncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-B: requireSession
    const { error } = await requireSession()
    if (error) return error

    const { id } = await params
    const body = await request.json()
    const {
      title,
      description,
      trainingType,
      duration,
      location,
      trainerName,
      trainerTitle,
      trainingDate,
      controlId,
      status,
      documentUrl,
      signatureUrl,
    } = body
    // PR-Y2.5: input boundary normalization
    const trainerEmail = body.trainerEmail !== undefined
      ? (typeof body.trainerEmail === 'string' && body.trainerEmail.trim() !== '' ? body.trainerEmail.toLowerCase() : null)
      : undefined

    const training = await prisma.iso27001Training.update({
      where: { id },
      data: {
        title,
        description,
        trainingType,
        duration,
        location,
        trainerName,
        trainerTitle,
        trainerEmail,
        trainingDate: trainingDate ? new Date(trainingDate) : undefined,
        controlId,
        status,
        documentUrl,
        signatureUrl,
      },
      include: {
        participants: true,
      },
    })

    return NextResponse.json({
      success: true,
      training,
      message: "Egitim guncellendi",
    })
  } catch (error) {
    console.error("Egitim guncelleme hatasi:", error)
    return NextResponse.json(
      { error: "Egitim guncellenemedi" },
      { status: 500 }
    )
  }
}

// Egitim sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-B: requireSession
    const { error } = await requireSession()
    if (error) return error

    const { id } = await params

    await prisma.iso27001Training.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: "Egitim silindi",
    })
  } catch (error) {
    console.error("Egitim silme hatasi:", error)
    return NextResponse.json(
      { error: "Egitim silinemedi" },
      { status: 500 }
    )
  }
}

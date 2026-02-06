import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { validatePinStrength, hashPin, verifyPin } from "@/lib/pin-utils"

// GET - PIN durumunu kontrol et (hash'i döndürmeden)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { signaturePin: true },
    })

    return NextResponse.json({
      hasPinSet: !!user?.signaturePin,
    })
  } catch (error) {
    console.error("PIN durumu kontrolü hatası:", error)
    return NextResponse.json(
      { error: "Bir hata oluştu" },
      { status: 500 }
    )
  }
}

// POST - Yeni PIN ayarla veya güncelle
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
    }

    const body = await request.json()
    const { currentPin, newPin } = body

    if (!newPin) {
      return NextResponse.json(
        { error: "Yeni PIN zorunludur" },
        { status: 400 }
      )
    }

    // Yeni PIN güçlülük kontrolü
    const validation = validatePinStrength(newPin)
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Mevcut kullanıcıyı al
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, signaturePin: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: "Kullanıcı bulunamadı" },
        { status: 404 }
      )
    }

    // Eğer mevcut PIN varsa, doğrulanmalı
    if (user.signaturePin) {
      if (!currentPin) {
        return NextResponse.json(
          { error: "Mevcut PIN zorunludur" },
          { status: 400 }
        )
      }

      const isCurrentValid = await verifyPin(currentPin, user.signaturePin)
      if (!isCurrentValid) {
        return NextResponse.json(
          { error: "Mevcut PIN hatalı" },
          { status: 401 }
        )
      }
    }

    // Yeni PIN'i hash'le ve kaydet
    const hashedPin = await hashPin(newPin)

    await prisma.user.update({
      where: { id: user.id },
      data: { signaturePin: hashedPin },
    })

    return NextResponse.json({
      success: true,
      message: user.signaturePin
        ? "İmza PIN'iniz güncellendi"
        : "İmza PIN'iniz oluşturuldu",
    })
  } catch (error) {
    console.error("PIN ayarlama hatası:", error)
    return NextResponse.json(
      { error: "Bir hata oluştu" },
      { status: 500 }
    )
  }
}

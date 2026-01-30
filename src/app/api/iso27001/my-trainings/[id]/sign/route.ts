import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import bcrypt from "bcryptjs"

// Dijital imza ile egitimi onayla
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const { id: trainingId } = await params
    const body = await request.json()
    const { password, confirmation } = body

    if (!password) {
      return NextResponse.json(
        { error: "Imza icin sifre zorunludur" },
        { status: 400 }
      )
    }

    if (!confirmation) {
      return NextResponse.json(
        { error: "Onay metni zorunludur" },
        { status: 400 }
      )
    }

    // Kullanici bilgilerini al
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true },
    })

    if (!user) {
      return NextResponse.json({ error: "Kullanici bulunamadi" }, { status: 404 })
    }

    // Egitim atamasini kontrol et
    const assignment = await prisma.iso27001TrainingAssignment.findUnique({
      where: {
        trainingId_userId: {
          trainingId,
          userId: user.id,
        },
      },
      include: {
        training: {
          select: { title: true, hasQuiz: true, minViewTime: true },
        },
      },
    })

    if (!assignment) {
      return NextResponse.json({ error: "Egitim atamasi bulunamadi" }, { status: 404 })
    }

    // Zaten imzalanmis mi kontrol et
    if (assignment.signedAt) {
      return NextResponse.json(
        { error: "Egitim zaten imzalanmis" },
        { status: 400 }
      )
    }

    // Egitim tamamlanmis olmali (COMPLETED veya SIGNED durumunda olabilir)
    if (assignment.status !== "COMPLETED" && assignment.status !== "SIGNED") {
      return NextResponse.json(
        { error: "Egitim henuz tamamlanmadi" },
        { status: 400 }
      )
    }

    // Sifre dogrulama - Azure AD kullanicilari icin
    // Kullanici zaten Azure AD ile giris yapmis durumda
    // Imza icin basit bir PIN kontrolu yapiyoruz (4 haneli sayi veya "ONAY" kelimesi)
    // Bu, kullanicinin bilinçli olarak imzaladığını doğrulamak içindir
    const validPins = ["1234", "ONAY", "onay", "CONFIRM", "confirm"]
    const isValidPin = validPins.includes(password) || /^\d{4}$/.test(password)

    if (!isValidPin) {
      return NextResponse.json(
        { error: "Lutfen 4 haneli PIN veya 'ONAY' yazin." },
        { status: 401 }
      )
    }

    // Dijital imza hash'i olustur
    const signatureData = JSON.stringify({
      trainingId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      confirmation,
      timestamp: new Date().toISOString(),
    })

    const signatureHash = crypto
      .createHash("sha256")
      .update(signatureData + process.env.NEXTAUTH_SECRET)
      .digest("hex")

    // IP ve cihaz bilgisi
    const forwardedFor = request.headers.get("x-forwarded-for")
    const realIp = request.headers.get("x-real-ip")
    const signatureIp = forwardedFor?.split(",")[0] || realIp || "unknown"
    const signatureDevice = request.headers.get("user-agent") || "unknown"

    // Imzayi kaydet
    const updated = await prisma.iso27001TrainingAssignment.update({
      where: {
        trainingId_userId: {
          trainingId,
          userId: user.id,
        },
      },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
        signatureHash,
        signatureIp,
        signatureDevice: signatureDevice.substring(0, 255),
      },
      include: {
        training: {
          select: { title: true, trainingNumber: true },
        },
      },
    })

    // Basarili imza bildirimi
    try {
      await prisma.notification.create({
        data: {
          userId: user.id,
          title: "Egitim Tamamlandi",
          message: `"${updated.training.title}" egitimini basariyla tamamladiniz ve imzaladiniz.`,
          type: "SUCCESS",
          link: `/my-trainings`,
        },
      })
    } catch (e) {
      console.error("Bildirim gonderilemedi:", e)
    }

    return NextResponse.json({
      success: true,
      message: "Egitim basariyla imzalandi",
      assignment: {
        id: updated.id,
        status: updated.status,
        signedAt: updated.signedAt,
        training: updated.training,
      },
      signature: {
        hash: signatureHash.substring(0, 16) + "...", // Kisaltilmis goster
        timestamp: updated.signedAt,
        ip: signatureIp,
      },
    })
  } catch (error) {
    console.error("Dijital imza hatasi:", error)
    return NextResponse.json(
      { error: "Imza atilamadi" },
      { status: 500 }
    )
  }
}

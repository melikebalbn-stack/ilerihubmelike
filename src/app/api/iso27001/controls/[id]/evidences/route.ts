import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { existsSync } from "fs"
import { requireSession } from "@/lib/auth/require-session"
// NOT: getServerSession import'u POST handler'ında debug-amaçlı optional auth
// için korundu (system fallback). Auth gate eklemek ayrı PR (PR-ISO27001-SECURITY).

// Route segment config - dosya yüklemeleri için
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 dakika timeout (büyük dosyalar için)

// Kontrole bağlı kanıtları getir
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-A: requireSession
    const { error } = await requireSession()
    if (error) return error

    const { id } = await params

    // Kontrolü bul (controlId veya id olabilir)
    const control = await prisma.iso27001Control.findFirst({
      where: {
        OR: [{ id }, { controlId: id }],
      },
      select: {
        id: true,
        controlId: true,
        evidences: {
          select: {
            id: true,
            title: true,
            description: true,
            evidenceType: true,
            fileName: true,
            fileUrl: true,
            fileType: true,
            referenceUrl: true,
            referenceNote: true,
            evidenceDate: true,
            validUntil: true,
          },
          orderBy: { evidenceDate: "desc" },
        },
      },
    })

    if (!control) {
      return NextResponse.json({ error: "Kontrol bulunamadi" }, { status: 404 })
    }

    return NextResponse.json({
      controlId: control.controlId,
      evidences: control.evidences,
    })
  } catch (error) {
    console.error("Kontrol kanitlari hatasi:", error)
    return NextResponse.json(
      { error: "Kanitlar alinamadi" },
      { status: 500 }
    )
  }
}

// Kontrole kanıt ekle (dosya yüklemeli)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log("[Evidence Upload] POST request received")

    // Oturum kontrolü - geçici olarak devre dışı (debug için)
    let userEmail = "system@ilerihub.com"
    let userName = "Sistem"
    try {
      const session = await getServerSession(authOptions)
      if (session?.user?.email) {
        userEmail = session.user.email
        userName = session.user.name || session.user.email
        console.log("[Evidence Upload] User:", userEmail)
      } else {
        console.log("[Evidence Upload] No session, using system user")
      }
    } catch (e) {
      console.log("[Evidence Upload] Session error:", e)
    }

    const { id } = await params
    console.log("[Evidence Upload] Control ID:", id)

    const formData = await request.formData()
    console.log("[Evidence Upload] FormData received")

    const title = formData.get("title") as string
    const description = formData.get("description") as string | null
    const evidenceType = formData.get("evidenceType") as string
    const referenceUrl = formData.get("referenceUrl") as string | null
    const referenceNote = formData.get("referenceNote") as string | null
    const file = formData.get("file") as File | null

    console.log("[Evidence Upload] Title:", title)
    console.log("[Evidence Upload] Type:", evidenceType)
    console.log("[Evidence Upload] File:", file ? `${file.name} (${file.size} bytes)` : "none")

    if (!title || !evidenceType) {
      console.log("[Evidence Upload] Missing title or type")
      return NextResponse.json(
        { error: "Baslik ve kanit tipi zorunludur" },
        { status: 400 }
      )
    }

    // Kontrolü bul
    const control = await prisma.iso27001Control.findFirst({
      where: {
        OR: [{ id }, { controlId: id }],
      },
      select: { id: true, controlId: true },
    })

    if (!control) {
      console.log("[Evidence Upload] Control not found:", id)
      return NextResponse.json({ error: "Kontrol bulunamadi" }, { status: 404 })
    }
    console.log("[Evidence Upload] Found control:", control.controlId)

    let fileName: string | null = null
    let fileUrl: string | null = null
    let fileType: string | null = null

    // Dosya varsa yükle
    if (file && file.size > 0) {
      // Dosya boyutu kontrolü (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Dosya boyutu 50MB'dan kucuk olmali" },
          { status: 400 }
        )
      }

      // Upload klasörünü oluştur
      const uploadDir = path.join(process.cwd(), "public", "uploads", "evidences")
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true })
      }

      // Yıl/ay bazlı alt klasör
      const now = new Date()
      const yearMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`
      const targetDir = path.join(uploadDir, yearMonth)
      if (!existsSync(targetDir)) {
        await mkdir(targetDir, { recursive: true })
      }

      // Güvenli dosya adı oluştur
      const timestamp = Date.now()
      const randomSuffix = Math.random().toString(36).substring(2, 8)
      const ext = path.extname(file.name)
      const baseName = path.basename(file.name, ext)
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .substring(0, 50)
      const safeFileName = `${baseName}_${timestamp}_${randomSuffix}${ext}`

      // Dosyayı kaydet
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const filePath = path.join(targetDir, safeFileName)
      await writeFile(filePath, buffer)
      console.log("[Evidence Upload] File saved:", filePath)

      fileName = file.name
      fileUrl = `/uploads/evidences/${yearMonth}/${safeFileName}`
      fileType = file.type
    }

    console.log("[Evidence Upload] Creating evidence record...")
    // Kullanıcı bilgilerini al
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true, name: true },
    })

    // Kanıt kaydı oluştur
    const evidence = await prisma.iso27001Evidence.create({
      data: {
        controlId: control.id,
        title,
        description: description || null,
        evidenceType: evidenceType as any,
        fileName,
        fileUrl,
        fileType,
        referenceUrl: referenceUrl || null,
        referenceNote: referenceNote || null,
        evidenceDate: new Date(),
        uploadedById: user?.id || "system",
        uploadedByName: user?.name || userName,
      },
      select: {
        id: true,
        title: true,
        evidenceType: true,
        fileName: true,
        fileUrl: true,
        evidenceDate: true,
      },
    })

    console.log("[Evidence Upload] Evidence created successfully:", evidence.id)
    return NextResponse.json({
      success: true,
      evidence,
      message: "Kanit basariyla eklendi",
    })
  } catch (error) {
    console.error("[Evidence Upload] Error:", error)
    return NextResponse.json(
      { error: "Kanit eklenemedi" },
      { status: 500 }
    )
  }
}

// Kanıt sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-A: requireSession
    const { error } = await requireSession()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const evidenceId = searchParams.get("evidenceId")

    if (!evidenceId) {
      return NextResponse.json(
        { error: "evidenceId parametresi gerekli" },
        { status: 400 }
      )
    }

    await prisma.iso27001Evidence.delete({
      where: { id: evidenceId },
    })

    return NextResponse.json({
      success: true,
      message: "Kanit silindi",
    })
  } catch (error) {
    console.error("Kanit silme hatasi:", error)
    return NextResponse.json(
      { error: "Kanit silinemedi" },
      { status: 500 }
    )
  }
}

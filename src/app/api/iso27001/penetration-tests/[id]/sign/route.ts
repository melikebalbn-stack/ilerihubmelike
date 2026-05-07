import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { requireSession } from "@/lib/auth/require-session"
import { requireUser } from "@/lib/auth/require-user"

function generateSignatureCode(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  const random = crypto.randomBytes(4).toString("hex").toUpperCase()
  return `ILH-SIG-${year}${month}${day}-${random}`
}

// POST - Sızma testini imzala
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-C: requireUser — DB user gerek (signer)
    const { user, error } = await requireUser()
    if (error) return error

    const { id } = await params
    const body = await request.json()
    const { signatureType, notes } = body

    // Test kontrolü
    const test = await prisma.iso27001PenetrationTest.findUnique({ where: { id } })
    if (!test) {
      return NextResponse.json({ error: "Test bulunamadı" }, { status: 404 })
    }

    // Mükerrer imza kontrolü
    const existingSignature = await prisma.iso27001PenTestSignature.findFirst({
      where: {
        testId: id,
        signerEmail: user.email,
        signatureType: signatureType || "APPROVAL",
      },
    })

    if (existingSignature) {
      return NextResponse.json(
        { error: "Bu testi zaten imzalamışsınız" },
        { status: 400 }
      )
    }

    // IP ve User Agent
    const forwarded = request.headers.get("x-forwarded-for")
    const ipAddress = forwarded ? forwarded.split(",")[0] : request.headers.get("x-real-ip") || "unknown"
    const userAgent = request.headers.get("user-agent") || "unknown"

    // Test hash oluştur
    const testHash = crypto
      .createHash("sha256")
      .update(`${test.testNumber}-${test.title}-${test.testDate.toISOString()}`)
      .digest("hex")

    const signatureCode = generateSignatureCode()

    const signature = await prisma.iso27001PenTestSignature.create({
      data: {
        testId: id,
        signerId: user.id,
        signerName: user.name || user.email,
        signerEmail: user.email,
        signerTitle: user.jobTitle || null,
        signerDepartment: user.department || null,
        signatureCode,
        signedAt: new Date(),
        testHash,
        ipAddress,
        userAgent,
        signatureType: signatureType || "APPROVAL",
        notes: notes || null,
        isVerified: true,
        verifiedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, signature })
  } catch (error) {
    console.error("İmzalama hatası:", error)
    return NextResponse.json({ error: "İmzalama sırasında hata oluştu" }, { status: 500 })
  }
}

// GET - İmzaları listele
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PR-Y2.5-iso27001-C: requireSession (read-only liste)
    const { error } = await requireSession()
    if (error) return error

    const { id } = await params

    const signatures = await prisma.iso27001PenTestSignature.findMany({
      where: { testId: id },
      orderBy: { signedAt: "desc" },
    })

    return NextResponse.json(signatures)
  } catch (error) {
    console.error("İmzalar alınırken hata:", error)
    return NextResponse.json({ error: "Hata oluştu" }, { status: 500 })
  }
}

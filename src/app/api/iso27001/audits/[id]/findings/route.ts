import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Denetim bulgularını listele
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const findingType = searchParams.get("type")

    // Denetimin varlığını kontrol et
    const audit = await prisma.iso27001Audit.findUnique({
      where: { id },
      select: { id: true, auditNumber: true },
    })

    if (!audit) {
      return NextResponse.json({ error: "Denetim bulunamadi" }, { status: 404 })
    }

    const where: any = { auditId: id }

    if (status) {
      where.status = status
    }

    if (findingType) {
      where.findingType = findingType
    }

    const findings = await prisma.iso27001AuditFinding.findMany({
      where,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        findingNumber: true,
        findingType: true,
        title: true,
        description: true,
        evidence: true,
        severity: true,
        controlId: true,
        clause: true,
        correctiveAction: true,
        responsibleId: true,
        responsibleName: true,
        dueDate: true,
        completedDate: true,
        verifiedById: true,
        verifiedByName: true,
        verifiedAt: true,
        verificationNotes: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        control: {
          select: {
            controlId: true,
            title: true,
            titleTr: true,
          },
        },
      },
    })

    return NextResponse.json(findings)
  } catch (error) {
    console.error("Bulgu listesi hatasi:", error)
    return NextResponse.json(
      { error: "Bulgular alinamadi" },
      { status: 500 }
    )
  }
}

// Yeni bulgu oluştur
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Denetimin varlığını kontrol et
    const audit = await prisma.iso27001Audit.findUnique({
      where: { id },
      select: { id: true, auditNumber: true },
    })

    if (!audit) {
      return NextResponse.json({ error: "Denetim bulunamadi" }, { status: 404 })
    }

    const {
      findingType,
      title,
      description,
      evidence,
      severity,
      controlId,
      clause,
      correctiveAction,
      responsibleId,
      responsibleName,
      dueDate,
    } = body

    if (!findingType || !title || !description) {
      return NextResponse.json(
        { error: "Bulgu tipi, baslik ve aciklama zorunludur" },
        { status: 400 }
      )
    }

    // Bulgu numarası oluştur: AUD-2025-001-F01
    const lastFinding = await prisma.iso27001AuditFinding.findFirst({
      where: { auditId: id },
      orderBy: { findingNumber: "desc" },
      select: { findingNumber: true },
    })

    let nextNum = 1
    if (lastFinding) {
      const parts = lastFinding.findingNumber.split("-F")
      if (parts[1]) {
        nextNum = parseInt(parts[1]) + 1
      }
    }
    // Denetim numarasından ISO- kısmını çıkar
    const auditNumShort = audit.auditNumber.replace("ISO-", "")
    const findingNumber = `${auditNumShort}-F${String(nextNum).padStart(2, "0")}`

    const finding = await prisma.iso27001AuditFinding.create({
      data: {
        auditId: id,
        findingNumber,
        findingType,
        title,
        description,
        evidence: evidence || null,
        severity: severity || "MINOR",
        controlId: controlId || null,
        clause: clause || null,
        correctiveAction: correctiveAction || null,
        responsibleId: responsibleId || null,
        responsibleName: responsibleName || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: "OPEN",
      },
      select: {
        id: true,
        findingNumber: true,
        title: true,
        findingType: true,
        status: true,
      },
    })

    return NextResponse.json({
      success: true,
      finding,
      message: "Bulgu olusturuldu",
    })
  } catch (error) {
    console.error("Bulgu olusturma hatasi:", error)
    return NextResponse.json(
      { error: "Bulgu olusturulamadi" },
      { status: 500 }
    )
  }
}

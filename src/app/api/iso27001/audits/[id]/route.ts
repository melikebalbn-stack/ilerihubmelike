import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Tek denetim detayı
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

    const audit = await prisma.iso27001Audit.findUnique({
      where: { id },
      include: {
        teamMembers: {
          select: {
            id: true,
            memberId: true,
            memberName: true,
            memberEmail: true,
            role: true,
          },
        },
        findings: {
          select: {
            id: true,
            findingNumber: true,
            findingType: true,
            title: true,
            description: true,
            severity: true,
            status: true,
            controlId: true,
            clause: true,
            responsibleName: true,
            dueDate: true,
            completedDate: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    })

    if (!audit) {
      return NextResponse.json({ error: "Denetim bulunamadi" }, { status: 404 })
    }

    return NextResponse.json(audit)
  } catch (error) {
    console.error("Denetim detay hatasi:", error)
    return NextResponse.json(
      { error: "Denetim alinamadi" },
      { status: 500 }
    )
  }
}

// Denetim güncelle
export async function PATCH(
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

    // Mevcut denetimi kontrol et
    const existing = await prisma.iso27001Audit.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Denetim bulunamadi" }, { status: 404 })
    }

    const {
      title,
      description,
      auditType,
      scope,
      clauses,
      controls,
      plannedDate,
      startDate,
      endDate,
      leadAuditorId,
      leadAuditorName,
      leadAuditorEmail,
      auditeeId,
      auditeeName,
      auditeeEmail,
      auditeeDepartment,
      status,
      summary,
      conclusion,
    } = body

    // Sadece değişen alanları güncelle
    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description || null
    if (auditType !== undefined) updateData.auditType = auditType
    if (scope !== undefined) updateData.scope = scope || null
    if (clauses !== undefined) updateData.clauses = clauses
    if (controls !== undefined) updateData.controls = controls
    if (plannedDate !== undefined) updateData.plannedDate = new Date(plannedDate)
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null
    if (leadAuditorId !== undefined) updateData.leadAuditorId = leadAuditorId || null
    if (leadAuditorName !== undefined) updateData.leadAuditorName = leadAuditorName
    if (leadAuditorEmail !== undefined) updateData.leadAuditorEmail = leadAuditorEmail
    if (auditeeId !== undefined) updateData.auditeeId = auditeeId || null
    if (auditeeName !== undefined) updateData.auditeeName = auditeeName || null
    if (auditeeEmail !== undefined) updateData.auditeeEmail = auditeeEmail || null
    if (auditeeDepartment !== undefined) updateData.auditeeDepartment = auditeeDepartment || null
    if (status !== undefined) updateData.status = status
    if (summary !== undefined) updateData.summary = summary || null
    if (conclusion !== undefined) updateData.conclusion = conclusion || null

    const audit = await prisma.iso27001Audit.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        auditNumber: true,
        title: true,
        status: true,
      },
    })

    return NextResponse.json({
      success: true,
      audit,
      message: "Denetim guncellendi",
    })
  } catch (error) {
    console.error("Denetim guncelleme hatasi:", error)
    return NextResponse.json(
      { error: "Denetim guncellenemedi" },
      { status: 500 }
    )
  }
}

// Denetim sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const { id } = await params

    // Mevcut denetimi kontrol et
    const existing = await prisma.iso27001Audit.findUnique({
      where: { id },
      select: { id: true, auditNumber: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Denetim bulunamadi" }, { status: 404 })
    }

    // Cascade delete ile ilişkili kayıtlar da silinecek
    await prisma.iso27001Audit.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: `${existing.auditNumber} numarali denetim silindi`,
    })
  } catch (error) {
    console.error("Denetim silme hatasi:", error)
    return NextResponse.json(
      { error: "Denetim silinemedi" },
      { status: 500 }
    )
  }
}

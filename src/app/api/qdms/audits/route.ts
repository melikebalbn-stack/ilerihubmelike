import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET - Denetimleri listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: "Yetkisiz erişim" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const type = searchParams.get("type")
    const status = searchParams.get("status")

    const where: any = {}

    if (search) {
      where.OR = [
        { auditNumber: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { standard: { contains: search, mode: "insensitive" } },
      ]
    }

    if (type) {
      where.type = type
    }

    if (status) {
      where.status = status
    }

    const audits = await prisma.qdmsAudit.findMany({
      where,
      include: {
        leadAuditor: {
          select: { id: true, name: true },
        },
        department: {
          select: { id: true, name: true },
        },
      },
      orderBy: { plannedDate: "desc" },
    })

    return NextResponse.json(audits)
  } catch (error) {
    console.error("Denetim listesi hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}

// POST - Yeni denetim oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: "Yetkisiz erişim" }, { status: 401 })
    }

    const body = await request.json()
    const { title, type, standard, plannedDate, scope, description, departmentId } = body

    // Validasyon
    if (!title || !type || !plannedDate) {
      return NextResponse.json(
        { message: "Başlık, tür ve planlanan tarih zorunludur" },
        { status: 400 }
      )
    }

    // Kullanıcıyı email ile bul (session.user.id LDAP DN olabilir)
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!dbUser) {
      return NextResponse.json(
        { message: "Kullanıcı bulunamadı. Lütfen tekrar giriş yapın." },
        { status: 401 }
      )
    }

    // Denetim numarası oluştur (AUD-YYYY-XXX formatında)
    const year = new Date().getFullYear()
    const count = await prisma.qdmsAudit.count({
      where: {
        auditNumber: { startsWith: `AUD-${year}` },
      },
    })
    const auditNumber = `AUD-${year}-${String(count + 1).padStart(3, "0")}`

    // departmentId boş string ise null yap
    const validDepartmentId = departmentId && departmentId.trim() !== "" ? departmentId : null

    const audit = await prisma.qdmsAudit.create({
      data: {
        auditNumber,
        title,
        type,
        standard: standard || null,
        plannedDate: new Date(plannedDate),
        scope: scope || null,
        description: description || null,
        status: "PLANNED",
        leadAuditorId: dbUser.id,
        departmentId: validDepartmentId,
      },
      include: {
        leadAuditor: {
          select: { id: true, name: true },
        },
        department: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json(audit, { status: 201 })
  } catch (error) {
    console.error("Denetim oluşturma hatası:", error)
    return NextResponse.json({ message: "Sunucu hatası" }, { status: 500 })
  }
}

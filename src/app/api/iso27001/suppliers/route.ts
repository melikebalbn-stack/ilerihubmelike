import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Tedarikçi listesi + istatistikler
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const group = searchParams.get("group")
    const status = searchParams.get("status")
    const serviceType = searchParams.get("serviceType")
    const search = searchParams.get("search")

    const where: any = {}

    if (group) where.group = group
    if (status) where.status = status
    if (serviceType) where.serviceType = serviceType

    if (search) {
      where.companyName = { contains: search, mode: "insensitive" }
    }

    const [suppliers, total, groupCounts, lastMonthEvals] = await Promise.all([
      prisma.supplier.findMany({
        where,
        include: {
          _count: { select: { evaluations: true } },
        },
        orderBy: { companyName: "asc" },
      }),
      prisma.supplier.count(),
      prisma.supplier.groupBy({
        by: ["group"],
        _count: { _all: true },
      }),
      prisma.supplierEvaluation.count({
        where: {
          evaluationDate: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ])

    const stats = {
      total,
      aGroup: groupCounts.find((g) => g.group === "A_APPROVED")?._count._all || 0,
      bGroup: groupCounts.find((g) => g.group === "B_CANDIDATE")?._count._all || 0,
      cGroup: groupCounts.find((g) => g.group === "C_REJECTED")?._count._all || 0,
      pending: groupCounts.find((g) => g.group === "PENDING")?._count._all || 0,
      lastMonthEvals,
    }

    return NextResponse.json({ suppliers, stats })
  } catch (error) {
    console.error("Tedarikçi listesi hatası:", error)
    return NextResponse.json(
      { error: "Tedarikçiler alınamadı" },
      { status: 500 }
    )
  }
}

// Yeni tedarikçi oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    const body = await request.json()
    const {
      companyName,
      serviceType,
      contactPerson,
      phone,
      email,
      address,
      taxNumber,
      hasNDA,
      ndaDate,
      ndaExpiry,
      hasDataAccess,
      bgRiskLevel,
      notes,
    } = body

    if (!companyName || !serviceType) {
      return NextResponse.json(
        { error: "Firma adı ve hizmet türü zorunludur" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true },
    })

    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 })
    }

    const supplier = await prisma.supplier.create({
      data: {
        companyName,
        serviceType,
        contactPerson: contactPerson || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        taxNumber: taxNumber || null,
        hasNDA: hasNDA || false,
        ndaDate: ndaDate ? new Date(ndaDate) : null,
        ndaExpiry: ndaExpiry ? new Date(ndaExpiry) : null,
        hasDataAccess: hasDataAccess || false,
        bgRiskLevel: bgRiskLevel || null,
        notes: notes || null,
        group: "PENDING",
        status: "ACTIVE",
        createdById: user.id,
      },
    })

    return NextResponse.json({
      success: true,
      supplier,
    })
  } catch (error) {
    console.error("Tedarikçi oluşturma hatası:", error)
    return NextResponse.json(
      { error: "Tedarikçi oluşturulamadı" },
      { status: 500 }
    )
  }
}

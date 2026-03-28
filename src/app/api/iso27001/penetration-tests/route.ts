import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const ALLOWED_ROLES = ["IT_MANAGER", "QUALITY_MANAGER", "ADMIN", "SUPER_ADMIN"]

// GET - Tüm sızma testlerini listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const testType = searchParams.get("testType")

    const where: any = {}
    if (status && status !== "all") where.status = status
    if (testType && testType !== "all") where.testType = testType

    const [tests, stats] = await Promise.all([
      prisma.iso27001PenetrationTest.findMany({
        where,
        include: {
          _count: { select: { signatures: true } },
        },
        orderBy: { testDate: "desc" },
      }),
      prisma.iso27001PenetrationTest.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
    ])

    // İstatistikler
    const totalTests = tests.length
    const completedTests = stats.find(s => s.status === "COMPLETED")?._count.id || 0
    const approvedTests = stats.find(s => s.status === "APPROVED")?._count.id || 0
    const pendingTests = stats.find(s => s.status === "PLANNED")?._count.id || 0
    const totalCritical = tests.reduce((sum, t) => sum + t.criticalCount, 0)

    return NextResponse.json({
      tests,
      stats: {
        total: totalTests,
        completed: completedTests,
        approved: approvedTests,
        pending: pendingTests,
        totalCritical,
      },
    })
  } catch (error) {
    console.error("Sızma testleri alınırken hata:", error)
    return NextResponse.json({ error: "Sızma testleri alınırken hata oluştu" }, { status: 500 })
  }
}

// POST - Yeni sızma testi oluştur
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
    }

    const userRole = (session.user as any).role || "EMPLOYEE"
    if (!ALLOWED_ROLES.includes(userRole)) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 })
    }

    const body = await request.json()
    const {
      title, description, testDate, testType, scope, methodology, tester,
      criticalCount, highCount, mediumCount, lowCount, infoCount,
      reportFileName, reportFileUrl, reportFileSize, status,
    } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: "Başlık zorunludur" }, { status: 400 })
    }

    // Test numarası oluştur
    const year = new Date().getFullYear()
    const count = await prisma.iso27001PenetrationTest.count({
      where: { testNumber: { startsWith: `PT-${year}` } },
    })
    const testNumber = `PT-${year}-${String(count + 1).padStart(3, "0")}`

    // Kullanıcı bilgisi
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true },
    })

    const test = await prisma.iso27001PenetrationTest.create({
      data: {
        testNumber,
        title: title.trim(),
        description: description?.trim() || null,
        testDate: new Date(testDate || new Date()),
        testType: testType || "VULNERABILITY_ASSESSMENT",
        scope: scope?.trim() || null,
        methodology: methodology?.trim() || null,
        tester: tester?.trim() || session.user.name || "",
        criticalCount: parseInt(criticalCount) || 0,
        highCount: parseInt(highCount) || 0,
        mediumCount: parseInt(mediumCount) || 0,
        lowCount: parseInt(lowCount) || 0,
        infoCount: parseInt(infoCount) || 0,
        reportFileName: reportFileName || null,
        reportFileUrl: reportFileUrl || null,
        reportFileSize: reportFileSize ? parseInt(reportFileSize) : null,
        status: status || "PLANNED",
        conductedById: user?.id || null,
        conductedByName: user?.name || session.user.name || null,
      },
      include: {
        _count: { select: { signatures: true } },
      },
    })

    return NextResponse.json({ success: true, test }, { status: 201 })
  } catch (error) {
    console.error("Sızma testi oluşturulurken hata:", error)
    return NextResponse.json({ error: "Sızma testi oluşturulurken hata oluştu" }, { status: 500 })
  }
}

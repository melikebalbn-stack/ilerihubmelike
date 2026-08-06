import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { requireUser } from '@/lib/auth/require-user'
import { logAuditEvent } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

// Guard: /api/bluecollar-users GET ile birebir aynı — HR_MANAGER/ADMIN/SUPER_ADMIN.
const ALLOWED_ROLES = ['HR_MANAGER', 'ADMIN', 'SUPER_ADMIN']

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    if (!ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const filterDepartment = searchParams.get('department') || ''
    const filterServiceRoute = searchParams.get('serviceRoute') || ''
    const filterIsActive = searchParams.get('isActive') || ''
    const sortBy = searchParams.get('sortBy') || 'employeeId'
    const sortOrder = searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc'
    const validSortFields = ['employeeId', 'name', 'department', 'jobTitle', 'duty', 'section', 'serviceRoute', 'serviceStop', 'lastLoginAt', 'isActive']
    const orderBy = validSortFields.includes(sortBy)
      ? { [sortBy]: sortOrder }
      : { employeeId: 'asc' as const }

    const where: Record<string, unknown> = {
      employeeId: { not: null },
      ...(search && {
        OR: [
          { employeeId: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { department: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(filterDepartment && { department: filterDepartment }),
      ...(filterServiceRoute && { serviceRoute: filterServiceRoute }),
      ...(filterIsActive && { isActive: filterIsActive === 'true' }),
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        employeeId: true,
        name: true,
        // KVKK: tcLastFour ekranda "****" maskeli gösterilir — export'ta da maskeli.
        tcLastFour: true,
        department: true,
        jobTitle: true,
        duty: true,
        section: true,
        serviceRoute: true,
        serviceStop: true,
        lastLoginAt: true,
        isActive: true,
      },
      orderBy,
    })

    // Ekrandaki tablo sütunlarıyla birebir (TC Son 4 maskeli)
    const data = users.map((u) => ({
      'Sicil No': u.employeeId || '',
      'Ad Soyad': u.name || '',
      'TC Son 4': u.tcLastFour ? '****' : '-',
      Departman: u.department || '',
      Pozisyon: u.jobTitle || '',
      Görev: u.duty || '',
      Bölüm: u.section || '',
      Servis: u.serviceRoute || '',
      'Servis Durak': u.serviceStop || '',
      'Son Giriş': u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('tr-TR') : 'Hiç giriş yapmadı',
      Durum: u.isActive ? 'Aktif' : 'Pasif',
    }))

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Mavi Yaka Kullanicilar')
    worksheet['!cols'] = [
      { wch: 12 }, { wch: 25 }, { wch: 8 }, { wch: 20 }, { wch: 16 },
      { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 8 },
    ]

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    await logAuditEvent({
      action: 'BLUECOLLAR_USERS_EXPORTED',
      actorId: user.id,
      targetType: 'BLUECOLLAR_USER',
      details: {
        recordCount: users.length,
        filters: {
          department: filterDepartment || null,
          serviceRoute: filterServiceRoute || null,
          isActive: filterIsActive || null,
          search: search ? '<filtered>' : null,
        },
      },
    })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="mavi-yaka-kullanicilar_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Mavi yaka export hatası:', error)
    return NextResponse.json({ error: 'Excel export sırasında bir hata oluştu' }, { status: 500 })
  }
}

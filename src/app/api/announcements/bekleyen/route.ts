import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { eslesenHedefBolumler } from '@/lib/announcements/hedef'

// GET - Kullanıcının HENÜZ GÖRMEDİĞİ (AnnouncementRead kaydı olmayan) yayındaki,
// hedef kitlesine uygun, süresi dolmamış duyurular. Otomatik popup kaynağı.
// Kural: bir kez gördü VEYA onayladı → AnnouncementRead var → listeye girmez.
export async function GET() {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    const userEmail = user.email
    const userDepartment = user.department

    // Kullanıcının rol slug'ları (targetRoles Role.slug saklıyor)
    const userRoleRows = await prisma.userRole.findMany({
      where: { userId: user.id },
      select: { role: { select: { slug: true } } },
    })
    const userSlugs = userRoleRows.map((r) => r.role.slug)

    // Hedef departman eşleşmesi tam-metin DEĞİL — normalize (ek soyma) ile
    // eşleşen hedef string'leri hesaplanıp hasSome ile filtrelenir.
    const eslesenBolumler = await eslesenHedefBolumler(prisma, userDepartment)

    const announcements = await prisma.announcement.findMany({
      where: {
        AND: [
          { status: 'PUBLISHED' },
          {
            OR: [
              { targetType: 'ALL' },
              { targetType: 'DEPARTMENTS', targetDepartments: { hasSome: eslesenBolumler } },
              { targetType: 'ROLES', targetRoles: { hasSome: userSlugs } },
            ],
          },
          { OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] },
          // Görülmemiş: bu kullanıcı için hiç AnnouncementRead yok
          { reads: { none: { userEmail } } },
        ],
      },
      include: { category: true },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    })

    return NextResponse.json({ announcements })
  } catch (error) {
    console.error('Bekleyen duyurular yüklenirken hata:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/personnel-ad-reconcile
 *
 * 4 kategori:
 *  1) unlinkedUsers          : Aktif User, personnelId NULL
 *  2) unlinkedPersonnel      : Aktif Personnel, hiçbir User'a bağlı değil
 *  3) bluecollarSuggestions  : User.email = "<num>@bluecollar.ilerigroup.com"
 *                              ↔ Personnel.sicilNo = "ILR-<num>" exact eşleşme
 *  4) whitecollarSuggestions : pg_trgm fuzzy isim eşleşmesi (similarity > 0.4)
 *
 * SUPER_ADMIN-only — page redirect ile zaten korunuyor; permission de bağımsız
 * doğrulansın diye admin.users.manage check ediyoruz (it-admin'e de ileride
 * açılabilir bu rapor — sayfa-only super-admin policy'si bunun üstünde).
 */
export async function GET() {
  const { session, error } = await requireUser()
  if (error) return error
  if (!session.user.permissions?.includes('admin.users.manage')) {
    return NextResponse.json(
      { error: 'Personnel-AD reconcile için admin.users.manage yetkisi gerekli' },
      { status: 403 }
    )
  }

  // 1) Bağlanmamış aktif user'lar
  const unlinkedUsers = await prisma.user.findMany({
    where: { isActive: true, personnelId: null },
    select: {
      id: true,
      email: true,
      name: true,
      department: true,
      jobTitle: true,
    },
    orderBy: [{ email: 'asc' }],
  })

  // 2) User'sız aktif personeller
  const unlinkedPersonnel = await prisma.personnel.findMany({
    where: { aktif: true, user: null },
    select: {
      id: true,
      sicilNo: true,
      adSoyad: true,
      bolum: true,
      gorev: true,
      mailAdresi: true,
      azureAdEmail: true,
    },
    orderBy: [{ adSoyad: 'asc' }],
  })

  // 3) Bluecollar exact match: email lokali → "ILR-<lokali>"
  const bluecollarUsers = unlinkedUsers.filter((u) =>
    u.email.toLowerCase().endsWith('@bluecollar.ilerigroup.com')
  )
  const bluecollarSuggestions: Array<{
    userId: string
    userEmail: string
    userName: string | null
    personnelId: string
    personnelSicilNo: string
    personnelName: string
  }> = []
  if (bluecollarUsers.length > 0) {
    const candidateSicilNos = bluecollarUsers.map(
      (u) => `ILR-${u.email.split('@')[0]}`
    )
    const matches = await prisma.personnel.findMany({
      where: { sicilNo: { in: candidateSicilNos }, user: null },
      select: { id: true, sicilNo: true, adSoyad: true },
    })
    const bySicilNo = new Map(matches.map((p) => [p.sicilNo, p]))
    for (const u of bluecollarUsers) {
      const sicilNo = `ILR-${u.email.split('@')[0]}`
      const p = bySicilNo.get(sicilNo)
      if (p) {
        bluecollarSuggestions.push({
          userId: u.id,
          userEmail: u.email,
          userName: u.name,
          personnelId: p.id,
          personnelSicilNo: p.sicilNo,
          personnelName: p.adSoyad,
        })
      }
    }
  }

  // 4) Whitecollar fuzzy match: pg_trgm similarity > 0.4
  // Türkçe karakterleri normalize etmek için translate kullanıyoruz
  // (unaccent extension yüklü değil, manuel translate yapıyoruz).
  const whitecollarSuggestions = await prisma.$queryRaw<
    Array<{
      userId: string
      userEmail: string
      userName: string | null
      personnelId: string
      personnelSicilNo: string
      personnelName: string
      similarity: number
    }>
  >`
    SELECT
      u.id AS "userId",
      u.email AS "userEmail",
      u.name AS "userName",
      p.id AS "personnelId",
      p."sicilNo" AS "personnelSicilNo",
      p."adSoyad" AS "personnelName",
      similarity(
        translate(LOWER(u.name), 'ıİşŞğĞüÜöÖçÇ', 'iisSgGuUoOcC'),
        translate(LOWER(p."adSoyad"), 'ıİşŞğĞüÜöÖçÇ', 'iisSgGuUoOcC')
      )::float AS "similarity"
    FROM "User" u
    CROSS JOIN "Personnel" p
    WHERE u."isActive" = true
      AND u."personnelId" IS NULL
      AND u.email NOT LIKE '%@bluecollar.ilerigroup.com'
      AND u.name IS NOT NULL
      AND p.aktif = true
      AND NOT EXISTS (
        SELECT 1 FROM "User" u2 WHERE u2."personnelId" = p.id
      )
      AND similarity(
        translate(LOWER(u.name), 'ıİşŞğĞüÜöÖçÇ', 'iisSgGuUoOcC'),
        translate(LOWER(p."adSoyad"), 'ıİşŞğĞüÜöÖçÇ', 'iisSgGuUoOcC')
      ) > 0.4
    ORDER BY "similarity" DESC
    LIMIT 100
  `

  return NextResponse.json({
    unlinkedUsers,
    unlinkedPersonnel,
    bluecollarSuggestions,
    whitecollarSuggestions,
    counts: {
      unlinkedUsers: unlinkedUsers.length,
      unlinkedPersonnel: unlinkedPersonnel.length,
      bluecollarSuggestions: bluecollarSuggestions.length,
      whitecollarSuggestions: whitecollarSuggestions.length,
    },
  })
}

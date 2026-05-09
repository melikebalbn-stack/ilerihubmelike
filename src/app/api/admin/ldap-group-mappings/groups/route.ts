import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/ldap-group-mappings/groups
 *
 * AD'de gözüken tüm distinct grup CN'lerini, kullanım sayısını ve mapping
 * durumunu döner. UI'da sol panelde 'henüz eşlenmemiş' grupları görmek için.
 */
export async function GET() {
  const { session, error } = await requireUser()
  if (error) return error
  if (!session.user.permissions?.includes('admin.system.manage')) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const rows = await prisma.$queryRaw<
    Array<{
      group_cn: string
      user_count: bigint
      mapping_id: string | null
      role_slug: string | null
      role_name: string | null
      is_active: boolean | null
    }>
  >`
    SELECT
      g AS group_cn,
      COUNT(*)::bigint AS user_count,
      m.id AS mapping_id,
      r.slug AS role_slug,
      r.name AS role_name,
      m.is_active AS is_active
    FROM "User", unnest(groups) AS g
    LEFT JOIN ldap_group_role_map m ON m.group_cn = g
    LEFT JOIN role r ON r.id = m.role_id
    WHERE "User"."isActive" = true
    GROUP BY g, m.id, r.slug, r.name, m.is_active
    ORDER BY user_count DESC, g ASC
  `

  return NextResponse.json({
    groups: rows.map((r) => ({
      groupCN: r.group_cn,
      userCount: Number(r.user_count),
      hasMapping: r.mapping_id !== null,
      mappingId: r.mapping_id,
      mappedRoleSlug: r.role_slug,
      mappedRoleName: r.role_name,
      mappingActive: r.is_active,
    })),
  })
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'

export const dynamic = 'force-dynamic'

const GIZLI_TABLOLAR = new Set(['_prisma_migrations'])

/**
 * GET — Hub Postgres public şemasındaki tablolar (BASE TABLE). ?tablo=X → o tablonun kolonları.
 * Parametreler $queryRaw tagged template ile bağlanır (metin birleştirme yok).
 */
export async function GET(req: Request) {
  const { error } = await requirePermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (error) return error
  const tablo = new URL(req.url).searchParams.get('tablo')?.trim()

  if (tablo) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tablo)) return NextResponse.json({ error: 'Geçersiz tablo adı' }, { status: 400 })
    const kolonlar = await prisma.$queryRaw<{ ad: string; veriTipi: string; nullable: string }[]>`
      SELECT column_name AS "ad", data_type AS "veriTipi", is_nullable AS "nullable"
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${tablo}
      ORDER BY ordinal_position`
    if (!kolonlar.length) return NextResponse.json({ error: 'Tablo bulunamadı' }, { status: 404 })
    return NextResponse.json({ tablo, kolonlar })
  }

  const satirlar = await prisma.$queryRaw<{ ad: string; kolonSayisi: number }[]>`
    SELECT t.table_name AS "ad", COUNT(c.column_name)::int AS "kolonSayisi"
    FROM information_schema.tables t
    JOIN information_schema.columns c ON c.table_schema = t.table_schema AND c.table_name = t.table_name
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    GROUP BY t.table_name
    ORDER BY t.table_name`
  return NextResponse.json({ tablolar: satirlar.filter((t) => !GIZLI_TABLOLAR.has(t.ad)) })
}

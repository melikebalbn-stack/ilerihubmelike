import { NextRequest } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/api-response'
import type { Prisma } from '@/generated/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DURUMLAR = ['BEKLIYOR', 'YAZILDI', 'HATA', 'ATLANDI']

// GET /api/entegrasyon/syteline/kuyruk?entity=MALZEME&durum=HATA&q=&skip=0&take=50
// Kuyruk kaydı listesi — durum + kaynakAnahtar araması + sayfalama (server-side, tüm satırlar).
// durum boş/geçersiz → tümü. Guard: entegrasyon.syteline.
export async function GET(req: NextRequest) {
  const { error } = await requirePermission('entegrasyon.syteline')
  if (error) return error
  const sp = req.nextUrl.searchParams
  const entity = sp.get('entity') ?? 'MALZEME'
  const durum = sp.get('durum') ?? ''
  const q = (sp.get('q') ?? '').trim()
  const take = Math.min(50, Math.max(1, Number(sp.get('take')) || 50))
  const skip = Math.max(0, Number(sp.get('skip')) || 0)

  const where: Prisma.SyteSyncKayitWhereInput = {
    entity,
    ...(DURUMLAR.includes(durum) ? { durum } : {}),
    ...(q ? { kaynakAnahtar: { contains: q, mode: 'insensitive' } } : {}),
  }
  const [rows, toplam] = await Promise.all([
    prisma.syteSyncKayit.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take,
      select: { id: true, kaynakAnahtar: true, durum: true, hata: true, denemeSayisi: true, updatedAt: true },
    }),
    prisma.syteSyncKayit.count({ where }),
  ])
  return apiSuccess({
    rows: rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() })),
    toplam,
    skip,
    take,
  })
}

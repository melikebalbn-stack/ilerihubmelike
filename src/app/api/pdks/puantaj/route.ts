import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { pdksHata } from '@/lib/pdks/cihaz-yonetim'
import { GUN_DESENI, bugunStr, puantajGunu } from '@/lib/pdks/puantaj-servis'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/pdks/puantaj?gun=YYYY-MM-DD&departmentId=&q= — Günlük Puantaj (pdks.view). Hesaplanmış satırları okur.
export async function GET(req: NextRequest) {
  const { error } = await requirePermission(['pdks.view', 'pdks.manage'])
  if (error) return error
  try {
    const p = req.nextUrl.searchParams
    const g = p.get('gun')
    const gun = g && GUN_DESENI.test(g) ? g : bugunStr()
    return NextResponse.json({ ok: true, ...(await puantajGunu(prisma, gun, { departmentId: p.get('departmentId'), q: p.get('q') })) })
  } catch (e) {
    return pdksHata(e, 'Puantaj alınamadı')
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { duzeltmeYap, izinHata } from '@/lib/izin/yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/izin/bakiyeler/:personnelId/duzeltme {gun, gerekce} — defter düzeltmesi (izin.bakiye.admin).
// Yeni DUZELTME satırı eklenir; mevcut satır değişmez (defter trigger'ı UPDATE/DELETE'i reddeder).
export async function POST(req: NextRequest, { params }: { params: Promise<{ personnelId: string }> }) {
  const { error, userId } = await requirePermission('izin.bakiye.admin')
  if (error) return error
  try {
    const { personnelId } = await params
    const b = await req.json()
    return NextResponse.json({ ok: true, hareket: await duzeltmeYap(personnelId, b ?? {}, userId) }, { status: 201 })
  } catch (e) {
    return izinHata(e, 'Düzeltme yazılamadı')
  }
}

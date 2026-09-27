import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { izinHata, kisiHareketleri } from '@/lib/izin/yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/izin/bakiyeler/:personnelId/hareketler — yıllık izin defteri, yürüyen bakiyeyle (izin.admin)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ personnelId: string }> }) {
  const { error } = await requirePermission(['izin.admin', 'izin.bakiye.admin'])
  if (error) return error
  try {
    const { personnelId } = await params
    return NextResponse.json({ ok: true, ...(await kisiHareketleri(personnelId)) })
  } catch (e) {
    return izinHata(e, 'Hareketler alınamadı')
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { kidemBaslangiciKaydet, izinHata } from '@/lib/izin/yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/izin/bakiyeler/:personnelId/kidem {tarih|'', gerekce} — İV kıdem başlangıcı override.
// tarih boş → otomatiğe (en eski dönem) döner. Yalnız gösterim kıdemini etkiler; hak ediş son işe girişten.
export async function POST(req: NextRequest, { params }: { params: Promise<{ personnelId: string }> }) {
  const { error, userId } = await requirePermission(['izin.admin', 'izin.bakiye.admin'])
  if (error) return error
  try {
    const { personnelId } = await params
    const b = await req.json()
    return NextResponse.json({ ok: true, ...(await kidemBaslangiciKaydet(personnelId, b ?? {}, userId)) })
  } catch (e) {
    return izinHata(e, 'Kıdem başlangıcı güncellenemedi')
  }
}

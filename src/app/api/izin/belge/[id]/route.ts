import { NextRequest, NextResponse } from 'next/server'
import { izinErisim } from '@/lib/izin/erisim'
import { belgeAc } from '@/lib/izin/belge-servis'
import { izinHata } from '@/lib/izin/yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/izin/belge/:id — izin belgesi (yalnız talep sahibi + İV; rapor için izin.rapor.gor). Her açılış
// denetime yazılır; önbelleğe alınmaz.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await izinErisim()
  if (error) return error
  try {
    const { id } = await params
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null
    const b = await belgeAc(ctx, id, ip)
    return new NextResponse(new Uint8Array(b.icerik), {
      headers: {
        'Content-Type': b.mime,
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(b.ad)}`,
        'Cache-Control': 'no-store, private',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (e) {
    return izinHata(e, 'Belge açılamadı')
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { firmaGeriAlOnizleme } from '@/lib/servis-yonetimi/service'

// Geri alma diyaloğu için SALT OKUNUR önizleme: bu firmayla birlikte pasifleşen
// kaç araç/şoför geri gelebilir, kaç atama kapanmıştı (geri alınmaz). Yazma yok.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.restore')
  if (error) return error
  try {
    const { id } = await params
    const data = await firmaGeriAlOnizleme(id)
    return NextResponse.json({ ok: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Önizleme alınamadı.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}

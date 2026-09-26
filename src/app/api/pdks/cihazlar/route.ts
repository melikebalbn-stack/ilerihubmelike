import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { cihazListesi, cihazOlustur, pdksHata } from '@/lib/pdks/cihaz-yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET  /api/pdks/cihazlar — cihaz + kapı + okuyucu ağacı (kimlik bilgisi değeri DÖNMEZ, yalnız tanımlı mı)
// POST /api/pdks/cihazlar — yeni cihaz (envOnek koddan türetilir)
export async function GET() {
  const { error } = await requirePermission('pdks.manage')
  if (error) return error
  try {
    return NextResponse.json({ ok: true, cihazlar: await cihazListesi() })
  } catch (e) {
    return pdksHata(e, 'Cihazlar alınamadı')
  }
}

export async function POST(request: Request) {
  const { error, userId } = await requirePermission('pdks.manage')
  if (error) return error
  try {
    const b = await request.json()
    return NextResponse.json({ ok: true, cihaz: await cihazOlustur(b ?? {}, userId) }, { status: 201 })
  } catch (e) {
    return pdksHata(e, 'Cihaz oluşturulamadı')
  }
}

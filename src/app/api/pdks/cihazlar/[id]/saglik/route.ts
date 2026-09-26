import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { pdksHata, saglikKontrolu } from '@/lib/pdks/cihaz-yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/pdks/cihazlar/[id]/saglik — bağlantı testi (deviceInfo + System/time sapması).
// POST: cihaza istek atar ve sonGorulmeAt/seriNo/firmware yazar. Cihaz erişilemezse 200 +
// { ok:false, hata:{kod,mesaj} } döner (ekran hata kartı gösterir; 5xx yalnız beklenmeyen durumda).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('pdks.manage')
  if (error) return error
  const { id } = await params
  try {
    return NextResponse.json(await saglikKontrolu(id))
  } catch (e) {
    return pdksHata(e, 'Bağlantı testi yapılamadı')
  }
}

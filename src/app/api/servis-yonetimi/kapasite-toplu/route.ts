import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { hesapTarihiCoz, servisKapasiteTopluGetir } from '@/lib/servis-yonetimi/kapasite'

export const dynamic = 'force-dynamic'

// GET /api/servis-yonetimi/kapasite-toplu?tarih=YYYY-MM-DD&guzergahId=...
// Tüm AKTİF güzergâhların kapasite/doluluk özeti — Servis Paneli, toplu kapasite ekranı ve
// güzergâh detay kartları AYNI kaynaktan (kapasite motoru) okur. tarih verilmezse bugün
// (Türkiye günü). Yetki: servis.view. KVKK: kişi bilgisi dönmez (yalnız sayılar + plaka).
export async function GET(request: NextRequest) {
  const { error } = await requirePermission('servis.view')
  if (error) return error
  try {
    const tarih = hesapTarihiCoz(request.nextUrl.searchParams.get('tarih'))
    const guzergahId = request.nextUrl.searchParams.get('guzergahId')?.trim() || undefined
    const data = await servisKapasiteTopluGetir(tarih, { guzergahId })
    return NextResponse.json({ ok: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Kapasite özeti alınamadı.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}

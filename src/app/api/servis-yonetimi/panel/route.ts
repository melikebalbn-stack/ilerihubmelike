import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { servisPaneliOzetiGetir } from '@/lib/servis-yonetimi/panel'

export const dynamic = 'force-dynamic'

// GET /api/servis-yonetimi/panel — Servis Paneli sağ kolon özetleri
// ("Bu Ay Ne Değişti?" + "Veri Kalitesi"): YALNIZ SAYILAR (KVKK: kişi bilgisi yok).
// Kapasite sayıları ayrı uçtan (kapasite-toplu) ve kapasite motorundan gelir.
// Yetki: servis.view (iki özetin kaynak uçları da servis.view ister).
export async function GET() {
  const { error } = await requirePermission('servis.view')
  if (error) return error
  try {
    const data = await servisPaneliOzetiGetir()
    return NextResponse.json({ ok: true, data })
  } catch (err) {
    console.error('Servis paneli özet hatası:', err)
    return NextResponse.json({ ok: false, message: 'Panel özeti alınırken hata oluştu.' }, { status: 500 })
  }
}

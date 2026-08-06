import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { getTumStoklar } from '@/lib/envanter/tum-stoklar'

// GET /api/envanter/tum-stoklar — her stok/varyant satırı + durum (KRITIK/MINIMUM/NORMAL/EKSIK).
// Servisin (src/lib/envanter/tum-stoklar.ts) döndürdüğü şekil KORUNUR, yeniden tasarlanmaz.
export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.view')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }
  try {
    const data = await getTumStoklar()

    return NextResponse.json({
      ok: true,
      data,
    })
  } catch (error) {
    console.error('Envanter tüm stok listeleme hatası:', error)

    return NextResponse.json(
      {
        ok: false,
        message: 'Stok listesi alınırken hata oluştu.',
      },
      { status: 500 },
    )
  }
}

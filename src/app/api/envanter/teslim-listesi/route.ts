import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { getTeslimListesi } from '@/lib/envanter/teslim-listesi'

// GET /api/envanter/teslim-listesi?bolum=... — personel bazında KKD teslim matrisi.
// Servisin (src/lib/envanter/teslim-listesi.ts) döndürdüğü şekil KORUNUR, yeniden tasarlanmaz.
export async function GET(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.view')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  const bolum = request.nextUrl.searchParams.get('bolum')

  try {
    const data = await getTeslimListesi({ bolum: bolum || undefined })

    return NextResponse.json({
      ok: true,
      data,
    })
  } catch (error) {
    console.error('Envanter teslim listesi hatası:', error)

    return NextResponse.json(
      {
        ok: false,
        message: 'Teslim listesi alınırken hata oluştu.',
      },
      { status: 500 },
    )
  }
}

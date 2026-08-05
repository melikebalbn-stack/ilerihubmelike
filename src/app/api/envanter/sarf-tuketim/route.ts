import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { getSarfTuketim } from '@/lib/envanter/sarf-tuketim'

export async function GET(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.view')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  const baslangic = request.nextUrl.searchParams.get('baslangic') || undefined
  const bitis = request.nextUrl.searchParams.get('bitis') || undefined

  const data = await getSarfTuketim({ baslangic, bitis })
  return NextResponse.json({ ok: true, data })
}

import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { GERI_AL_SAAT, sonIslemler } from '@/lib/depo/geri-al'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/son-islemler[?saat=N] → { ok, saat, kayitlar } — oturumdaki operatörün kendi depo hareketleri
// (varsayılan son 12 saat, en fazla 48), her kayıtta geri alma uygunluğu. SADECE OKUMA.
export async function GET(request: Request) {
  const { userId, error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return error
  const ham = Number(new URL(request.url).searchParams.get('saat'))
  const saat = Number.isFinite(ham) && ham > 0 ? Math.min(48, ham) : GERI_AL_SAAT
  try {
    return NextResponse.json({ ok: true, saat, kayitlar: await sonIslemler(userId, saat) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Liste alınamadı' }, { status: 500 })
  }
}

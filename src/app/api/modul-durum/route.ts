import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { MODUL_KAYDI } from '@/lib/modul-durum/kayit'
import { modulYayinlari, yayinGorunurMu } from '@/lib/modul-durum/sunucu'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/modul-durum — Sidebar için TEK istek.
 *
 * Dönen: { gorunur: { "<anahtar>": boolean } } — kayıttaki her modül için bir satır.
 * Kayıtta olmayan modül hiç dönmez; Sidebar onları zaten süzmez (modul alanı yok).
 *
 * 401'de boş sözlük döner: Sidebar bayrakları boş kalır ve kapı AÇIK sayılır
 * (menü kozmetik; asıl zorlama modulGuard 404'ü ile cron kapısında — bkz. Sidebar
 * modulKapisiAcikMi yorumu). Oturumsuz kullanıcı zaten /login'e yönlenir.
 */
export async function GET() {
  const { user, error } = await requireUser()
  if (error || !user) return NextResponse.json({ gorunur: {} }, { status: 401 })

  const yayinlar = await modulYayinlari()
  const gorunur: Record<string, boolean> = {}
  for (const m of MODUL_KAYDI) {
    const y = yayinlar.get(m.anahtar)
    gorunur[m.anahtar] = y ? yayinGorunurMu(y, user) : true
  }
  return NextResponse.json({ gorunur })
}

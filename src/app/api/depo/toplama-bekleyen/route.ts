import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { getBekleyenToplamaIsleri, getMalzemeninBekleyenIsleri } from '@/lib/ifs/tuketim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/toplama-bekleyen?sayfa=0&boyut=25&q= → açık kalemli Released/Started emirler.
// Guard: admin.system.manage. SADECE OKUMA. { ok, isler, toplam }.
export async function GET(request: Request) {
  const { error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return error

  const sp = new URL(request.url).searchParams
  const part = sp.get('part')?.trim()

  try {
    // Malzeme modu: part varsa o malzemeyi bekleyen açık işler (q/sayfa yok sayılır).
    if (part) {
      const isler = await getMalzemeninBekleyenIsleri(part)
      return NextResponse.json({ ok: true, isler, toplam: isler.length })
    }
    const sayfa = Math.max(0, Number(sp.get('sayfa')) || 0)
    const boyut = Math.min(50, Math.max(1, Number(sp.get('boyut')) || 25))
    const q = sp.get('q') ?? undefined
    const { isler, toplam } = await getBekleyenToplamaIsleri(sayfa, boyut, q)
    return NextResponse.json({ ok: true, isler, toplam })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'IFS verisi alınamadı'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}

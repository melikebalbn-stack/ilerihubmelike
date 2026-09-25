import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { getStokBilgisi, okutVeGetir, type StokBilgisiFiltre } from '@/lib/ifs/stok-bilgisi'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/depo/stok-bilgisi?okut=&kaynak=okutma|elle&ambar=&lokasyon=&stokNo=&stokAdi=&lot=&seri=
//   &tasimaBirimi=&proje=&sayfa= → { ok, satirlar, toplam, tekParca?, cozum? }
// okut varsa tek-alan çözümü (barkod → stok no → lokasyon); diğer parametreler ek filtre.
// Guard: depo.terminal.use | admin.system.manage. SADECE OKUMA.
export async function GET(request: Request) {
  const { error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return error

  const sp = new URL(request.url).searchParams
  const s = (k: string) => sp.get(k)?.trim() || undefined
  const tb = s('tasimaBirimi')
  const tasimaBirimi = tb != null && /^\d+$/.test(tb) ? Number(tb) : undefined
  if (tb != null && tasimaBirimi == null) {
    return NextResponse.json({ ok: false, error: `Geçersiz taşıma birimi: ${tb}` }, { status: 400 })
  }
  const filtre: StokBilgisiFiltre = {
    warehouse: s('ambar'),
    locationNo: s('lokasyon'),
    partNo: s('stokNo'),
    partNoDesc: s('stokAdi'),
    lotBatchNo: s('lot'),
    serialNo: s('seri'),
    handlingUnitId: tasimaBirimi,
    projectId: s('proje'),
  }
  const sayfa = Math.max(0, Number(sp.get('sayfa')) || 0)
  const okut = s('okut')
  const kaynak = sp.get('kaynak') === 'elle' ? 'elle' : 'okutma'

  try {
    const sonuc = okut ? await okutVeGetir(okut, kaynak, filtre, sayfa) : await getStokBilgisi(filtre, sayfa)
    return NextResponse.json({ ok: true, ...sonuc })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'IFS verisi alınamadı'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}

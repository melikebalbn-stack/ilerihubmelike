import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { tezgahDetay } from '@/lib/ipro/izleme-service'
import { iproHata } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/terminal/uretim/tezgah/[id] → tek tezgah detayı (terminal kart tıklaması
// → dialog). İzleme panosunun /api/ipro/izleme/tezgah/[id] route'unun TERMINAL İKİZİ:
// aynı tezgahDetay(id) servisini çağırır ama guard terminal ekranıyla aynı
// (admin.system.manage) — izleme panosu ipro.view/ipro.admin ister, operatörde
// olmayabilir. id = ipro_tezgah.id (page.tsx iproId olarak geçirir). SALT OKUMA.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('admin.system.manage')
  if (error) return error
  try {
    const { id } = await params
    const detay = await tezgahDetay(id)
    if (!detay) return NextResponse.json({ ok: false, error: 'Tezgah bulunamadı' }, { status: 404 })
    return NextResponse.json({ ok: true, ...detay })
  } catch (e) {
    return iproHata(e, 'Tezgah detayı alınamadı')
  }
}

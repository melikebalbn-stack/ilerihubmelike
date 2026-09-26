import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { logDepoHareket } from '@/lib/depo/hareket-log'
import { tuket } from '@/lib/ifs/malzeme-talebi'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/depo/malzeme-talebi/{orderNo}/tuket → rezervli satırların çıkışı (stoktan düşer). IFS'e YAZAR.
// Satır bazında sonuç döner; bir satırın hatası diğerlerini durdurmaz.
export async function POST(_request: Request, { params }: { params: Promise<{ orderNo: string }> }) {
  const { session, userId, error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return error
  const { orderNo: ham } = await params
  const orderNo = decodeURIComponent(ham).trim()
  try {
    const sonuc = await tuket(orderNo)
    for (const s of sonuc.sonuclar.filter((x) => x.ok)) {
      await logDepoHareket({
        olay: 'MALZEME_TALEBI_TUKET',
        userId,
        kullaniciAd: session.user.name ?? 'Operatör',
        partNo: s.partNo,
        miktar: s.miktar,
        kaynakLok: s.lokasyonlar.join(',') || null,
        orderNo,
        releaseNo: s.releaseNo,
        lineItemNo: s.lineItemNo,
        detay: { lineNo: s.lineNo },
      })
    }
    return NextResponse.json({ ok: true, ...sonuc })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'IFS işlemi başarısız' }, { status: 502 })
  }
}

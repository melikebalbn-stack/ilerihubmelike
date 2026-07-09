import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-permission'
import {
  getRezervKirilim,
  getSatirDurum,
  issueSatir,
  normalizeIsEmriNo,
  reserveSatir,
  type SatirAnahtar,
} from '@/lib/ifs/tuketim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  releaseNo: z.string(),
  sequenceNo: z.string(),
  lineItemNo: z.number().int(),
})

// POST /api/depo/toplama/{orderNo}/topla → satırı rezerve et + çıkışını yap (EL-6b).
// Guard: admin.system.manage. Reserve→Issue ardışık; tek kullanıcı akışı.
// TODO (EL-6c): kısmi çıkış, sapma (farklı lot), unreserve telafisi.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderNo: string }> },
) {
  const { error } = await requirePermission('admin.system.manage')
  if (error) return error

  const { orderNo: ham } = await params
  const orderNo = normalizeIsEmriNo(decodeURIComponent(ham))

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Geçersiz JSON' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(payload)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')
    return NextResponse.json({ ok: false, error: `Geçersiz istek: ${msg}` }, { status: 400 })
  }

  const satir: SatirAnahtar = {
    orderNo,
    releaseNo: parsed.data.releaseNo,
    sequenceNo: parsed.data.sequenceNo,
    lineItemNo: parsed.data.lineItemNo,
  }

  try {
    // 1) Rezervasyon (bound, If-Match)
    const rez = await reserveSatir(satir)
    if (!rez.ok) {
      return NextResponse.json({ ok: false, error: rez.error ?? 'Rezervasyon başarısız' }, { status: 502 })
    }

    // 2) IFS'in seçtiği kırılımı oku (FIFO tahmininden farklı olabilir)
    const kirilim = await getRezervKirilim(satir)

    // 3) Çıkış (unbound IssueMaterial)
    const iss = await issueSatir(satir)
    if (!iss.ok) {
      // TODO (EL-6c): rezerv yapıldı ama çıkış başarısız → unreserve telafisi
      return NextResponse.json(
        { ok: false, error: `Rezerv yapıldı ama çıkış başarısız: ${iss.error ?? ''}`, kirilim },
        { status: 502 },
      )
    }

    // 4) Taze satır durumu
    const durum = await getSatirDurum(satir)
    return NextResponse.json({ ok: true, kirilim, satir: durum })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'IFS verisi alınamadı'
    return NextResponse.json({ ok: false, error: message }, { status: 502 })
  }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-permission'
import { getPartAdi } from '@/lib/ifs/depo-stok'
import { generateMalzemeEtiketi, genEtiketNo } from '@/lib/depo/etiket-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// etiketNo sunucuda üretilir; basanKullanici session'dan → body'de yok.
const BodySchema = z.object({
  stokKodu: z.string().min(1),
  stokAdi: z.string(),
  miktar: z.number(),
  birim: z.string(),
  lot: z.string().optional(),
  girisTarihi: z.string().optional(),
  kaynakBilgi: z.string(),
  lokasyon: z.string(),
  kaynakModul: z.string(),
})

// POST /api/depo/etiket → malzeme tanıtım kartı PDF (inline). Guard: admin.system.manage.
export async function POST(request: Request) {
  const { session, error } = await requirePermission('admin.system.manage')
  if (error) return error

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

  try {
    // Stok adı boş/'-' ise IFS'ten tamamla (bloklamaz — null ise '-' kalır).
    const d = parsed.data
    let stokAdi = d.stokAdi
    if (!stokAdi || stokAdi.trim() === '' || stokAdi.trim() === '-') {
      stokAdi = (await getPartAdi(d.stokKodu)) ?? d.stokAdi
    }

    const etiketNo = genEtiketNo()
    const pdf = await generateMalzemeEtiketi({
      ...d,
      stokAdi,
      etiketNo,
      basanKullanici: session.user.name ?? 'Operatör',
    })
    return new Response(pdf as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${etiketNo}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Etiket üretilemedi'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

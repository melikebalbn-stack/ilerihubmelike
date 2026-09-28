import { NextRequest, NextResponse } from 'next/server'
import { izinErisim } from '@/lib/izin/erisim'
import { izinHata } from '@/lib/izin/yonetim'
import { ayTakvimi } from '@/lib/izin/talep-servis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/izin/talebim/takvim?ay=YYYY-MM[&personnelId=] — ay takvimi: tatil/hafta sonu + ekipten izinli SAYISI.
export async function GET(req: NextRequest) {
  const { ctx, error } = await izinErisim()
  if (error) return error
  try {
    const p = req.nextUrl.searchParams
    return NextResponse.json({ ok: true, ...(await ayTakvimi(ctx, p.get('ay') ?? '', p.get('personnelId'))) })
  } catch (e) {
    return izinHata(e, 'Takvim alınamadı')
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { izinErisim } from '@/lib/izin/erisim'
import { ekipTakvimi } from '@/lib/izin/takvim-servis'
import { izinHata } from '@/lib/izin/yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/izin/takvim?ay=YYYY-MM[&departmentId=] — Ekip Takvimi. Yönetici yalnız kendi ekibi (departmentId
// yok sayılır), İV tüm departmanlar; çalışan 403. Yanıtta tür / bakiye / rapor YOK.
export async function GET(req: NextRequest) {
  const { ctx, error } = await izinErisim()
  if (error) return error
  try {
    const p = req.nextUrl.searchParams
    return NextResponse.json({ ok: true, ...(await ekipTakvimi(ctx, { ay: p.get('ay') ?? '', departmentId: p.get('departmentId') })) })
  } catch (e) {
    return izinHata(e, 'Ekip takvimi alınamadı')
  }
}

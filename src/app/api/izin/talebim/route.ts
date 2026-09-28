import { NextRequest, NextResponse } from 'next/server'
import { izinErisim } from '@/lib/izin/erisim'
import { izinHata } from '@/lib/izin/yonetim'
import { izinlerim } from '@/lib/izin/talep-servis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/izin/talebim[?personnelId=] — İzinlerim: bakiye kartları, türler, talepler. personnelId: "adına"
// (yönetici kendi ekibi / İV herkes; yöneticiye talep listesi DÖNMEZ).
export async function GET(req: NextRequest) {
  const { ctx, error } = await izinErisim()
  if (error) return error
  try {
    return NextResponse.json({ ok: true, ...(await izinlerim(ctx, req.nextUrl.searchParams.get('personnelId'))) })
  } catch (e) {
    return izinHata(e, 'İzin bilgileri alınamadı')
  }
}

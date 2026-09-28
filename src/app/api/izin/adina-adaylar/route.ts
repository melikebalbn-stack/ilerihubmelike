import { NextRequest, NextResponse } from 'next/server'
import { izinErisim } from '@/lib/izin/erisim'
import { izinHata } from '@/lib/izin/yonetim'
import { adinaAdaylari } from '@/lib/izin/talep-servis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/izin/adina-adaylar?q= — "adına talep" kişileri: İV herkes, yönetici kendi ekibi.
export async function GET(req: NextRequest) {
  const { ctx, error } = await izinErisim()
  if (error) return error
  try {
    return NextResponse.json({ ok: true, kisiler: await adinaAdaylari(ctx, req.nextUrl.searchParams.get('q') ?? '') })
  } catch (e) {
    return izinHata(e, 'Kişiler alınamadı')
  }
}

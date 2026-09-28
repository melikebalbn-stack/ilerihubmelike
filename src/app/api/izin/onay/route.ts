import { NextRequest, NextResponse } from 'next/server'
import { izinErisim } from '@/lib/izin/erisim'
import { izinHata } from '@/lib/izin/yonetim'
import { onayListesi } from '@/lib/izin/onay-servis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/izin/onay?sekme=bekleyen|karar — Onay Bekleyenler. Yönetici kalemleri TÜRSÜZ (gorunum.onayKalemi).
export async function GET(req: NextRequest) {
  const { ctx, error } = await izinErisim()
  if (error) return error
  try {
    const sekme = req.nextUrl.searchParams.get('sekme') === 'karar' ? 'karar' : 'bekleyen'
    return NextResponse.json({ ok: true, ...(await onayListesi(ctx, sekme)) })
  } catch (e) {
    return izinHata(e, 'Onay listesi alınamadı')
  }
}

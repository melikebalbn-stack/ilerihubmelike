import { NextRequest, NextResponse } from 'next/server'
import { izinErisim } from '@/lib/izin/erisim'
import { izinHata } from '@/lib/izin/yonetim'
import { kararVer, onayDetay } from '@/lib/izin/onay-servis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET  /api/izin/onay/:id — detay: kıdem, düşülecek, (İV'de) tür + bakiye etkisi, ekibin o günleri (türsüz).
// POST /api/izin/onay/:id {karar: ONAY|RED, gerekce, negatifeDusur?} — red gerekçesi ZORUNLU; kendi talebi 400.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await izinErisim()
  if (error) return error
  try {
    const { id } = await params
    return NextResponse.json({ ok: true, ...(await onayDetay(ctx, id)) })
  } catch (e) {
    return izinHata(e, 'Talep alınamadı')
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await izinErisim()
  if (error) return error
  try {
    const { id } = await params
    return NextResponse.json({ ok: true, ...(await kararVer(ctx, id, (await req.json()) ?? {})) })
  } catch (e) {
    return izinHata(e, 'Karar kaydedilemedi')
  }
}

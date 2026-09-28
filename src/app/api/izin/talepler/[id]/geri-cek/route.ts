import { NextRequest, NextResponse } from 'next/server'
import { izinErisim } from '@/lib/izin/erisim'
import { izinHata } from '@/lib/izin/yonetim'
import { geriCek } from '@/lib/izin/talep-servis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/izin/talepler/:id/geri-cek — bekleyen talebi geri çek (talep sahibi ya da adına açan). SİLİNMEZ → IPTAL.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await izinErisim()
  if (error) return error
  try {
    const { id } = await params
    const b = await req.json().catch(() => ({}))
    return NextResponse.json({ ok: true, ...(await geriCek(ctx, id, b?.neden)) })
  } catch (e) {
    return izinHata(e, 'Talep geri çekilemedi')
  }
}

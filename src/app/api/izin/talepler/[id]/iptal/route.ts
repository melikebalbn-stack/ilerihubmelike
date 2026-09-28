import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { baglam } from '@/lib/izin/talep-ortak'
import { ivIptal } from '@/lib/izin/talep-servis'
import { izinHata } from '@/lib/izin/yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/izin/talepler/:id/iptal {gerekce} — onaylı iznin BAŞLAMADAN iptali (izin.admin): IPTAL + IPTAL_IADE.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('izin.admin')
  if (error) return error
  try {
    const { id } = await params
    return NextResponse.json({ ok: true, ...(await ivIptal(await baglam(userId), id, (await req.json()) ?? {})) })
  } catch (e) {
    return izinHata(e, 'İzin iptal edilemedi')
  }
}

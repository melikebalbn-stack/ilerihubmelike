import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { baglam } from '@/lib/izin/talep-ortak'
import { erkenDonusKarar } from '@/lib/izin/erken-donus'
import { izinHata } from '@/lib/izin/yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/izin/erken-donus/:id {karar: ONAY|RED, not?} — ONAY: tespit gününden itibaren kalan günler iade
// (IzinTalepGun.iadeAt + bakiyeli türde IPTAL_IADE); RED: iade yok (izin.admin).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('izin.admin')
  if (error) return error
  try {
    const { id } = await params
    return NextResponse.json({ ok: true, ...(await erkenDonusKarar(await baglam(userId), id, (await req.json()) ?? {})) })
  } catch (e) {
    return izinHata(e, 'Karar kaydedilemedi')
  }
}

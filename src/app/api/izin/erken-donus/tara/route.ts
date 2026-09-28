import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { erkenDonusTara } from '@/lib/izin/erken-donus'
import { izinHata } from '@/lib/izin/yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/izin/erken-donus/tara — izinli günde geçiş gören kayıtları kuyruğa al (izin.admin; cron da çağırır).
export async function POST() {
  const { error, userId } = await requirePermission('izin.admin')
  if (error) return error
  try {
    return NextResponse.json({ ok: true, ...(await erkenDonusTara(userId)) })
  } catch (e) {
    return izinHata(e, 'Tarama yapılamadı')
  }
}

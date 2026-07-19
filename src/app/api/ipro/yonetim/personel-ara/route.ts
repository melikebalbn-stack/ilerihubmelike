import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { personelAra } from '@/lib/ipro/yonetim-service'
import { iproHata } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/ipro/yonetim/personel-ara?q=... → operatör eklemek için personel araması
export async function GET(request: Request) {
  const { error } = await requirePermission('ipro.admin')
  if (error) return error
  const q = new URL(request.url).searchParams.get('q') ?? ''
  try {
    return NextResponse.json({ ok: true, personeller: await personelAra(q) })
  } catch (e) {
    return iproHata(e, 'Personel araması başarısız')
  }
}

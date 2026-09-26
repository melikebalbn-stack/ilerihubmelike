import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { okuyucuOlustur, pdksHata } from '@/lib/pdks/cihaz-yonetim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { error, userId } = await requirePermission('pdks.manage')
  if (error) return error
  try {
    const b = await request.json()
    return NextResponse.json({ ok: true, okuyucu: await okuyucuOlustur(b ?? {}, userId) }, { status: 201 })
  } catch (e) {
    return pdksHata(e, 'Okuyucu oluşturulamadı')
  }
}

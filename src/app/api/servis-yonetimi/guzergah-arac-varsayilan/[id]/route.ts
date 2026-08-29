import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { guncelleServisGuzergahAracVarsayilan } from '@/lib/servis-yonetimi/service'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('servis.tanim.manage')
  if (error) return error
  try {
    const { id } = await params
    const body = (await request.json()) as { bitisTarihi?: string | null; neden?: string | null; aciklama?: string | null }
    const data = await guncelleServisGuzergahAracVarsayilan(id, body, userId)
    return NextResponse.json({ ok: true, message: 'Varsayılan araç ataması güncellendi.', data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Varsayılan araç ataması güncellenemedi.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}

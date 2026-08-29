import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { guncelleServisGuzergahSoforVarsayilan } from '@/lib/servis-yonetimi/service'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('servis.tanim.manage')
  if (error) return error
  try {
    const { id } = await params
    const body = (await request.json()) as { bitisTarihi?: string | null; neden?: string | null; aciklama?: string | null }
    const data = await guncelleServisGuzergahSoforVarsayilan(id, body, userId)
    return NextResponse.json({ ok: true, message: 'Varsayılan şoför ataması güncellendi.', data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Varsayılan şoför ataması güncellenemedi.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}

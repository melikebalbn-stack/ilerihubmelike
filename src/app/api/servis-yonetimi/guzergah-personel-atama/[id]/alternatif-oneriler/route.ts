import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { alternatifServisOnerileriGetir } from '@/lib/servis-yonetimi/alternatif-servis'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.view')
  if (error) return error
  try {
    const { id } = await params
    const data = await alternatifServisOnerileriGetir(id)
    return NextResponse.json({ ok: true, data, toplam: data.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Alternatif servis önerileri alınamadı.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}

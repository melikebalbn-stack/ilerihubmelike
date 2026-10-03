import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { onayBayragiOku, pasiflestirHataYaniti } from '@/lib/servis-yonetimi/pasiflestir-yaniti'
import { pasiflestirServisYerleske } from '@/lib/servis-yonetimi/service'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('servis.passive')
  if (error) return error
  try {
    const { id } = await params
    const data = await pasiflestirServisYerleske(id, userId, { onay: await onayBayragiOku(request) })
    return NextResponse.json({ ok: true, message: 'Yerleşke pasifleştirildi.', data })
  } catch (err) {
    return pasiflestirHataYaniti(err, 'Yerleşke pasifleştirilemedi.')
  }
}

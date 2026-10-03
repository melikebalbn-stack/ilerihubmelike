import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { onayBayragiOku, pasiflestirHataYaniti } from '@/lib/servis-yonetimi/pasiflestir-yaniti'
import { pasiflestirServisGuzergah } from '@/lib/servis-yonetimi/service'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('servis.passive')
  if (error) return error
  try {
    const { id } = await params
    const data = await pasiflestirServisGuzergah(id, userId, { onay: await onayBayragiOku(request) })
    return NextResponse.json({ ok: true, message: 'Güzergâh pasifleştirildi.', data })
  } catch (err) {
    return pasiflestirHataYaniti(err, 'Güzergâh pasifleştirilemedi.')
  }
}

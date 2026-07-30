import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { deleteTatil } from '@/lib/ipro/takvim'
import { iproHata } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('ipro.takvim.yonet')
  if (error) return error
  const { id } = await params
  try {
    return NextResponse.json({ ok: true, silinen: await deleteTatil(id) })
  } catch (e) {
    return iproHata(e, 'Takvim kaydı silinemedi')
  }
}

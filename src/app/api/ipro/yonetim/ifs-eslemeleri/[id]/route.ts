import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { updateIfsEsleme, deleteIfsEsleme, type IfsEslesmeGirdi } from '@/lib/ipro/yonetim-service'
import { iproHata } from '@/lib/ipro/yonetim-hata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('ipro.admin')
  if (error) return error
  const { id } = await params
  try {
    const b = await request.json()
    const data: Partial<IfsEslesmeGirdi> = {}
    if (b?.tip !== undefined) {
      if (b.tip !== 'ORG' && b.tip !== 'POZISYON') {
        return NextResponse.json({ ok: false, error: "Tip 'ORG' veya 'POZISYON' olmalı" }, { status: 400 })
      }
      data.tip = b.tip
    }
    if (b?.ilerihubDeger !== undefined) data.ilerihubDeger = String(b.ilerihubDeger).trim()
    if (b?.ifsKod !== undefined) data.ifsKod = String(b.ifsKod).trim()
    if (b?.aciklama !== undefined) data.aciklama = b.aciklama || null
    if (b?.aktif !== undefined) data.aktif = Boolean(b.aktif)
    return NextResponse.json({ ok: true, esleme: await updateIfsEsleme(id, data) })
  } catch (e) {
    return iproHata(e, 'Eşleme güncellenemedi')
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('ipro.admin')
  if (error) return error
  const { id } = await params
  try {
    return NextResponse.json({ ok: true, esleme: await deleteIfsEsleme(id) })
  } catch (e) {
    return iproHata(e, 'Eşleme silinemedi')
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { atamaDilimleriniGuncelle } from '@/lib/servis-yonetimi/atama-dilim'
import { atamaDilimHataYaniti, dizi, govdeOku } from '@/lib/servis-yonetimi/atama-dilim-http'

export const dynamic = 'force-dynamic'

// PATCH /api/servis-yonetimi/guzergah-personel-atama/[id]/dilimler — tek atamada dilim ekle/çıkar.
// Hiç dilim kalacaksa dilimsizOnayi:true, aşım olacaksa asimOnayi:true gerekir (aksi 409).
// Yetki: servis.edit.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('servis.edit')
  if (error) return error
  const body = await govdeOku(request)
  if (!body) return NextResponse.json({ ok: false, message: 'Geçersiz istek gövdesi.' }, { status: 400 })
  try {
    const { id } = await params
    const data = await atamaDilimleriniGuncelle(
      id,
      { ekle: dizi(body.ekle), cikar: dizi(body.cikar), asimOnayi: body.asimOnayi === true, dilimsizOnayi: body.dilimsizOnayi === true },
      userId,
    )
    return NextResponse.json({ ok: true, message: 'Atamanın sefer dilimleri güncellendi.', data })
  } catch (err) {
    return atamaDilimHataYaniti(err, 'Sefer dilimleri güncellenemedi.')
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/require-permission'
import { topluDilimAta } from '@/lib/servis-yonetimi/atama-dilim'
import { atamaDilimHataYaniti, dizi, govdeOku } from '@/lib/servis-yonetimi/atama-dilim-http'

export const dynamic = 'force-dynamic'

// POST /api/servis-yonetimi/guzergah/[id]/personel-atama/dilim-ata
// Toplu "Dilim Ata" (mod: ekle). TEK transaction: bir atama başarısızsa hiçbiri uygulanmaz;
// her atama için ayrı tarihçe + ortak topluIslemId. Aşım olacaksa asimOnayi:true gerekir (409).
// Yetki: servis.edit.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, userId } = await requirePermission('servis.edit')
  if (error) return error
  const body = await govdeOku(request)
  if (!body) return NextResponse.json({ ok: false, message: 'Geçersiz istek gövdesi.' }, { status: 400 })
  try {
    const { id: guzergahId } = await params
    const data = await topluDilimAta(
      guzergahId,
      { atamaIdleri: dizi(body.atamaIdleri), dilimIdleri: dizi(body.dilimIdleri), asimOnayi: body.asimOnayi === true },
      userId,
    )
    return NextResponse.json({ ok: true, message: `${data.degisen} atamaya dilim eklendi.`, data })
  } catch (err) {
    return atamaDilimHataYaniti(err, 'Dilimler atanamadı.')
  }
}

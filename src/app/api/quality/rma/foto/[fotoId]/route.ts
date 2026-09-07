import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { canManageRma } from '@/lib/quality/rma-access'
import { fotoDosyasiniSil } from '@/lib/quality/rma-foto-dosya'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ fotoId: string }> }

/**
 * DELETE /api/quality/rma/foto/[fotoId] — fotoğrafı sil. Auth: canManageRma.
 *
 * Sıra: DB kaydı silinir, SONRA disk dosyası. Disk silme başarısız olsa bile DB
 * silmesi GERİ ALINMAZ (fotoDosyasiniSil throw etmez) — yetim dosya, yetim DB
 * satırından iyidir; sebep loglanır.
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canManageRma(session)) {
    return NextResponse.json({ error: 'Fotoğraf silme yetkiniz yok' }, { status: 403 })
  }
  const { fotoId } = await params

  const foto = await prisma.rmaFoto.findUnique({
    where: { id: fotoId },
    select: { id: true, dosyaYolu: true },
  })
  if (!foto) return NextResponse.json({ error: 'Fotoğraf bulunamadı' }, { status: 404 })

  await prisma.rmaFoto.delete({ where: { id: fotoId } })

  const sonuc = await fotoDosyasiniSil(foto.dosyaYolu)
  if (!sonuc.silindi && sonuc.sebep !== 'dosya-yok') {
    console.warn(`[rma-foto] disk dosyası silinemedi (${sonuc.sebep}):`, sonuc.detay ?? foto.dosyaYolu)
  }

  return NextResponse.json({ success: true })
}

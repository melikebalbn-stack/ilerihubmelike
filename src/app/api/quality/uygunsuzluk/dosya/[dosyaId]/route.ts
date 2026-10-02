import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { canManageUygunsuzluk } from '@/lib/quality/uygunsuzluk-access'
import { dosyaSil } from '@/lib/quality/uygunsuzluk-dosya'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ dosyaId: string }> }

/**
 * DELETE /api/quality/uygunsuzluk/dosya/[dosyaId] — dökümanı sil. Auth: canManageUygunsuzluk.
 * Sıra: DB kaydı silinir, SONRA disk dosyası (rma/foto/[fotoId] ile aynı sözleşme —
 * disk silme başarısız olsa bile DB silmesi geri alınmaz, yetim dosya loglanır).
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canManageUygunsuzluk(session)) {
    return NextResponse.json({ error: 'Döküman silme yetkiniz yok' }, { status: 403 })
  }
  const { dosyaId } = await params

  const dosya = await prisma.kaliteUygunsuzlukDosya.findUnique({
    where: { id: dosyaId },
    select: { id: true, dosyaUrl: true },
  })
  if (!dosya) return NextResponse.json({ error: 'Döküman bulunamadı' }, { status: 404 })

  await prisma.kaliteUygunsuzlukDosya.delete({ where: { id: dosyaId } })

  const sonuc = await dosyaSil(dosya.dosyaUrl)
  if (!sonuc.silindi && sonuc.sebep !== 'dosya-yok') {
    console.warn(`[uygunsuzluk-dosya] disk dosyası silinemedi (${sonuc.sebep}):`, sonuc.detay ?? dosya.dosyaUrl)
  }

  return NextResponse.json({ success: true })
}

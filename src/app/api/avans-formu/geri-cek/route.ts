import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { prisma } from '@/lib/prisma'
import { donemGeriCekKilidiKontrol } from '@/lib/avans/donem-kilidi'

export const dynamic = 'force-dynamic'

/**
 * DELETE: Kişinin KENDİ girdiği bir avans talebini geri çeker.
 * Hem kendim formu hem sorumlu formu kayıtları için AYNI uç: ikisinde de
 * AvansTalebi.sorumluId, formu gönderen kişinin kendi Personnel id'si (bkz.
 * kendi/route.ts POST ve route.ts POST) — tek bir sahiplik kontrolü yeterli.
 * AvansTalebi silinince satırlar cascade ile silinir (bkz. schema.prisma).
 *
 * Kilit kontrolü SADECE manuel duruma bakar (donemGeriCekKilidiKontrol) —
 * otomatik gün kilidine (donemOtomatikDurum) HİÇ bakmaz: İK elle
 * kapatmadığı sürece, günün kaçı olursa olsun geri çekilebilir.
 */

type DeleteBody = { avansTalebiId: string }

function gecerliBody(body: unknown): body is DeleteBody {
  if (!body || typeof body !== 'object') return false
  return typeof (body as Record<string, unknown>).avansTalebiId === 'string'
}

export async function DELETE(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  const body: unknown = await request.json().catch(() => null)
  if (!gecerliBody(body)) {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi (avansTalebiId).' }, { status: 400 })
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { personnelId: true },
  })
  if (!dbUser?.personnelId) {
    return NextResponse.json(
      { error: 'Hesabınıza bağlı personel kaydı bulunamadı.' },
      { status: 404 }
    )
  }

  const talep = await prisma.avansTalebi.findUnique({ where: { id: body.avansTalebiId } })
  if (!talep) {
    return NextResponse.json({ error: 'Talep bulunamadı.' }, { status: 404 })
  }
  if (talep.sorumluId !== dbUser.personnelId) {
    return NextResponse.json(
      { error: 'Sadece kendi girdiğiniz talebi geri çekebilirsiniz.' },
      { status: 403 }
    )
  }

  const kilit = await donemGeriCekKilidiKontrol(talep.donemYil, talep.donemAy)
  if (kilit) return kilit

  await prisma.avansTalebi.delete({ where: { id: talep.id } })

  return NextResponse.json({ success: true })
}

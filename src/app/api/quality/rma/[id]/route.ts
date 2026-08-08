import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { canManageRma } from '@/lib/quality/rma-access'
import { rmaKayitInput } from '@/lib/quality/rma-validators'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** GET /api/quality/rma/[id] — detay. Auth: oturum. Satırlar siraNo'ya göre sıralı. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { error } = await requireSession()
  if (error) return error
  const { id } = await params

  const kayit = await prisma.rmaKayit.findUnique({
    where: { id },
    include: {
      musteri: { select: { id: true, name: true, code: true } },
      satirlar: { orderBy: { siraNo: 'asc' } },
    },
  })
  if (!kayit) return NextResponse.json({ error: 'RMA kaydı bulunamadı' }, { status: 404 })

  return NextResponse.json({ ...kayit, durum: kayit.kapanisTarihi ? 'KAPALI' : 'ACIK' })
}

/**
 * PATCH /api/quality/rma/[id] — güncelle. Auth: canManageRma. `no` DEĞİŞTİRİLEMEZ.
 * Satırlar TAM liste gelir → mevcutlar silinip yeniden yazılır (ekle/güncelle/sil tek işlemde).
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { session, userId, error } = await requireSession()
  if (error) return error
  if (!canManageRma(session)) {
    return NextResponse.json({ error: 'RMA kaydı düzenleme yetkiniz yok' }, { status: 403 })
  }
  const { id } = await params

  const mevcut = await prisma.rmaKayit.findUnique({ where: { id }, select: { id: true } })
  if (!mevcut) return NextResponse.json({ error: 'RMA kaydı bulunamadı' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const parsed = rmaKayitInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Geçersiz veri', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const d = parsed.data

  const musteri = await prisma.costCustomer.findUnique({
    where: { id: d.musteriId },
    select: { id: true, isActive: true },
  })
  if (!musteri || !musteri.isActive) {
    return NextResponse.json({ error: 'Geçersiz veya pasif müşteri' }, { status: 400 })
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Satır tam-liste replace: mevcutları sil, yenilerini yaz. `no` DOKUNULMAZ.
    await tx.rmaSatir.deleteMany({ where: { rmaKayitId: id } })
    return tx.rmaKayit.update({
      where: { id },
      data: {
        tip: d.tip,
        urunGelisTarihi: d.urunGelisTarihi ?? null,
        irsaliyeTarihi: d.irsaliyeTarihi ?? null,
        irsaliyeNo: d.irsaliyeNo ?? null,
        musteriId: d.musteriId,
        iadeTuru: d.iadeTuru,
        sorumluId: d.sorumluId ?? null,
        termin: d.termin ?? null,
        kapanisTarihi: d.kapanisTarihi ?? null,
        maliyet: d.maliyet ?? null,
        guncelleyenId: userId,
        satirlar: {
          create: d.satirlar.map((s) => ({
            siraNo: s.siraNo,
            urunKodu: s.urunKodu,
            lotNo: s.lotNo ?? null,
            iadeMiktari: s.iadeMiktari,
            musteriIadeSebebi: s.musteriIadeSebebi,
            ilkIncelemeSonucu: s.ilkIncelemeSonucu ?? null,
            karar: s.karar ?? null,
            kararAciklama: s.kararAciklama ?? null,
            hurdaAdedi: s.hurdaAdedi ?? null,
            reworkAdedi: s.reworkAdedi ?? null,
            kokNeden: s.kokNeden ?? null,
            aksiyon: s.aksiyon ?? null,
          })),
        },
      },
      include: { satirlar: { orderBy: { siraNo: 'asc' } }, musteri: { select: { name: true, code: true } } },
    })
  })

  return NextResponse.json({ ...updated, durum: updated.kapanisTarihi ? 'KAPALI' : 'ACIK' })
}

/** DELETE /api/quality/rma/[id] — sil. Auth: canManageRma. Satırlar cascade. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canManageRma(session)) {
    return NextResponse.json({ error: 'RMA kaydı silme yetkiniz yok' }, { status: 403 })
  }
  const { id } = await params

  const mevcut = await prisma.rmaKayit.findUnique({ where: { id }, select: { id: true } })
  if (!mevcut) return NextResponse.json({ error: 'RMA kaydı bulunamadı' }, { status: 404 })

  await prisma.rmaKayit.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

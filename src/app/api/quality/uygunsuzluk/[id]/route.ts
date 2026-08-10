import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { canManageUygunsuzluk } from '@/lib/quality/uygunsuzluk-access'
import { uygunsuzlukInput } from '@/lib/quality/uygunsuzluk-validators'
import { referanslariDogrula } from '@/lib/quality/uygunsuzluk-refs'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** GET /api/quality/uygunsuzluk/[id] — detay. Auth: oturum. Satırlar siraNo'ya göre sıralı. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { error } = await requireSession()
  if (error) return error
  const { id } = await params

  const kayit = await prisma.kaliteUygunsuzluk.findUnique({
    where: { id },
    include: {
      tespitEdenBolum: { select: { id: true, kod: true, ad: true } },
      sorumlu: { select: { adSoyad: true, sicilNo: true } },
      satirlar: {
        orderBy: { siraNo: 'asc' },
        include: {
          olusanBolum: { select: { id: true, kod: true, ad: true } },
          hataKodu: { select: { id: true, kod: true, ad: true } },
        },
      },
    },
  })
  if (!kayit) return NextResponse.json({ error: 'Uygunsuzluk kaydı bulunamadı' }, { status: 404 })

  return NextResponse.json({ ...kayit, durum: kayit.kapanisTarihi ? 'KAPALI' : 'ACIK' })
}

/**
 * PATCH /api/quality/uygunsuzluk/[id] — güncelle. Auth: canManageUygunsuzluk.
 * Satırlar TAM liste gelir → mevcutlar silinip yeniden yazılır (ekle/güncelle/sil tek işlemde).
 * `no` DEĞİŞTİRİLEMEZ — Zod şemasında yok, dokunulmaz.
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { session, userId, error } = await requireSession()
  if (error) return error
  if (!canManageUygunsuzluk(session)) {
    return NextResponse.json({ error: 'Uygunsuzluk kaydı düzenleme yetkiniz yok' }, { status: 403 })
  }
  const { id } = await params

  const mevcut = await prisma.kaliteUygunsuzluk.findUnique({ where: { id }, select: { id: true } })
  if (!mevcut) return NextResponse.json({ error: 'Uygunsuzluk kaydı bulunamadı' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const parsed = uygunsuzlukInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Geçersiz veri', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const d = parsed.data

  // Referans kısıtı — POST ile AYNI yardımcı (ıraksamasın)
  const refHatalari = await referanslariDogrula(d)
  if (refHatalari.length > 0) {
    return NextResponse.json(
      { error: refHatalari.map((h) => h.mesaj).join(' · '), refHatalari },
      { status: 400 },
    )
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Satır tam-liste replace: mevcutları sil, yenilerini yaz. `no` DOKUNULMAZ.
    await tx.kaliteUygunsuzlukSatir.deleteMany({ where: { uygunsuzlukId: id } })
    return tx.kaliteUygunsuzluk.update({
      where: { id },
      data: {
        tarih: d.tarih,
        mamulUrunKodu: d.mamulUrunKodu,
        isEmriNo: d.isEmriNo,
        isEmriAdeti: d.isEmriAdeti ?? null,
        tespitEdenBolumId: d.tespitEdenBolumId ?? null,
        kokNeden: d.kokNeden ?? null,
        duzelticiFaaliyet: d.duzelticiFaaliyet ?? null,
        sorumluId: d.sorumluId ?? null,
        termin: d.termin ?? null,
        kapanisTarihi: d.kapanisTarihi ?? null,
        guncelleyenId: userId,
        satirlar: {
          create: d.satirlar.map((s) => ({
            siraNo: s.siraNo,
            yariMamulKodu: s.yariMamulKodu ?? null,
            malzemeAdi: s.malzemeAdi ?? null,
            redAdeti: s.redAdeti,
            reworkAdedi: s.reworkAdedi ?? null,
            olusanBolumId: s.olusanBolumId ?? null,
            hataKoduId: s.hataKoduId ?? null,
            hataDetayi: s.hataDetayi ?? null,
            karar: s.karar ?? null,
          })),
        },
      },
      include: {
        satirlar: { orderBy: { siraNo: 'asc' } },
        tespitEdenBolum: { select: { kod: true, ad: true } },
      },
    })
  })

  return NextResponse.json({ ...updated, durum: updated.kapanisTarihi ? 'KAPALI' : 'ACIK' })
}

/** DELETE /api/quality/uygunsuzluk/[id] — sil. Auth: canManageUygunsuzluk. Satırlar cascade. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canManageUygunsuzluk(session)) {
    return NextResponse.json({ error: 'Uygunsuzluk kaydı silme yetkiniz yok' }, { status: 403 })
  }
  const { id } = await params

  const mevcut = await prisma.kaliteUygunsuzluk.findUnique({ where: { id }, select: { id: true } })
  if (!mevcut) return NextResponse.json({ error: 'Uygunsuzluk kaydı bulunamadı' }, { status: 404 })

  await prisma.kaliteUygunsuzluk.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

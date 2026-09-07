import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { canManageRma, benimPersonnelId, rmaMod } from '@/lib/quality/rma-access'
import { rmaKayitInput, rmaSorumluPatchInput } from '@/lib/quality/rma-validators'
import { sorumluAtamaBildirimiGonder } from '@/lib/quality/rma-bildirim'
import { fotoDosyasiniSil } from '@/lib/quality/rma-foto-dosya'

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
      fotolar: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!kayit) return NextResponse.json({ error: 'RMA kaydı bulunamadı' }, { status: 404 })

  // `durum` kolondan gelir — türetme YOK (bkz. 20260907120100_rma_durum).
  return NextResponse.json(kayit)
}

/**
 * PATCH /api/quality/rma/[id] — güncelle. `no` DEĞİŞTİRİLEMEZ.
 *
 * İKİ KOL (yetki kipi: lib/quality/rma-access.ts → rmaMod):
 *   full    → canManageRma. Satırlar TAM liste gelir → mevcutlar silinip yeniden
 *             yazılır (ekle/güncelle/sil tek işlemde).
 *   sorumlu → rma.manage'ı OLMAYAN ama kayda sorumlu atanmış kişi, kayıt AÇIK ise.
 *             YALNIZ satır bazında kokNeden + aksiyon güncellenir; başlık ve diğer
 *             satır alanları DOKUNULMAZ (satır silme/yeniden yazma YOK).
 *   ro      → 403.
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { session, userId, error } = await requireSession()
  if (error) return error
  const { id } = await params

  const mevcut = await prisma.rmaKayit.findUnique({
    where: { id },
    select: { id: true, sorumluId: true, durum: true },
  })
  if (!mevcut) return NextResponse.json({ error: 'RMA kaydı bulunamadı' }, { status: 404 })

  // canManageRma'da personnelId'ye gerek yok; yalnız sorumlu kolu için çözülür.
  const personnelId = canManageRma(session) ? null : await benimPersonnelId(userId)
  const mod = rmaMod(session, mevcut, personnelId)

  if (mod === 'ro') {
    // KAPALI kayıtta sorumlu da düzenleyemez — mesaj bunu ayırt eder.
    const kapaliSorumlu =
      mevcut.durum === 'KAPALI' && personnelId !== null && mevcut.sorumluId === personnelId
    return NextResponse.json(
      {
        error: kapaliSorumlu
          ? 'Kayıt KAPALI — kök neden ve aksiyon düzenlenemez'
          : 'RMA kaydı düzenleme yetkiniz yok',
      },
      { status: 403 },
    )
  }

  const body = await request.json().catch(() => null)

  // ── KOL 2: sorumlu — yalnız kokNeden + aksiyon ──
  if (mod === 'sorumlu') {
    const parsed = rmaSorumluPatchInput.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Geçersiz veri', issues: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const gelenSatirlar = parsed.data.satirlar

    // Satır id'leri BU kayda ait olmalı; değilse 400 (başka kaydın satırı yazılmasın).
    const kendiSatirIdleri = new Set(
      (
        await prisma.rmaSatir.findMany({ where: { rmaKayitId: id }, select: { id: true } })
      ).map((s) => s.id),
    )
    const yabanci = gelenSatirlar.filter((s) => !kendiSatirIdleri.has(s.id)).map((s) => s.id)
    if (yabanci.length > 0) {
      return NextResponse.json(
        { error: `Bu kayda ait olmayan satır id'si: ${yabanci.join(', ')}` },
        { status: 400 },
      )
    }

    const updated = await prisma.$transaction(async (tx) => {
      for (const s of gelenSatirlar) {
        await tx.rmaSatir.update({
          where: { id: s.id },
          data: { kokNeden: s.kokNeden, aksiyon: s.aksiyon },
        })
      }
      // Başlıkta YALNIZ audit damgası güncellenir.
      return tx.rmaKayit.update({
        where: { id },
        data: { guncelleyenId: userId },
        include: {
          satirlar: { orderBy: { siraNo: 'asc' } },
          musteri: { select: { name: true, code: true } },
        },
      })
    })

    return NextResponse.json(updated)
  }

  // ── KOL 1: full ──
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
        durum: d.durum,
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

  // Bildirim YALNIZ sorumlu DEĞİŞTİYSE — her düzenlemede aynı kişiye tekrar gitmesin
  // (emsal: visit-reports/aksiyon-bildirimi.ts → yeniVeyaDegisenAksiyonlar).
  if (updated.sorumluId && updated.sorumluId !== mevcut.sorumluId) {
    void sorumluAtamaBildirimiGonder(
      {
        id: updated.id,
        no: updated.no,
        tip: updated.tip,
        musteriAdi: updated.musteri?.name ?? null,
        termin: updated.termin,
      },
      updated.sorumluId,
    )
  }

  return NextResponse.json(updated)
}

/**
 * DELETE /api/quality/rma/[id] — sil. Auth: canManageRma.
 * Satırlar ve RmaFoto kayıtları cascade; fotoğrafların DİSK dosyaları burada
 * temizlenir (cascade diske dokunmaz). Silme hataları isteği bozmaz, loglanır.
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canManageRma(session)) {
    return NextResponse.json({ error: 'RMA kaydı silme yetkiniz yok' }, { status: 403 })
  }
  const { id } = await params

  const mevcut = await prisma.rmaKayit.findUnique({
    where: { id },
    select: { id: true, fotolar: { select: { dosyaYolu: true } } },
  })
  if (!mevcut) return NextResponse.json({ error: 'RMA kaydı bulunamadı' }, { status: 404 })

  await prisma.rmaKayit.delete({ where: { id } })

  for (const f of mevcut.fotolar) {
    const sonuc = await fotoDosyasiniSil(f.dosyaYolu)
    if (!sonuc.silindi && sonuc.sebep !== 'dosya-yok') {
      console.warn(`[rma-foto] kayıt silindi ama dosya silinemedi (${sonuc.sebep}):`, sonuc.detay ?? f.dosyaYolu)
    }
  }

  return NextResponse.json({ success: true })
}

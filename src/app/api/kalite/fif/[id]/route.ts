import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { fifKapsamindaMi, canManageFif } from '@/lib/quality/fif-access'
import { fifInput } from '@/lib/quality/fif-validators'
import { gecisYapabilirMi, hardDeleteEdilebilir } from '@/lib/quality/fif-durum'
import { FifDurum } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

/** GET /api/kalite/fif/[id] — detay. Auth: oturum (herkes okur). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { id } = await params


  const item = await prisma.fif.findUnique({
    where: { id },
    include: {
      sorumluBolum: { select: { id: true, name: true } },
      yayinlayanBolum: { select: { id: true, name: true } },
      faaliyetler: { orderBy: { sira: 'asc' } },
      kokNedenler: true,
      besNedenler: true,
      etkinlikler: true,
      ekler: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!item) return NextResponse.json({ error: 'FİF bulunamadı' }, { status: 404 })
  if (!(await fifKapsamindaMi(session, item))) {
    return NextResponse.json({ error: 'Bu FİF kapsamınızda değil' }, { status: 403 })
  }
  return NextResponse.json({ item })
}

/**
 * PUT /api/kalite/fif/[id] — güncelle. Auth: kapsam (kendi/hazırlayan/bölüm; manage tümü).
 * Faz 1: başlık alanları + faaliyet/kök neden/5 neden/etkinlik listeleri
 * yerinde değiştirilir (deleteMany + create). kayitNo/durum bu uçtan DEĞİŞMEZ
 * (durum geçişleri Faz 2). İPTAL için DELETE kullanılır.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { id } = await params

  const mevcut = await prisma.fif.findUnique({
    where: { id },
    select: { id: true, durum: true, createdById: true, hazirlayanUserId: true, sorumluBolumId: true, yayinlayanBolumId: true },
  })
  if (!mevcut) return NextResponse.json({ error: 'FİF bulunamadı' }, { status: 404 })
  if (!(await fifKapsamindaMi(session, mevcut))) {
    return NextResponse.json({ error: 'Bu FİF kapsamınızda değil' }, { status: 403 })
  }
  if (mevcut.durum === FifDurum.IPTAL) {
    return NextResponse.json({ error: 'İptal edilmiş FİF düzenlenemez' }, { status: 409 })
  }

  const body = await request.json().catch(() => null)
  const parsed = fifInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz veri', issues: parsed.error.flatten() }, { status: 400 })
  }
  const d = parsed.data

  const updated = await prisma.$transaction(async (tx) => {
    await tx.fif.update({
      where: { id },
      data: {
        tur: d.tur,
        tarih: d.tarih ?? undefined,
        sorumluBolumId: d.sorumluBolumId ?? null,
        yayinlayanBolumId: d.yayinlayanBolumId ?? null,
        hazirlayanUserId: d.hazirlayanUserId ?? null,
        izlemeSorumlusuUserId: d.izlemeSorumlusuUserId ?? null,
        sorumluOnaylayanUserId: d.sorumluOnaylayanUserId ?? null,
        yayinlayanOnaylayanUserId: d.yayinlayanOnaylayanUserId ?? null,
        uygulamaSorumlusuUserId: d.uygulamaSorumlusuUserId ?? null,
        takipSorumlusuUserId: d.takipSorumlusuUserId ?? null,
        denetlemeAdi: d.denetlemeAdi ?? null,
        uygunsuzlukTanimi: d.uygunsuzlukTanimi ?? null,
        standartMadde: d.standartMadde ?? null,
        ekTerminNedeni: d.ekTerminNedeni ?? null,
        kokNedenAnalizi: d.kokNedenAnalizi ?? null,
        kapatmaTarihi: d.kapatmaTarihi ?? null,
        kysDegisikligi: d.kysDegisikligi ?? false,
        riskFirsatGuncelleme: d.riskFirsatGuncelleme ?? false,
        ogrenilenDers: d.ogrenilenDers ?? false,
      },
    })

    // Alt listeler verildiyse yerinde değiştir (undefined = dokunma).
    if (d.faaliyetler) {
      await tx.fifFaaliyet.deleteMany({ where: { fifId: id } })
      if (d.faaliyetler.length) {
        await tx.fifFaaliyet.createMany({
          data: d.faaliyetler.map((f) => ({
            fifId: id, sira: f.sira, aciklama: f.aciklama,
            hedefTarih: f.hedefTarih ?? null, gerceklesenTarih: f.gerceklesenTarih ?? null,
            sonuc: f.sonuc ?? null, parafUserId: f.parafUserId ?? null, parafTarihi: f.parafTarihi ?? null,
          })),
        })
      }
    }
    if (d.kokNedenler) {
      await tx.fifKokNeden.deleteMany({ where: { fifId: id } })
      if (d.kokNedenler.length) {
        await tx.fifKokNeden.createMany({ data: d.kokNedenler.map((k) => ({ fifId: id, kategori: k.kategori, aciklama: k.aciklama })) })
      }
    }
    if (d.besNedenler) {
      await tx.fifBesNeden.deleteMany({ where: { fifId: id } })
      if (d.besNedenler.length) {
        await tx.fifBesNeden.createMany({ data: d.besNedenler.map((b) => ({
          fifId: id, muhtemelSebep: b.muhtemelSebep,
          neden1: b.neden1 ?? null, neden2: b.neden2 ?? null, neden3: b.neden3 ?? null,
          neden4: b.neden4 ?? null, neden5: b.neden5 ?? null,
        })) })
      }
    }
    if (d.etkinlikler) {
      await tx.fifEtkinlik.deleteMany({ where: { fifId: id } })
      if (d.etkinlikler.length) {
        await tx.fifEtkinlik.createMany({ data: d.etkinlikler.map((e) => ({
          fifId: id, madde: e.madde, planlananTarih: e.planlananTarih ?? null,
          gerceklesenTarih: e.gerceklesenTarih ?? null, uygun: e.uygun ?? null,
          onayUserId: e.onayUserId ?? null, onayTarihi: e.onayTarihi ?? null,
        })) })
      }
    }

    return tx.fif.findUnique({
      where: { id },
      include: { faaliyetler: { orderBy: { sira: 'asc' } }, kokNedenler: true, besNedenler: true, etkinlikler: true },
    })
  })

  return NextResponse.json({ item: updated })
}

/** DELETE /api/kalite/fif/[id] — İPTAL (soft). Auth: kapsam. Kayıt silinmez. */
/**
 * DELETE — TASLAK + alt kaydı YOK ise HARD DELETE (kayıt tamamen silinir; kayıt no
 * boşluğu kabul — o numara bir daha kullanılmaz). Aksi hâlde soft IPTAL.
 * Yetki: kapsam (hazırlayan/manage). Kalite/geçmiş için IPTAL akışı gecisYapabilirMi
 * ile korunur.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { id } = await params
  const mevcut = await prisma.fif.findUnique({
    where: { id },
    select: {
      id: true, durum: true, createdById: true, hazirlayanUserId: true, sorumluBolumId: true, yayinlayanBolumId: true,
      _count: { select: { faaliyetler: true, etkinlikler: true, kokNedenler: true, besNedenler: true, ekler: true } },
    },
  })
  if (!mevcut) return NextResponse.json({ error: 'FİF bulunamadı' }, { status: 404 })
  if (!(await fifKapsamindaMi(session, mevcut))) {
    return NextResponse.json({ error: 'Bu FİF kapsamınızda değil' }, { status: 403 })
  }

  const altKayitVar =
    mevcut._count.faaliyetler + mevcut._count.etkinlikler + mevcut._count.kokNedenler +
    mevcut._count.besNedenler + mevcut._count.ekler > 0

  // Boş TASLAK → hard delete (FifGecmis cascade siler).
  if (hardDeleteEdilebilir(mevcut.durum, altKayitVar)) {
    await prisma.fif.delete({ where: { id } })
    return NextResponse.json({ ok: true, silindi: 'hard' })
  }

  // Aksi hâlde IPTAL (kalite izi korunur). gecisYapabilirMi ile yetki teyidi.
  const iptal = gecisYapabilirMi(
    { userId: session.user.id, isManage: canManageFif(session), sorumluBolumMudurUserId: null },
    { durum: mevcut.durum, createdById: mevcut.createdById, hazirlayanUserId: mevcut.hazirlayanUserId,
      yayinlayanOnaylayanUserId: null, sorumluOnaylayanUserId: null, izlemeSorumlusuUserId: null,
      takipSorumlusuUserId: null, sorumluBolumId: mevcut.sorumluBolumId, uygunsuzlukTanimi: null, tur: null,
      faaliyetler: [], etkinlikler: [] },
    FifDurum.IPTAL,
  )
  if (!iptal.ok) return NextResponse.json({ error: iptal.sebep }, { status: 403 })

  await prisma.$transaction(async (tx) => {
    await tx.fif.update({ where: { id }, data: { durum: FifDurum.IPTAL } })
    await tx.fifGecmis.create({ data: { fifId: id, eskiDurum: mevcut.durum, yeniDurum: FifDurum.IPTAL, userId: session.user.id, aciklama: 'İptal (silme talebi — alt kayıt mevcut)' } })
  })
  return NextResponse.json({ ok: true, silindi: 'iptal' })
}

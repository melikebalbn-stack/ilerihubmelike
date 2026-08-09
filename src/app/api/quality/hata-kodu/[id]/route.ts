import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { canManageHataKodu } from '@/lib/quality/hata-kodu-access'
import { hataKoduUpdateInput } from '@/lib/quality/hata-kodu-validators'
import { dongruOlusurMu, hataKoduSelect } from '@/lib/quality/hata-kodu-tree'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Kod kullanımda mı?
 *
 * ⚠ Hata GİRİŞ tablosu henüz YOK (PR-2 kapsamı) → şu an her zaman 0 döner ve
 *   pratikte yalnız "altı var mı" kontrolü silmeyi engeller. Giriş tablosu
 *   eklendiğinde sayım BURAYA eklenecek — DELETE mantığı değişmez.
 */
async function kullanimSayisi(_id: string): Promise<number> {
  return 0
}

/** GET /api/quality/hata-kodu/[id] — detay + doğrudan altları. Auth: oturum. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { error } = await requireSession()
  if (error) return error
  const { id } = await params

  const kayit = await prisma.hataKodu.findUnique({
    where: { id },
    select: {
      ...hataKoduSelect,
      ust: { select: { id: true, kod: true, ad: true } },
      altlar: { orderBy: [{ siraNo: 'asc' }, { kod: 'asc' }], select: hataKoduSelect },
    },
  })
  if (!kayit) return NextResponse.json({ error: 'Hata kodu bulunamadı' }, { status: 404 })

  return NextResponse.json(kayit)
}

/**
 * PATCH /api/quality/hata-kodu/[id] — güncelle. Auth: canManageHataKodu.
 *
 * Güncellenebilir: ad, aktif, siraNo, aciklama, ustKodId.
 * `kod` DEĞİŞTİRİLEMEZ — Zod şemasında yok, istekte gelirse yok sayılır
 * (873 geçmiş kayıt kod değerine bağlı).
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canManageHataKodu(session)) {
    return NextResponse.json({ error: 'Hata kodu düzenleme yetkiniz yok' }, { status: 403 })
  }
  const { id } = await params

  const mevcut = await prisma.hataKodu.findUnique({ where: { id }, select: { id: true } })
  if (!mevcut) return NextResponse.json({ error: 'Hata kodu bulunamadı' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const parsed = hataKoduUpdateInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Geçersiz veri', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const d = parsed.data

  if (d.ustKodId !== undefined && d.ustKodId !== null) {
    if (d.ustKodId === id) {
      return NextResponse.json({ error: 'Bir kod kendi üst kodu olamaz' }, { status: 400 })
    }
    const ust = await prisma.hataKodu.findUnique({ where: { id: d.ustKodId }, select: { id: true } })
    if (!ust) return NextResponse.json({ error: 'Üst kod bulunamadı' }, { status: 400 })

    if (await dongruOlusurMu(id, d.ustKodId)) {
      return NextResponse.json(
        { error: 'Bir kod kendi alt ağacındaki bir koda bağlanamaz' },
        { status: 400 },
      )
    }
  }

  const updated = await prisma.hataKodu.update({
    where: { id },
    data: {
      ...(d.ad !== undefined && { ad: d.ad }),
      ...(d.ustKodId !== undefined && { ustKodId: d.ustKodId }),
      ...(d.aktif !== undefined && { aktif: d.aktif }),
      ...(d.siraNo !== undefined && { siraNo: d.siraNo }),
      ...(d.aciklama !== undefined && { aciklama: d.aciklama }),
    },
    select: hataKoduSelect,
  })

  return NextResponse.json(updated)
}

/**
 * DELETE /api/quality/hata-kodu/[id] — sil. Auth: canManageHataKodu.
 *
 * YALNIZCA hiç kullanılmamış VE alt kodu olmayan kayıt silinebilir.
 * Aksi halde 409 → "aktif=false yapın" (kod değerleri geçmiş kayıtlara bağlı, silme YOK).
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canManageHataKodu(session)) {
    return NextResponse.json({ error: 'Hata kodu silme yetkiniz yok' }, { status: 403 })
  }
  const { id } = await params

  const mevcut = await prisma.hataKodu.findUnique({
    where: { id },
    select: { id: true, _count: { select: { altlar: true } } },
  })
  if (!mevcut) return NextResponse.json({ error: 'Hata kodu bulunamadı' }, { status: 404 })

  if (mevcut._count.altlar > 0) {
    return NextResponse.json(
      {
        error: `Bu kodun ${mevcut._count.altlar} alt kodu var, silinemez. Kullanımdan kaldırmak için aktif=false yapın.`,
      },
      { status: 409 },
    )
  }

  const kullanim = await kullanimSayisi(id)
  if (kullanim > 0) {
    return NextResponse.json(
      {
        error: `Bu kod ${kullanim} kayıtta kullanılmış, silinemez. Kullanımdan kaldırmak için aktif=false yapın.`,
      },
      { status: 409 },
    )
  }

  await prisma.hataKodu.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

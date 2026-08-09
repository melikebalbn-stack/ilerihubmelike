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
 * ⚠ ŞU AN ÇAĞRILMIYOR — silme tamamen kapalı (aşağıdaki DELETE'e bak).
 *
 * Hata GİRİŞ tablosu henüz YOK, o yüzden bu fonksiyon her zaman 0 döner.
 * Hiyerarşi geri geldiği için "altı var mı" kontrolü ve FK Restrict yeniden
 * devrede, ama 873 geçmiş kayıt bu kodlara bağlanacağı için silme yine de
 * tamamen kapalı tutuluyor.
 *
 * TODO: Hata giriş tablosu eklendiğinde:
 *   1) buraya gerçek sayımı yaz (prisma.<girisTablosu>.count({ where: { hataKoduId: _id } }))
 *   2) DELETE'teki koşulsuz 409 bloğunu kaldır, altındaki kontrolleri geri aç.
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
 * `tip` de DEĞİŞTİRİLEMEZ — aynı şekilde şemada yok, gövdede gelse bile
 * yok sayılır. Tür değişimi hiyerarşiyi bozar (BOLUM→KOD olan bir kaydın
 * altları sahipsiz kalır); ayrı bir iş olarak ele alınacak.
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
 * DELETE /api/quality/hata-kodu/[id] — KAPALI, koşulsuz 409.
 *
 * Neden: 873 geçmiş kalite kaydı bu kodlara bağlanacak; silinen kod veri kaybı demek.
 * Hiyerarşi geri geldiği için FK Restrict ve "altı var mı" kontrolü tekrar mümkün,
 * ama `kullanimSayisi()` (hata giriş tablosu henüz yok) hep 0 döndüğü sürece
 * kullanımda olan bir kodu ayırt edemiyoruz — o yüzden silme tümden kapalı.
 *
 * Geri açma: yukarıdaki `kullanimSayisi()` TODO'sunu uygula, sonra bu bloğun
 * altındaki kontrolleri aç.
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canManageHataKodu(session)) {
    return NextResponse.json({ error: 'Hata kodu silme yetkiniz yok' }, { status: 403 })
  }
  const { id } = await params

  const mevcut = await prisma.hataKodu.findUnique({ where: { id }, select: { id: true } })
  if (!mevcut) return NextResponse.json({ error: 'Hata kodu bulunamadı' }, { status: 404 })

  return NextResponse.json(
    { error: 'Hata kodu silinemez. Kullanılmayan kodları pasif yapın.' },
    { status: 409 },
  )

  /* Hata giriş tablosu geldiğinde geri açılacak:
  const detay = await prisma.hataKodu.findUnique({
    where: { id },
    select: { id: true, _count: { select: { altlar: true } } },
  })
  if (detay && detay._count.altlar > 0) {
    return NextResponse.json(
      {
        error: `Bu kodun ${detay._count.altlar} alt kodu var, silinemez. Kullanımdan kaldırmak için aktif=false yapın.`,
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
  */
}

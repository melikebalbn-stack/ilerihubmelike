import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { canManageHataKodu } from '@/lib/quality/hata-kodu-access'
import { hataKoduUpdateInput } from '@/lib/quality/hata-kodu-validators'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Kod kullanımda mı?
 *
 * ⚠ ŞU AN ÇAĞRILMIYOR — silme tamamen kapalı (aşağıdaki DELETE'e bak).
 *
 * Hata GİRİŞ tablosu henüz YOK, o yüzden bu fonksiyon her zaman 0 döner.
 * Hiyerarşi kaldırılınca "altı var mı" kontrolü ve DB tarafındaki FK Restrict
 * emniyeti de düştü; 0 dönen bir sayımla silmeyi açık bırakmak, 873 geçmiş
 * kaydın bağlanacağı kodların silinebilmesi demekti.
 *
 * TODO: Hata giriş tablosu eklendiğinde:
 *   1) buraya gerçek sayımı yaz (prisma.<girisTablosu>.count({ where: { hataKoduId: _id } }))
 *   2) DELETE'teki koşulsuz 409 bloğunu kaldır, altındaki kullanım kontrolünü geri aç.
 */
async function kullanimSayisi(_id: string): Promise<number> {
  return 0
}

/** GET /api/quality/hata-kodu/[id] — detay. Auth: oturum. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { error } = await requireSession()
  if (error) return error
  const { id } = await params

  const kayit = await prisma.hataKodu.findUnique({ where: { id } })
  if (!kayit) return NextResponse.json({ error: 'Hata kodu bulunamadı' }, { status: 404 })

  return NextResponse.json(kayit)
}

/**
 * PATCH /api/quality/hata-kodu/[id] — güncelle. Auth: canManageHataKodu.
 *
 * Güncellenebilir: ad, aktif, siraNo, aciklama.
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

  const updated = await prisma.hataKodu.update({
    where: { id },
    data: {
      ...(d.ad !== undefined && { ad: d.ad }),
      ...(d.aktif !== undefined && { aktif: d.aktif }),
      ...(d.siraNo !== undefined && { siraNo: d.siraNo }),
      ...(d.aciklama !== undefined && { aciklama: d.aciklama }),
    },
  })

  return NextResponse.json(updated)
}

/**
 * DELETE /api/quality/hata-kodu/[id] — GEÇİCİ OLARAK KAPALI, koşulsuz 409.
 *
 * Neden: 873 geçmiş kalite kaydı bu kodlara bağlanacak. Hiyerarşi kaldırılınca
 * FK Restrict koruması düştü ve `kullanimSayisi()` (hata giriş tablosu henüz yok)
 * her zaman 0 döndüğü için silmeyi engelleyen hiçbir kapı kalmamıştı — silinen
 * bir kod doğrudan veri kaybı demek.
 *
 * Geri açma: yukarıdaki `kullanimSayisi()` TODO'sunu uygula, sonra bu bloğun
 * altındaki kullanım kontrolünü aç.
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

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { Prisma } from '@/generated/prisma'
import { YAZILIM_KOK_ADI } from '@/lib/zimmet/tur'

export const dynamic = 'force-dynamic'

// "Yazılım" kökü kod genelinde (tur.ts, useZimmetFormu.ts, ZimmetFormuStep1,
// ZimmetListesi) TAM AD EŞLEŞMESİYLE özel işleniyor - silinir veya yeniden
// adlandırılırsa o mantığın tamamı kırılır. İstemci (TanimCombobox) zaten
// bu satır için ikon göstermiyor ama bu SADECE UI - API'yi doğrudan çağıran
// biri (veya ileride bir bug) bu korumayı atlamasın diye sunucu tarafında da
// engelleniyor.
async function yazilimKokuMu(id: string): Promise<boolean> {
  const kayit = await prisma.zimmetTanim.findUnique({
    where: { id },
    select: { ad: true, parentId: true },
  })
  return kayit?.parentId === null && kayit.ad === YAZILIM_KOK_ADI
}

// PATCH - ad, aktif, sira alanlarından gönderilenleri günceller. Yetki:
// zimmet-formu.view (IT/admin tier).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error } = await requirePermission('zimmet-formu.view')
    if (error) return error

    const { id } = await params
    const body = await request.json().catch(() => ({}))

    const data: { ad?: string; aktif?: boolean; sira?: number } = {}
    if (typeof body.ad === 'string') {
      const ad = body.ad.trim()
      if (!ad) {
        return NextResponse.json({ error: 'Ad boş olamaz' }, { status: 400 })
      }
      data.ad = ad
    }
    if ((data.ad || data.aktif === false) && (await yazilimKokuMu(id))) {
      return NextResponse.json(
        { error: '"Yazılım" kökü yeniden adlandırılamaz veya pasife alınamaz' },
        { status: 409 },
      )
    }
    if (typeof body.aktif === 'boolean') {
      data.aktif = body.aktif
    }
    if (typeof body.sira === 'number' && Number.isFinite(body.sira)) {
      data.sira = body.sira
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Güncellenecek alan gönderilmedi' }, { status: 400 })
    }

    const guncellendi = await prisma.zimmetTanim.update({ where: { id }, data })
    return NextResponse.json(guncellendi)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'Bu ad zaten tanımlı' }, { status: 409 })
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Tanım bulunamadı' }, { status: 404 })
    }
    console.error('[PATCH /api/zimmet-formu/tanim/[id]]', err)
    return NextResponse.json({ error: 'Tanım güncellenemedi' }, { status: 500 })
  }
}

// DELETE - gerçek silme YOK, aktif=false (soft-delete). Silinen bir TÜR (kök,
// parentId=null) ise, aktif çocukları da CASCADE soft-delete edilir - aksi
// halde tür dropdown'dan kaybolduktan sonra o türün alt-dallarına ulaşacak
// başka hiçbir arayüz kalmaz (ayrı bir "hepsini yönet" ekranı yok), yani
// sonsuza dek aktif ama erişilemez/yönetilemez kalırlardı. Yanıtta kaç
// çocuğun da pasife alındığı dönülür - istemci toast'ta bunu bildirir.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error } = await requirePermission('zimmet-formu.view')
    if (error) return error

    const { id } = await params

    if (await yazilimKokuMu(id)) {
      return NextResponse.json({ error: '"Yazılım" kökü silinemez' }, { status: 409 })
    }

    const sonuc = await prisma.$transaction(async (tx) => {
      const hedef = await tx.zimmetTanim.findUniqueOrThrow({ where: { id } })

      let etkilenenCocukSayisi = 0
      if (hedef.parentId === null) {
        const cocuklar = await tx.zimmetTanim.updateMany({
          where: { parentId: id, aktif: true },
          data: { aktif: false },
        })
        etkilenenCocukSayisi = cocuklar.count
      }

      const guncellendi = await tx.zimmetTanim.update({
        where: { id },
        data: { aktif: false },
      })

      return { ...guncellendi, etkilenenCocukSayisi }
    })

    return NextResponse.json(sonuc)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Tanım bulunamadı' }, { status: 404 })
    }
    console.error('[DELETE /api/zimmet-formu/tanim/[id]]', err)
    return NextResponse.json({ error: 'Tanım silinemedi' }, { status: 500 })
  }
}

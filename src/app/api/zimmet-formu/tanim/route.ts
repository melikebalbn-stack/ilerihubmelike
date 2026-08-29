import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { Prisma } from '@/generated/prisma'
import { ZIMMET_TUR_SECENEKLERI } from '@/lib/zimmet/tur'
import { esitlikIcinNormalize } from '@/lib/zimmet/arama'

export const dynamic = 'force-dynamic'

// Kök seviyede (parentId=null, yani YENİ BİR TÜR eklerken) rezerve edilmiş
// adlar - bunlarla çakışırsa turDiger'ın "TürAdı[· AltDal]" formatı (bkz.
// tur.ts ozelTurKaydi) ile sistemin zaten özel anlam yüklediği isimler
// (Office 365, Diğer, sabit donanım türleri) birbirine karışır. Alt-dal
// seviyesinde (parentId dolu) bu kısıtlama YOK - "Office 365" zaten Yazılım
// kökünün gerçek bir çocuğu.
const KOK_REZERVE_ADLAR = [...ZIMMET_TUR_SECENEKLERI, 'Office 365', 'Diğer'].map(esitlikIcinNormalize)

// GET - Tür (kök, parentId=null) veya alt-dal (parentId=<id>) listesi.
// ?parentId=null (veya parametre hiç verilmezse) → kök seviyesi (tür
// dropdown'unun DB'den gelen kısmı - sabit 5 donanım türü + "Yazılım" ayrıca
// istemci tarafında ekleniyor, bkz. TanimCombobox.tsx).
// ?parentId=<id> → o tanımın alt-dalları (ör. Yazılım kökünün id'si → 8+
// yazılım adı).
// Yetki: zimmet-formu.create (form dolduran herkes okuyabilsin).
export async function GET(request: NextRequest) {
  try {
    const { error } = await requirePermission('zimmet-formu.create')
    if (error) return error

    const parentIdParam = new URL(request.url).searchParams.get('parentId')
    const parentId = !parentIdParam || parentIdParam === 'null' ? null : parentIdParam

    const liste = await prisma.zimmetTanim.findMany({
      where: { parentId, aktif: true },
      orderBy: [{ sira: 'asc' }, { ad: 'asc' }],
    })
    return NextResponse.json(liste)
  } catch (err) {
    console.error('[GET /api/zimmet-formu/tanim]', err)
    return NextResponse.json({ error: 'Tanım listesi yüklenemedi' }, { status: 500 })
  }
}

// POST - Yeni tür (parentId yok/null) veya alt-dal (parentId dolu) ekler.
// Aynı parent altında ad benzersiz olmalı (@@unique([ad, parentId])).
// Yetki: zimmet-formu.view (IT/admin tier - Düzenle/Sil ile AYNI, bkz.
// [id]/route.ts).
export async function POST(request: NextRequest) {
  try {
    const { error } = await requirePermission('zimmet-formu.view')
    if (error) return error

    const body = await request.json().catch(() => ({}))
    const ad = typeof body?.ad === 'string' ? body.ad.trim() : ''
    if (!ad) {
      return NextResponse.json({ error: 'Ad zorunlu' }, { status: 400 })
    }
    const parentId = typeof body?.parentId === 'string' ? body.parentId : null

    if (parentId === null && KOK_REZERVE_ADLAR.includes(esitlikIcinNormalize(ad))) {
      return NextResponse.json(
        { error: 'Bu ad sistem tarafından rezerve edilmiş, farklı bir ad seçin' },
        { status: 409 },
      )
    }

    const yeni = await prisma.zimmetTanim.create({ data: { ad, parentId } })
    return NextResponse.json(yeni, { status: 201 })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'Bu ad zaten tanımlı' }, { status: 409 })
    }
    console.error('[POST /api/zimmet-formu/tanim]', err)
    return NextResponse.json({ error: 'Tanım eklenemedi' }, { status: 500 })
  }
}

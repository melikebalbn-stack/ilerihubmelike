import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { fifKaynakYonetebilirMi, ayniKaynakAdiVarMi } from '@/lib/quality/fif-kaynak'
import { fifKaynakInput, fifKaynakGuncelleInput } from '@/lib/quality/fif-validators'
import { Prisma } from '@/generated/prisma'

export const dynamic = 'force-dynamic'

const SIRALAMA = [{ sira: 'asc' as const }, { ad: 'asc' as const }]
const SECIM = { id: true, ad: true, aktif: true, sira: true } as const

/** Unique (ad) ihlali — normalize kontrolünü geçen eşzamanlı istek için ikinci bekçi. */
function ayniAdHatasi(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
}

/**
 * GET /api/kalite/fif/kaynak — FİF kaynak listesi (Paket 3).
 * Herkes: yalnız AKTİF kaynaklar (form seçimi). KSS/manage: tümü (yönetim ekranı).
 */
export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error
  const yonetici = (await fifKaynakYonetebilirMi(session))
  const kaynaklar = await prisma.fifKaynak.findMany({
    where: yonetici ? {} : { aktif: true },
    orderBy: SIRALAMA,
    select: SECIM,
  })
  return NextResponse.json({ kaynaklar, yonetici })
}

/** POST — yeni kaynak. Yalnız KSS/manage. Aynı ad (Türkçe normalize) reddedilir. */
export async function POST(request: NextRequest) {
  const { session, userId, error } = await requireSession()
  if (error) return error
  if (!(await fifKaynakYonetebilirMi(session))) return NextResponse.json({ error: 'Kaynak yönetme yetkiniz yok' }, { status: 403 })

  const parsed = fifKaynakInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz veri', issues: parsed.error.flatten() }, { status: 400 })
  const { ad, sira } = parsed.data

  const mevcut = await prisma.fifKaynak.findMany({ select: { id: true, ad: true } })
  if (ayniKaynakAdiVarMi(ad, mevcut)) return NextResponse.json({ error: 'Bu adla bir kaynak zaten var' }, { status: 409 })

  try {
    const kaynak = await prisma.fifKaynak.create({
      data: { ad, sira: sira ?? 0, createdById: userId },
      select: SECIM,
    })
    return NextResponse.json({ kaynak }, { status: 201 })
  } catch (e) {
    if (ayniAdHatasi(e)) return NextResponse.json({ error: 'Bu adla bir kaynak zaten var' }, { status: 409 })
    throw e
  }
}

/**
 * PATCH — ad / aktif / sıra güncelle. Yalnız KSS/manage. SİLME YOK: kaynak
 * pasife alınır (geçmiş FİF'lerin kaynağı kaybolmasın).
 */
export async function PATCH(request: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!(await fifKaynakYonetebilirMi(session))) return NextResponse.json({ error: 'Kaynak yönetme yetkiniz yok' }, { status: 403 })

  const parsed = fifKaynakGuncelleInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz veri', issues: parsed.error.flatten() }, { status: 400 })
  const { id, ad, aktif, sira } = parsed.data

  const mevcut = await prisma.fifKaynak.findMany({ select: { id: true, ad: true } })
  if (!mevcut.some((k) => k.id === id)) return NextResponse.json({ error: 'Kaynak bulunamadı' }, { status: 404 })
  if (ad !== undefined && ayniKaynakAdiVarMi(ad, mevcut, id)) {
    return NextResponse.json({ error: 'Bu adla bir kaynak zaten var' }, { status: 409 })
  }

  try {
    const kaynak = await prisma.fifKaynak.update({
      where: { id },
      data: {
        ...(ad !== undefined ? { ad } : {}),
        ...(aktif !== undefined ? { aktif } : {}),
        ...(sira !== undefined ? { sira } : {}),
      },
      select: SECIM,
    })
    return NextResponse.json({ kaynak })
  } catch (e) {
    if (ayniAdHatasi(e)) return NextResponse.json({ error: 'Bu adla bir kaynak zaten var' }, { status: 409 })
    throw e
  }
}

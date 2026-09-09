import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { prisma } from '@/lib/prisma'
import { donemKilidiKontrol } from '@/lib/avans/donem-kilidi'

export const dynamic = 'force-dynamic'

/**
 * Beyaz yaka kendi avans talebini kendi hesabıyla girer.
 * Onay akışı yok. sorumluId = kendisi, bolum = kendi bölümü, tek satır.
 * Aynı (kendisi + bölüm + dönem) için ikinci gönderimde üzerine yazar (upsert).
 */

// aktif=false (işten ayrılmış) personel avans talebi giremez — hâlâ oturum
// açabiliyor olsa bile. bkz. avans-formu-helpers.ts PERSONEL_PASIF ile aynı kural.
async function kendiPersonelKaydi(userId: string) {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { personnelId: true },
  })
  if (!dbUser?.personnelId) return null
  const personel = await prisma.personnel.findUnique({ where: { id: dbUser.personnelId } })
  return personel?.aktif ? personel : null
}

export async function GET() {
  const { user, error } = await requireUser()
  if (error) return error

  const personel = await kendiPersonelKaydi(user.id)

  if (!personel) {
    return NextResponse.json(
      { error: 'Bu kullanıcıya bağlı, aktif bir personel kaydı bulunamadı.' },
      { status: 404 }
    )
  }
  if (!personel.bolum) {
    return NextResponse.json(
      { error: 'Personel kaydınızda bölüm bilgisi tanımlı değil.' },
      { status: 400 }
    )
  }

  const now = new Date()
  const donemYil = now.getFullYear()
  const donemAy = now.getMonth() + 1

  const mevcutTalep = await prisma.avansTalebi.findUnique({
    where: {
      sorumluId_bolum_donemYil_donemAy: {
        sorumluId: personel.id,
        bolum: personel.bolum,
        donemYil,
        donemAy,
      },
    },
    include: { satirlar: true },
  })

  return NextResponse.json({
    personel: {
      id: personel.id,
      adSoyad: personel.adSoyad,
      bolum: personel.bolum,
      gorev: personel.gorev ?? null,
    },
    donemYil,
    donemAy,
    mevcutSecim: mevcutTalep?.satirlar[0]?.avansIstiyorMu ?? null,
  })
}

type PostBody = { donemYil: number; donemAy: number; avansIstiyorMu: boolean }

function gecerliBody(body: unknown): body is PostBody {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  return (
    typeof b.donemYil === 'number' &&
    typeof b.donemAy === 'number' &&
    typeof b.avansIstiyorMu === 'boolean'
  )
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  const body: unknown = await request.json().catch(() => null)
  if (!gecerliBody(body)) {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 })
  }

  const kilit = await donemKilidiKontrol(body.donemYil, body.donemAy)
  if (kilit) return kilit

  const personel = await kendiPersonelKaydi(user.id)

  if (!personel) {
    return NextResponse.json(
      { error: 'Bu kullanıcıya bağlı, aktif bir personel kaydı bulunamadı.' },
      { status: 404 }
    )
  }
  if (!personel.bolum) {
    return NextResponse.json(
      { error: 'Personel kaydınızda bölüm bilgisi tanımlı değil.' },
      { status: 400 }
    )
  }

  const avansTalebi = await prisma.avansTalebi.upsert({
    where: {
      sorumluId_bolum_donemYil_donemAy: {
        sorumluId: personel.id,
        bolum: personel.bolum,
        donemYil: body.donemYil,
        donemAy: body.donemAy,
      },
    },
    create: {
      sorumluId: personel.id,
      bolum: personel.bolum,
      donemYil: body.donemYil,
      donemAy: body.donemAy,
    },
    // Bos update: {} Prisma'da hicbir UPDATE sorgusu tetiklemez, @updatedAt
    // bump olmaz - duzeltme izinin kaybolmamasi icin aciktan set ediliyor.
    update: { updatedAt: new Date() },
  })

  await prisma.avansTalebiSatiri.deleteMany({
    where: { avansTalebiId: avansTalebi.id },
  })
  await prisma.avansTalebiSatiri.create({
    data: {
      avansTalebiId: avansTalebi.id,
      calisanId: personel.id,
      avansIstiyorMu: body.avansIstiyorMu,
    },
  })

  return NextResponse.json({ success: true, avansTalebiId: avansTalebi.id })
}

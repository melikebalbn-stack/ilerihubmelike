import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { canAccessSandbox } from '@/lib/sandbox-config'
import { prisma } from '@/lib/prisma'
import { donemKilidiKontrol } from '@/lib/avans/donem-kilidi'
import { isSandboxOwner } from '../_lib/avans-formu-helpers'

export const dynamic = 'force-dynamic'

const IK_MANUEL_SORUMLU_ID = 'IK_MANUEL'

/**
 * GET: Avans isteyen personel listesi (İK için).
 * AvansTalebiSatiri.avansIstiyorMu = true olan satırları, sorumlu/bölüm/dönem
 * bilgisiyle birlikte düzleştirip döner. sorumluId/calisanId Personnel'e FK
 * olmadığı için (bkz. SCHEMA-DIFF-MELIH.md) isimler ayrı bir sorguyla map'lenir.
 */
export async function GET(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  if (!canAccessSandbox('nurgul', user.email, user.role)) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
  }
  if (user.role !== 'HR_MANAGER' && user.role !== 'SUPER_ADMIN' && !isSandboxOwner(user.email)) {
    return NextResponse.json({ error: 'Bu ekrana sadece İK erişebilir.' }, { status: 403 })
  }

  const searchParams = new URL(request.url).searchParams
  const donemYil = searchParams.get('donemYil')
  const donemAy = searchParams.get('donemAy')

  const talepler = await prisma.avansTalebi.findMany({
    where: {
      ...(donemYil ? { donemYil: Number(donemYil) } : {}),
      ...(donemAy ? { donemAy: Number(donemAy) } : {}),
    },
    include: { satirlar: { where: { avansIstiyorMu: true } } },
    orderBy: [{ donemYil: 'desc' }, { donemAy: 'desc' }, { bolum: 'asc' }],
  })

  const idSeti = new Set<string>()
  for (const t of talepler) {
    if (t.sorumluId !== IK_MANUEL_SORUMLU_ID) idSeti.add(t.sorumluId)
    for (const s of t.satirlar) idSeti.add(s.calisanId)
  }

  const personeller = idSeti.size
    ? await prisma.personnel.findMany({
        where: { id: { in: Array.from(idSeti) } },
        select: { id: true, adSoyad: true, yakaRengi: true, sicilNo: true },
      })
    : []
  const adMap = new Map(personeller.map((p) => [p.id, p.adSoyad]))
  const yakaMap = new Map(personeller.map((p) => [p.id, p.yakaRengi]))
  const sicilMap = new Map(personeller.map((p) => [p.id, p.sicilNo]))

  const satirlar = talepler.flatMap((t) =>
    t.satirlar.map((s) => ({
      avansTalebiId: t.id,
      sorumluAdSoyad:
        t.sorumluId === 'IK_MANUEL' ? 'IK_MANUEL' : (adMap.get(t.sorumluId) ?? '(bilinmiyor)'),
      bolum: t.bolum,
      donemYil: t.donemYil,
      donemAy: t.donemAy,
      calisanId: s.calisanId,
      calisanAdSoyad: adMap.get(s.calisanId) ?? '(bilinmiyor)',
      calisanSicilNo: sicilMap.get(s.calisanId) ?? null,
      calisanYakaRengi: yakaMap.get(s.calisanId) ?? null,
      avansIstiyorMu: s.avansIstiyorMu,
      gonderimTarihi: t.gonderimTarihi.toISOString(),
      vekaletenMi: t.vekaletenMi,
    }))
  )

  return NextResponse.json({ satirlar })
}

type PostBody = { personelId: string; force?: boolean }

function gecerliPostBody(body: unknown): body is PostBody {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  if (typeof b.personelId !== 'string') return false
  if (b.force !== undefined && typeof b.force !== 'boolean') return false
  return true
}

/**
 * POST: İK, listeye elle bir kişi ekler. sorumluId sabit "IK_MANUEL" işaretleyicisi
 * (Personnel'e FK değil, düz string) — normal sorumlu/kendi akışından
 * gelen kayıtlarla çakışmaz. Bölüm, eklenen kişinin kendi bölümünden alınır.
 * Ekleme katmalıdır (additive) — aynı bölümdeki diğer İK-eklemelerini SİLMEZ.
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  if (!canAccessSandbox('nurgul', user.email, user.role)) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
  }
  if (user.role !== 'HR_MANAGER' && user.role !== 'SUPER_ADMIN' && !isSandboxOwner(user.email)) {
    return NextResponse.json({ error: 'Bu ekrana sadece İK erişebilir.' }, { status: 403 })
  }

  const body: unknown = await request.json().catch(() => null)
  if (!gecerliPostBody(body)) {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 })
  }

  const personel = await prisma.personnel.findUnique({ where: { id: body.personelId } })
  if (!personel) {
    return NextResponse.json({ error: 'Personel bulunamadı.' }, { status: 404 })
  }
  if (!personel.bolum) {
    return NextResponse.json(
      { error: 'Bu personelin bölüm bilgisi tanımlı değil.' },
      { status: 400 }
    )
  }

  const now = new Date()
  const donemYil = now.getFullYear()
  const donemAy = now.getMonth() + 1

  const kilit = await donemKilidiKontrol(donemYil, donemAy)
  if (kilit) return kilit

  const mevcutKayit = await prisma.avansTalebiSatiri.findFirst({
    where: {
      calisanId: personel.id,
      avansIstiyorMu: true,
      avansTalebi: { donemYil, donemAy },
    },
    include: { avansTalebi: true },
  })

  if (mevcutKayit && !body.force) {
    return NextResponse.json(
      {
        warning: true,
        message: `${personel.adSoyad} bu dönem için zaten listede (${mevcutKayit.avansTalebi.bolum}). Yine de eklemek istiyor musunuz?`,
      },
      { status: 409 }
    )
  }

  const avansTalebi = await prisma.avansTalebi.upsert({
    where: {
      sorumluId_bolum_donemYil_donemAy: {
        sorumluId: IK_MANUEL_SORUMLU_ID,
        bolum: personel.bolum,
        donemYil,
        donemAy,
      },
    },
    create: {
      sorumluId: IK_MANUEL_SORUMLU_ID,
      bolum: personel.bolum,
      donemYil,
      donemAy,
    },
    // Bos update: {} Prisma'da hicbir UPDATE sorgusu tetiklemez, @updatedAt
    // bump olmaz.
    update: { updatedAt: new Date() },
  })

  await prisma.avansTalebiSatiri.upsert({
    where: {
      avansTalebiId_calisanId: {
        avansTalebiId: avansTalebi.id,
        calisanId: personel.id,
      },
    },
    create: {
      avansTalebiId: avansTalebi.id,
      calisanId: personel.id,
      avansIstiyorMu: true,
    },
    update: { avansIstiyorMu: true },
  })

  return NextResponse.json({ success: true })
}

type DeleteBody = { avansTalebiId: string; calisanId: string }

function gecerliDeleteBody(body: unknown): body is DeleteBody {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  return typeof b.avansTalebiId === 'string' && typeof b.calisanId === 'string'
}

/**
 * DELETE: İK, listeden bir kişiyi çıkarır (talebinden vazgeçti).
 * Sadece ilgili AvansTalebiSatiri silinir, AvansTalebi (ve diğer satırları) kalır.
 */
export async function DELETE(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  if (!canAccessSandbox('nurgul', user.email, user.role)) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
  }
  if (user.role !== 'HR_MANAGER' && user.role !== 'SUPER_ADMIN' && !isSandboxOwner(user.email)) {
    return NextResponse.json({ error: 'Bu ekrana sadece İK erişebilir.' }, { status: 403 })
  }

  const body: unknown = await request.json().catch(() => null)
  if (!gecerliDeleteBody(body)) {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 })
  }

  // Silinecek satırın ait olduğu talebin dönemi kapalıysa değişiklik yasak.
  const talep = await prisma.avansTalebi.findUnique({
    where: { id: body.avansTalebiId },
    select: { donemYil: true, donemAy: true },
  })
  if (talep) {
    const kilit = await donemKilidiKontrol(talep.donemYil, talep.donemAy)
    if (kilit) return kilit
  }

  await prisma.avansTalebiSatiri.deleteMany({
    where: { avansTalebiId: body.avansTalebiId, calisanId: body.calisanId },
  })

  return NextResponse.json({ success: true })
}

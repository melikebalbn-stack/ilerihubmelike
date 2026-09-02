import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { canAccessSandbox } from '@/lib/sandbox-config'
import { prisma } from '@/lib/prisma'
import { donemKilidiKontrol } from '@/lib/avans/donem-kilidi'
import { bulSorumluVeEkibi, sonucHataMesaji } from './_lib/avans-formu-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET: Avans formu için personel listesi.
 * Giriş yapan kullanıcının sorumlu/müdür olduğu bölümlerdeki aktif mavi yaka
 * personeli döndürür (kendisi dahil).
 */
export async function GET(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  if (!canAccessSandbox('nurgul', user.email, user.role)) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
  }

  const sonuc = await bulSorumluVeEkibi(user.id)

  if (!sonuc.ok) {
    return NextResponse.json({ error: sonucHataMesaji(sonuc.reason) }, { status: 404 })
  }

  const now = new Date()
  return NextResponse.json({
    ...sonuc,
    donemYil: now.getFullYear(),
    donemAy: now.getMonth() + 1,
  })
}

type SecimGirdisi = { personelId: string; avansIstiyorMu: boolean }

type PostBody = {
  donemYil: number
  donemAy: number
  secimler: SecimGirdisi[]
}

function gecerliBody(body: unknown): body is PostBody {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  if (typeof b.donemYil !== 'number' || typeof b.donemAy !== 'number') return false
  if (!Array.isArray(b.secimler)) return false
  return b.secimler.every(
    (s) =>
      s &&
      typeof s === 'object' &&
      typeof (s as SecimGirdisi).personelId === 'string' &&
      typeof (s as SecimGirdisi).avansIstiyorMu === 'boolean'
  )
}

/**
 * POST: Avans formu gönderimi.
 * Aynı (sorumluId + bolum + donemYil + donemAy) kombinasyonu için ikinci
 * gönderimde hata vermez: mevcut AvansTalebi'yi bulur (yoksa oluşturur),
 * satırlarını siler ve gönderilen seçimlerle yeniden yazar. Bölüm bazında
 * ayrı AvansTalebi kaydı oluşur (bir sorumlu birden fazla bölümden
 * sorumlu olabilir). Tüm bölüm grupları TEK bir interactive transaction
 * içinde işlenir — silme+yeniden yazma arada yarım kalmaz.
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  if (!canAccessSandbox('nurgul', user.email, user.role)) {
    return NextResponse.json({ error: 'Bu işlem için yetkiniz yok' }, { status: 403 })
  }

  const body: unknown = await request.json().catch(() => null)
  if (!gecerliBody(body)) {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 })
  }

  const kilit = await donemKilidiKontrol(body.donemYil, body.donemAy)
  if (kilit) return kilit

  const sonuc = await bulSorumluVeEkibi(user.id)
  if (!sonuc.ok) {
    return NextResponse.json({ error: sonucHataMesaji(sonuc.reason) }, { status: 404 })
  }

  const izinliPersonelMap = new Map(sonuc.personel.map((p) => [p.id, p]))
  const yetkisizSecim = body.secimler.find((s) => !izinliPersonelMap.has(s.personelId))

  if (yetkisizSecim) {
    return NextResponse.json(
      { error: 'Yetki alanınız dışında bir personel seçilemez.' },
      { status: 403 }
    )
  }

  const bolumGruplari = new Map<string, SecimGirdisi[]>()
  for (const secim of body.secimler) {
    const personel = izinliPersonelMap.get(secim.personelId)
    const bolum = personel?.bolum
    if (!bolum) continue
    if (!bolumGruplari.has(bolum)) bolumGruplari.set(bolum, [])
    bolumGruplari.get(bolum)!.push(secim)
  }

  const sonuclar = await prisma.$transaction(async (tx) => {
    const sonuclar: { bolum: string; avansTalebiId: string; satirSayisi: number }[] = []

    for (const [bolum, secimler] of bolumGruplari) {
      const avansTalebi = await tx.avansTalebi.upsert({
        where: {
          sorumluId_bolum_donemYil_donemAy: {
            sorumluId: sonuc.sorumlu.id,
            bolum,
            donemYil: body.donemYil,
            donemAy: body.donemAy,
          },
        },
        create: {
          sorumluId: sonuc.sorumlu.id,
          bolum,
          donemYil: body.donemYil,
          donemAy: body.donemAy,
        },
        // Bos update: {} Prisma'da hicbir UPDATE sorgusu tetiklemez, @updatedAt
        // bump olmaz - duzeltme izinin kaybolmamasi icin aciktan set ediliyor.
        update: { updatedAt: new Date() },
      })

      await tx.avansTalebiSatiri.deleteMany({
        where: { avansTalebiId: avansTalebi.id },
      })
      await tx.avansTalebiSatiri.createMany({
        data: secimler.map((s) => ({
          avansTalebiId: avansTalebi.id,
          calisanId: s.personelId,
          avansIstiyorMu: s.avansIstiyorMu,
        })),
      })

      sonuclar.push({ bolum, avansTalebiId: avansTalebi.id, satirSayisi: secimler.length })
    }

    return sonuclar
  })

  return NextResponse.json({
    success: true,
    talepler: sonuclar,
    toplamSecim: body.secimler.length,
  })
}

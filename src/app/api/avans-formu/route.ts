import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { prisma } from '@/lib/prisma'
import { donemAcikMi, donemKilidiKontrol } from '@/lib/avans/donem-kilidi'
import { bulSorumluVeEkibi, sonucHataMesaji, sonucHataStatus } from './_lib/avans-formu-helpers'
import { platformYoneticiDenetim } from '@/lib/auth/platform-yonetici'

export const dynamic = 'force-dynamic'

/**
 * GET: Avans formu için personel listesi.
 * Giriş yapan kullanıcının sorumlu/müdür olduğu bölümlerdeki aktif mavi yaka
 * personeli döndürür (kendisi dahil).
 */
export async function GET(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  const sonuc = await bulSorumluVeEkibi(user.id)

  if (!sonuc.ok) {
    return NextResponse.json(
      { error: sonucHataMesaji(sonuc.reason) },
      { status: sonucHataStatus(sonuc.reason) }
    )
  }

  const now = new Date()
  const donemYil = now.getFullYear()
  const donemAy = now.getMonth() + 1

  // Bu sorumlunun bu dönem için zaten girdiği talepler (bölüm bazında, bir
  // sorumlu birden fazla bölümden sorumlu olabilir) — UI'da "Geri Çek"
  // butonunu göstermek için.
  // geriCekildiMi:false — geri çekilmiş bölümler bu listede görünmesin
  // (tekrar geri çekilecek bir şey yok, aynı bölüm için yeniden girilebilir).
  const mevcutTalepKayitlari = await prisma.avansTalebi.findMany({
    where: { sorumluId: sonuc.sorumlu.id, donemYil, donemAy, geriCekildiMi: false },
    select: { id: true, bolum: true },
  })

  return NextResponse.json({
    ...sonuc,
    donemYil,
    donemAy,
    mevcutTalepler: mevcutTalepKayitlari.map((t) => ({ avansTalebiId: t.id, bolum: t.bolum })),
    // donemAcik: hem Gönder hem Geri Çek butonu için — SİMETRİK, aynı
    // birleşik kontrol (manuel > otomatik varsayılan).
    donemAcik: await donemAcikMi(donemYil, donemAy),
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

  const body: unknown = await request.json().catch(() => null)
  if (!gecerliBody(body)) {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 })
  }

  const kilit = await donemKilidiKontrol(body.donemYil, body.donemAy)
  if (kilit) return kilit

  const sonuc = await bulSorumluVeEkibi(user.id)
  if (!sonuc.ok) {
    return NextResponse.json(
      { error: sonucHataMesaji(sonuc.reason) },
      { status: sonucHataStatus(sonuc.reason) }
    )
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
      // Vekil senaryosu (c): eşleşme sadece vekil işaretli alan(lar) üzerinden
      // kurulduysa vekaletenMi=true. Asıl sorumlu işaretsiz bir alanla da
      // eşleşiyorsa vekaletenBolumler'de bu bölüm YOKTUR → false kalır.
      const vekaletenMi = sonuc.vekaletenBolumler.includes(bolum)

      // Upsert'ten ONCE mevcut durumu oku: update dalinda geriCekildiMi
      // sifirlaniyor, bu yuzden "reaktivasyon oldu mu" ancak upsert'ten
      // once bakilarak anlasilabilir (bkz. asagidaki AvansTalebiGeriCekmeLog).
      const oncekiTalep = await tx.avansTalebi.findUnique({
        where: {
          sorumluId_bolum_donemYil_donemAy: {
            sorumluId: sonuc.sorumlu.id,
            bolum,
            donemYil: body.donemYil,
            donemAy: body.donemAy,
          },
        },
        select: { geriCekildiMi: true },
      })

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
          vekaletenMi,
        },
        // Bos update: {} Prisma'da hicbir UPDATE sorgusu tetiklemez, @updatedAt
        // bump olmaz - duzeltme izinin kaybolmamasi icin aciktan set ediliyor.
        // vekaletenMi de güncel eşleşme durumuna göre tazelenir.
        // geriCekildiMi/geriCekenId/geriCekmeTarihi sifirlanir: daha once
        // geri cekilmis bir kayit varsa, yeniden gonderim onu "reaktive" eder.
        update: {
          updatedAt: new Date(),
          vekaletenMi,
          geriCekildiMi: false,
          geriCekenId: null,
          geriCekmeTarihi: null,
        },
      })

      // Reaktivasyon: kayit daha once geri cekilmisti, bu gonderim onu
      // geri getirdi — izi AvansTalebiGeriCekmeLog'a dusur (bkz.
      // geri-cek/route.ts).
      if (oncekiTalep?.geriCekildiMi) {
        await tx.avansTalebiGeriCekmeLog.create({
          data: {
            avansTalebiId: avansTalebi.id,
            islem: 'REAKTIVASYON',
            kullaniciId: user.id,
          },
        })
      }

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

  // Kapsam platform yöneticisi kuralından geldiyse gönderim denetime düşsün.
  if (sonuc.platformBypass) {
    await platformYoneticiDenetim({
      userId: user.id,
      userEmail: user.email,
      islem: 'avans:gonderim',
      detay: {
        donem: `${body.donemYil}-${String(body.donemAy).padStart(2, '0')}`,
        bolumSayisi: sonuclar.length,
        satirSayisi: body.secimler.length,
      },
    })
  }

  return NextResponse.json({
    success: true,
    talepler: sonuclar,
    toplamSecim: body.secimler.length,
  })
}

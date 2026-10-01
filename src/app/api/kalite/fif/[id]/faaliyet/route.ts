import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { fifDuzenleyebilirMi, canManageFif } from '@/lib/quality/fif-access'
import { altKayitDuzenlenebilir } from '@/lib/quality/fif-durum'
import { FifDurum, FifSonuc } from '@/generated/prisma'
import { faaliyetKapaliMi } from '@/lib/quality/fif-termin'
import { fifFaaliyetInput } from '@/lib/quality/fif-validators'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/**
 * Faaliyet satırı değişince Fif.updatedAt güncellenir (aynı transaction). Detay
 * sayfası formu `key={updatedAt}` ile yeniden kurar; yoksa form eski hedef
 * tarihi tutuyor, sonraki Kaydet ES ile verilen yeni tarihi eziyordu.
 */
function fifDegistiIsaretle(tx: Tx, fifId: string) {
  return tx.fif.update({ where: { id: fifId }, data: { updatedAt: new Date() } })
}

/** Tek faaliyet satırı ekle/düzenle/sil. Auth: kapsam. FİF iptalse reddedilir. */
async function yetkiVeFif(id: string) {
  const { session, userId, error } = await requireSession()
  if (error) return { error }
  const fif = await prisma.fif.findUnique({
    where: { id },
    select: {
      id: true, durum: true, createdById: true, hazirlayanUserId: true,
      sorumluBolumId: true, yayinlayanBolumId: true,
    },
  })
  if (!fif) return { error: NextResponse.json({ error: 'FİF bulunamadı' }, { status: 404 }) }
  if (!(await fifDuzenleyebilirMi(session, fif))) {
    return { error: NextResponse.json({ error: "Bu FİF'i düzenleme yetkiniz yok" }, { status: 403 }) }
  }
  const manage = canManageFif(session)
  // Durum kilidi: KAPANDI/IPTAL'da düzenleme yok (manage hariç); ayrıca faaliyet
  // satırı yalnız FAALIYET durumunda düzenlenir (manage her durumda).
  if (!altKayitDuzenlenebilir({ userId: session?.user?.id ?? null, isManage: manage }, fif.durum)) {
    return { error: NextResponse.json({ error: 'Bu durumda düzenleme yapılamaz' }, { status: 409 }) }
  }
  if (!manage && fif.durum !== 'FAALIYET') {
    return { error: NextResponse.json({ error: 'Faaliyet satırları yalnız FAALIYET aşamasında düzenlenir' }, { status: 409 }) }
  }
  return {
    error: null as null,
    durum: fif.durum,
    userId,
    manage,
  }
}

/** Paket 3b-2: ES ve FAALIYET'te dolu hedef tarihin değişmesi yalnız ek termin akışıyla. */
const EK_TERMIN_KULLAN = 'Hedef tarih değişikliği için "Ek Termin İste" (ek termin talebi) kullanın'

/**
 * Paket 3: satırı KAPATMAK yalnız "Faaliyeti Kapat" ucundan (paraf + gerçekleşen
 * tarih + etkinlik planı birlikte yazılır). Bu uçtan sonuc=K verilirse o adımlar
 * atlanırdı → manage dışında reddedilir.
 */
function kapatmaBuUctanMi(sonuc: FifSonuc | null | undefined, manage: boolean): string | null {
  return sonuc === FifSonuc.K && !manage ? 'Faaliyeti kapatmak için "Faaliyeti Kapat" işlemini kullanın' : null
}


/**
 * PARAF (FAZ A — adım 6): faaliyet satırının parafı istemciden KABUL EDİLMEZ.
 * `parafla=true` gönderildiğinde sunucu oturum kullanıcısını yazar; bunu yalnız
 * SATIRIN SORUMLUSU (Paket 3 — eskiden formun uygulama sorumlusu; o alan kalktı)
 * ya da manage yapabilir. `parafla=false` → paraf temizlenir (aynı yetki).
 * Olağan akışta paraf "Faaliyeti Kapat" ucunda atılır.
 */
function parafCoz(
  body: unknown,
  g: { userId: string | null; satirSorumlusuUserId: string | null; manage: boolean },
): { ok: true; veri: { parafUserId: string | null; parafTarihi: Date | null } | null } | { ok: false; sebep: string } {
  const istek = (body as { parafla?: unknown } | null)?.parafla
  if (typeof istek !== 'boolean') return { ok: true, veri: null } // paraf alanına dokunma
  const yetkili = g.manage || (!!g.userId && g.userId === g.satirSorumlusuUserId)
  if (!yetkili) return { ok: false, sebep: 'Paraf yalnız satırın sorumlu kişisi tarafından atılabilir' }
  return istek
    ? { ok: true, veri: { parafUserId: g.userId, parafTarihi: new Date() } }
    : { ok: true, veri: { parafUserId: null, parafTarihi: null } }
}

/** POST — yeni faaliyet satırı. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const g = await yetkiVeFif(id)
  if (g.error) return g.error

  const body = await request.json().catch(() => null)
  const parsed = fifFaaliyetInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz veri', issues: parsed.error.flatten() }, { status: 400 })
  }
  const f = parsed.data
  if (f.sonuc === FifSonuc.ES) return NextResponse.json({ error: EK_TERMIN_KULLAN }, { status: 400 })
  const kapatma = kapatmaBuUctanMi(f.sonuc, g.manage)
  if (kapatma) return NextResponse.json({ error: kapatma }, { status: 400 })
  const paraf = parafCoz(body, { ...g, satirSorumlusuUserId: f.sorumluUserId ?? null })
  if (!paraf.ok) return NextResponse.json({ error: paraf.sebep }, { status: 403 })
  const created = await prisma.$transaction(async (tx) => {
    const c = await tx.fifFaaliyet.create({
      data: {
        fifId: id, sira: f.sira, aciklama: f.aciklama,
        aksiyonTuru: f.aksiyonTuru ?? null,
        hedefTarih: f.hedefTarih ?? null, ilkHedefTarih: f.hedefTarih ?? null,
        gerceklesenTarih: f.gerceklesenTarih ?? null,
        sonuc: f.sonuc ?? null,
        sorumluUserId: f.sorumluUserId ?? null,
        ...(paraf.veri ?? {}),
      },
    })
    await fifDegistiIsaretle(tx, id)
    return c
  })
  return NextResponse.json({ item: created }, { status: 201 })
}

/** PUT — mevcut faaliyet satırı güncelle (?faaliyetId=). */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const g = await yetkiVeFif(id)
  if (g.error) return g.error

  const faaliyetId = request.nextUrl.searchParams.get('faaliyetId')
  if (!faaliyetId) return NextResponse.json({ error: 'faaliyetId zorunlu' }, { status: 400 })

  const mevcut = await prisma.fifFaaliyet.findFirst({
    where: { id: faaliyetId, fifId: id },
    select: { id: true, hedefTarih: true, ilkHedefTarih: true, sorumluUserId: true, sonuc: true, gerceklesenTarih: true },
  })
  if (!mevcut) return NextResponse.json({ error: 'Faaliyet bulunamadı' }, { status: 404 })
  // Kapatılmış satır bu uçtan değişmez (paraf/gerçekleşen/etkinlik planı tutarlı kalsın).
  if (faaliyetKapaliMi(mevcut) && !g.manage) {
    return NextResponse.json({ error: 'Kapatılmış faaliyet düzenlenemez' }, { status: 409 })
  }

  const body = await request.json().catch(() => null)
  const parsed = fifFaaliyetInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz veri', issues: parsed.error.flatten() }, { status: 400 })
  }
  const f = parsed.data
  // Paket 3b-2: ES (doğrudan tarih değiştirme) KALKTI — hedef tarih yalnız KSS
  // onaylı ek termin talebiyle değişir.
  if (f.sonuc === FifSonuc.ES) return NextResponse.json({ error: EK_TERMIN_KULLAN }, { status: 400 })
  if (
    g.durum === FifDurum.FAALIYET && mevcut.hedefTarih && f.hedefTarih !== undefined &&
    (f.hedefTarih?.getTime() ?? null) !== mevcut.hedefTarih.getTime()
  ) {
    return NextResponse.json({ error: EK_TERMIN_KULLAN }, { status: 400 })
  }

  const kapatma = kapatmaBuUctanMi(f.sonuc, g.manage)
  if (kapatma) return NextResponse.json({ error: kapatma }, { status: 400 })

  const paraf = parafCoz(body, { ...g, satirSorumlusuUserId: mevcut.sorumluUserId })
  if (!paraf.ok) return NextResponse.json({ error: paraf.sebep }, { status: 403 })

  const yeniHedef = f.hedefTarih !== undefined ? f.hedefTarih : mevcut.hedefTarih
  const updated = await prisma.$transaction(async (tx) => {
    const up = await tx.fifFaaliyet.update({
      where: { id: faaliyetId },
      data: {
        sira: f.sira, aciklama: f.aciklama,
        // KISMİ güncelleme: gönderilmeyen alan korunur (eskiden `?? null` siliyordu).
        ...(f.aksiyonTuru !== undefined ? { aksiyonTuru: f.aksiyonTuru } : {}),
        ...(f.gerceklesenTarih !== undefined ? { gerceklesenTarih: f.gerceklesenTarih } : {}),
        ...(f.sorumluUserId !== undefined ? { sorumluUserId: f.sorumluUserId } : {}),
        ...(f.hedefTarih !== undefined ? { hedefTarih: f.hedefTarih } : {}),
        ...(f.sonuc !== undefined ? { sonuc: f.sonuc } : {}),
        // İlk hedef: hedef tarih İLK dolduğunda yazılır; sonra değişmez.
        ...(!mevcut.ilkHedefTarih && yeniHedef ? { ilkHedefTarih: yeniHedef } : {}),
        ...(paraf.veri ?? {}),
      },
    })
    await fifDegistiIsaretle(tx, id)
    return up
  })
  return NextResponse.json({ item: updated })
}

/** DELETE — faaliyet satırı sil (?faaliyetId=). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const g = await yetkiVeFif(id)
  if (g.error) return g.error

  const faaliyetId = z.string().min(1).safeParse(request.nextUrl.searchParams.get('faaliyetId'))
  if (!faaliyetId.success) return NextResponse.json({ error: 'faaliyetId zorunlu' }, { status: 400 })

  const mevcut = await prisma.fifFaaliyet.findFirst({ where: { id: faaliyetId.data, fifId: id }, select: { id: true, parafUserId: true } })
  if (!mevcut) return NextResponse.json({ error: 'Faaliyet bulunamadı' }, { status: 404 })
  // Form PUT'uyla AYNI kural: paraflı (kapatılmış) satır silinmez.
  if (mevcut.parafUserId) return NextResponse.json({ error: 'Paraflı faaliyet silinemez' }, { status: 400 })

  await prisma.$transaction(async (tx) => {
    await tx.fifFaaliyet.delete({ where: { id: faaliyetId.data } })
    await fifDegistiIsaretle(tx, id)
  })
  return NextResponse.json({ ok: true })
}

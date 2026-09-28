import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { fifKapsamindaMi, canManageFif } from '@/lib/quality/fif-access'
import { altKayitDuzenlenebilir, esKuraliGecerli, esGecmisAciklamasi } from '@/lib/quality/fif-durum'
import { FifDurum, FifSonuc } from '@/generated/prisma'
import { fifFaaliyetInput } from '@/lib/quality/fif-validators'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

/** Tek faaliyet satırı ekle/düzenle/sil. Auth: kapsam. FİF iptalse reddedilir. */
async function yetkiVeFif(id: string) {
  const { session, userId, error } = await requireSession()
  if (error) return { error }
  const fif = await prisma.fif.findUnique({
    where: { id },
    select: {
      id: true, durum: true, createdById: true, hazirlayanUserId: true,
      sorumluBolumId: true, yayinlayanBolumId: true, ekTerminNedeni: true,
      // Paraf kuralı (FAZ A): satırı yalnız uygulama sorumlusu (veya manage) parafe eder.
      uygulamaSorumlusuUserId: true,
    },
  })
  if (!fif) return { error: NextResponse.json({ error: 'FİF bulunamadı' }, { status: 404 }) }
  if (!(await fifKapsamindaMi(session, fif))) {
    return { error: NextResponse.json({ error: 'Bu FİF kapsamınızda değil' }, { status: 403 }) }
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
    ekTerminNedeni: fif.ekTerminNedeni,
    userId,
    uygulamaSorumlusuUserId: fif.uygulamaSorumlusuUserId,
    manage,
  }
}


/**
 * PARAF (FAZ A — adım 6): faaliyet satırının parafı istemciden KABUL EDİLMEZ.
 * `parafla=true` gönderildiğinde sunucu oturum kullanıcısını yazar; bunu yalnız
 * formun UYGULAMA SORUMLUSU (ya da manage) yapabilir. Böylece "uygulama
 * sorumlusu" alanı akışta gerçekten bir karşılık bulur (eskiden ölü alandı).
 * `parafla=false` → paraf temizlenir (aynı yetki).
 */
function parafCoz(
  body: unknown,
  g: { userId: string | null; uygulamaSorumlusuUserId: string | null; manage: boolean },
): { ok: true; veri: { parafUserId: string | null; parafTarihi: Date | null } | null } | { ok: false; sebep: string } {
  const istek = (body as { parafla?: unknown } | null)?.parafla
  if (typeof istek !== 'boolean') return { ok: true, veri: null } // paraf alanına dokunma
  const yetkili = g.manage || (!!g.userId && g.userId === g.uygulamaSorumlusuUserId)
  if (!yetkili) return { ok: false, sebep: 'Paraf yalnız uygulama sorumlusu tarafından atılabilir' }
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
  const es = esKuraliGecerli(g.durum, f.sonuc ?? null, g.ekTerminNedeni)
  if (!es.ok) return NextResponse.json({ error: es.sebep }, { status: 400 })
  const paraf = parafCoz(body, g)
  if (!paraf.ok) return NextResponse.json({ error: paraf.sebep }, { status: 403 })
  const created = await prisma.fifFaaliyet.create({
    data: {
      fifId: id, sira: f.sira, aciklama: f.aciklama,
      aksiyonTuru: f.aksiyonTuru ?? null,
      hedefTarih: f.hedefTarih ?? null, gerceklesenTarih: f.gerceklesenTarih ?? null,
      sonuc: f.sonuc ?? null,
      ...(paraf.veri ?? {}),
    },
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

  const mevcut = await prisma.fifFaaliyet.findFirst({ where: { id: faaliyetId, fifId: id }, select: { id: true, hedefTarih: true } })
  if (!mevcut) return NextResponse.json({ error: 'Faaliyet bulunamadı' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const parsed = fifFaaliyetInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz veri', issues: parsed.error.flatten() }, { status: 400 })
  }
  const f = parsed.data
  // ES UX: ekTerminNedeni aynı istekte gelebilir; sonuc=ES ise yeni ekTermin +
  // yeni hedefTarih zorunlu, tek kayıtta Fif.ekTerminNedeni + hedefTarih güncellenir
  // ve eski hedef tarih FifGecmis'e aciklama olarak yazılır.
  const ekTerminNedeni: string | null = typeof (body as { ekTerminNedeni?: unknown })?.ekTerminNedeni === 'string'
    ? String((body as { ekTerminNedeni: string }).ekTerminNedeni).trim() || null
    : null
  const esNeden = ekTerminNedeni ?? g.ekTerminNedeni
  const es = esKuraliGecerli(g.durum, f.sonuc ?? null, esNeden)
  if (!es.ok) return NextResponse.json({ error: es.sebep }, { status: 400 })

  const paraf = parafCoz(body, g)
  if (!paraf.ok) return NextResponse.json({ error: paraf.sebep }, { status: 403 })

  const isES = f.sonuc === FifSonuc.ES
  if (isES && !f.hedefTarih) return NextResponse.json({ error: 'Ek süre için yeni hedef tarih zorunlu' }, { status: 400 })

  const updated = await prisma.$transaction(async (tx) => {
    const up = await tx.fifFaaliyet.update({
      where: { id: faaliyetId },
      data: {
        sira: f.sira, aciklama: f.aciklama,
        // KISMİ güncelleme: gönderilmeyen alan KORUNUR. ES ekranı (FifEklerPanel)
        // aksiyonTuru / gerceklesenTarih / paraf göndermiyor; eskiden `?? null` her ES
        // kaydında gerçekleşen tarihi (ve türü) siliyordu. Paraf yalnız `parafla` ile.
        ...(f.aksiyonTuru !== undefined ? { aksiyonTuru: f.aksiyonTuru } : {}),
        ...(f.hedefTarih !== undefined ? { hedefTarih: f.hedefTarih } : {}),
        ...(f.gerceklesenTarih !== undefined ? { gerceklesenTarih: f.gerceklesenTarih } : {}),
        ...(f.sonuc !== undefined ? { sonuc: f.sonuc } : {}),
        ...(paraf.veri ?? {}),
      },
    })
    if (isES) {
      if (ekTerminNedeni) await tx.fif.update({ where: { id }, data: { ekTerminNedeni } })
      const eskiIso = mevcut.hedefTarih ? new Date(mevcut.hedefTarih).toISOString().slice(0, 10) : null
      const yeniIso = f.hedefTarih ? new Date(f.hedefTarih).toISOString().slice(0, 10) : ''
      await tx.fifGecmis.create({
        data: {
          fifId: id, eskiDurum: FifDurum.FAALIYET, yeniDurum: FifDurum.FAALIYET, userId: g.userId,
          aciklama: esGecmisAciklamasi(eskiIso, yeniIso, esNeden ?? ''),
        },
      })
    }
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

  const mevcut = await prisma.fifFaaliyet.findFirst({ where: { id: faaliyetId.data, fifId: id }, select: { id: true } })
  if (!mevcut) return NextResponse.json({ error: 'Faaliyet bulunamadı' }, { status: 404 })

  await prisma.fifFaaliyet.delete({ where: { id: faaliyetId.data } })
  return NextResponse.json({ ok: true })
}

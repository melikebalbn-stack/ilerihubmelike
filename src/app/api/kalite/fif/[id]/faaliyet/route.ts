import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { fifKapsamindaMi, canManageFif } from '@/lib/quality/fif-access'
import { altKayitDuzenlenebilir, esKuraliGecerli } from '@/lib/quality/fif-durum'
import { fifFaaliyetInput } from '@/lib/quality/fif-validators'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

/** Tek faaliyet satırı ekle/düzenle/sil. Auth: kapsam. FİF iptalse reddedilir. */
async function yetkiVeFif(id: string) {
  const { session, error } = await requireSession()
  if (error) return { error }
  const fif = await prisma.fif.findUnique({
    where: { id },
    select: { id: true, durum: true, createdById: true, hazirlayanUserId: true, sorumluBolumId: true, yayinlayanBolumId: true, ekTerminNedeni: true },
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
  return { error: null as null, durum: fif.durum, ekTerminNedeni: fif.ekTerminNedeni }
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
  const created = await prisma.fifFaaliyet.create({
    data: {
      fifId: id, sira: f.sira, aciklama: f.aciklama,
      hedefTarih: f.hedefTarih ?? null, gerceklesenTarih: f.gerceklesenTarih ?? null,
      sonuc: f.sonuc ?? null, parafUserId: f.parafUserId ?? null, parafTarihi: f.parafTarihi ?? null,
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

  const mevcut = await prisma.fifFaaliyet.findFirst({ where: { id: faaliyetId, fifId: id }, select: { id: true } })
  if (!mevcut) return NextResponse.json({ error: 'Faaliyet bulunamadı' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const parsed = fifFaaliyetInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz veri', issues: parsed.error.flatten() }, { status: 400 })
  }
  const f = parsed.data
  const es = esKuraliGecerli(g.durum, f.sonuc ?? null, g.ekTerminNedeni)
  if (!es.ok) return NextResponse.json({ error: es.sebep }, { status: 400 })
  const updated = await prisma.fifFaaliyet.update({
    where: { id: faaliyetId },
    data: {
      sira: f.sira, aciklama: f.aciklama,
      hedefTarih: f.hedefTarih ?? null, gerceklesenTarih: f.gerceklesenTarih ?? null,
      sonuc: f.sonuc ?? null, parafUserId: f.parafUserId ?? null, parafTarihi: f.parafTarihi ?? null,
    },
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

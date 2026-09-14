import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth/require-session'
import { canManageFif, fifKapsamindaMi } from '@/lib/quality/fif-access'
import { altKayitDuzenlenebilir } from '@/lib/quality/fif-durum'
import { FifKokNedenKategori } from '@/generated/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const girdi = z.object({
  // Kategori bazlı serbest metin (boş → o kategori silinir).
  kokNedenler: z.array(z.object({ kategori: z.nativeEnum(FifKokNedenKategori), aciklama: z.string() })).optional(),
  // 5 Neden çoklu satır.
  besNedenler: z.array(z.object({
    muhtemelSebep: z.string().trim().min(1),
    neden1: z.string().optional().nullable(), neden2: z.string().optional().nullable(),
    neden3: z.string().optional().nullable(), neden4: z.string().optional().nullable(),
    neden5: z.string().optional().nullable(),
  })).optional(),
})

/** GET — Ek-1 içeriği. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { id } = await params
  const fif = await prisma.fif.findUnique({ where: { id }, select: { id: true, createdById: true, hazirlayanUserId: true, sorumluBolumId: true, yayinlayanBolumId: true } })
  if (!fif) return NextResponse.json({ error: 'FİF bulunamadı' }, { status: 404 })
  if (!(await fifKapsamindaMi(session, fif))) return NextResponse.json({ error: 'kapsam dışı' }, { status: 403 })
  const [kokNedenler, besNedenler] = await Promise.all([
    prisma.fifKokNeden.findMany({ where: { fifId: id } }),
    prisma.fifBesNeden.findMany({ where: { fifId: id } }),
  ])
  return NextResponse.json({ kokNedenler, besNedenler })
}

/** PUT — Ek-1 yerinde değiştir. Kilit: altKayitDuzenlenebilir. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, userId, error } = await requireSession()
  if (error) return error
  const { id } = await params
  const fif = await prisma.fif.findUnique({ where: { id }, select: { id: true, durum: true, createdById: true, hazirlayanUserId: true, sorumluBolumId: true, yayinlayanBolumId: true } })
  if (!fif) return NextResponse.json({ error: 'FİF bulunamadı' }, { status: 404 })
  if (!(await fifKapsamindaMi(session, fif))) return NextResponse.json({ error: 'kapsam dışı' }, { status: 403 })
  if (!altKayitDuzenlenebilir({ userId, isManage: canManageFif(session) }, fif.durum)) {
    return NextResponse.json({ error: 'Bu durumda düzenleme yapılamaz' }, { status: 409 })
  }

  const body = await request.json().catch(() => null)
  const parsed = girdi.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Geçersiz veri', issues: parsed.error.flatten() }, { status: 400 })
  const d = parsed.data

  await prisma.$transaction(async (tx) => {
    if (d.kokNedenler) {
      await tx.fifKokNeden.deleteMany({ where: { fifId: id } })
      const dolu = d.kokNedenler.filter((k) => k.aciklama.trim())
      if (dolu.length) await tx.fifKokNeden.createMany({ data: dolu.map((k) => ({ fifId: id, kategori: k.kategori, aciklama: k.aciklama.trim() })) })
    }
    if (d.besNedenler) {
      await tx.fifBesNeden.deleteMany({ where: { fifId: id } })
      if (d.besNedenler.length) await tx.fifBesNeden.createMany({ data: d.besNedenler.map((b) => ({
        fifId: id, muhtemelSebep: b.muhtemelSebep,
        neden1: b.neden1 || null, neden2: b.neden2 || null, neden3: b.neden3 || null, neden4: b.neden4 || null, neden5: b.neden5 || null,
      })) })
    }
  })

  const [kokNedenler, besNedenler] = await Promise.all([
    prisma.fifKokNeden.findMany({ where: { fifId: id } }),
    prisma.fifBesNeden.findMany({ where: { fifId: id } }),
  ])
  return NextResponse.json({ kokNedenler, besNedenler })
}

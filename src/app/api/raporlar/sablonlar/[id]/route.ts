import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { sablonDogrula } from '@/lib/rapor/sablon-dogrula'
import type { SablonIcerik, VeriSetiTanim } from '@/lib/rapor/tipler'
import { SablonGovde, json, uniqueIhlali, zodMesaj } from '../_ortak'

export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { error } = await requirePermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (error) return error
  const { id } = await params
  const s = await prisma.raporSablon.findUnique({
    where: { id },
    include: { veriSeti: { select: { id: true, ad: true, tanim: true } }, surumler: { select: { surum: true, olusturma: true, kaydeden: { select: { name: true } } }, orderBy: { surum: 'desc' }, take: 20 } },
  })
  if (!s) return NextResponse.json({ error: 'Şablon bulunamadı' }, { status: 404 })
  return NextResponse.json({ sablon: s })
}

/** PUT — mevcut içerik rapor_sablon_surum'a kopyalanır, surum +1. */
export async function PUT(req: Request, { params }: Ctx) {
  const { userId, error } = await requirePermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (error) return error
  const { id } = await params
  const govde = SablonGovde.safeParse(await req.json().catch(() => null))
  if (!govde.success) return NextResponse.json({ error: zodMesaj(govde.error) }, { status: 400 })
  const mevcut = await prisma.raporSablon.findUnique({ where: { id }, select: { id: true, surum: true, icerik: true } })
  if (!mevcut) return NextResponse.json({ error: 'Şablon bulunamadı' }, { status: 404 })
  const veriSeti = await prisma.raporVeriSeti.findUnique({ where: { id: govde.data.veriSetiId }, select: { tanim: true } })
  if (!veriSeti) return NextResponse.json({ error: 'Veri seti bulunamadı' }, { status: 400 })
  const hatalar = sablonDogrula(govde.data.icerik as SablonIcerik, Object.keys((veriSeti.tanim as unknown as VeriSetiTanim).alanlar ?? {}))
  if (hatalar.length) return NextResponse.json({ error: 'Şablon geçersiz', hatalar }, { status: 400 })
  try {
    const s = await prisma.$transaction(async (tx) => {
      await tx.raporSablonSurum.upsert({
        where: { sablonId_surum: { sablonId: id, surum: mevcut.surum } },
        create: { sablonId: id, surum: mevcut.surum, icerik: mevcut.icerik as object, kaydedenId: userId },
        update: {},
      })
      return tx.raporSablon.update({
        where: { id },
        data: { kod: govde.data.kod, ad: govde.data.ad, aciklama: govde.data.aciklama ?? null, veriSetiId: govde.data.veriSetiId, icerik: json(govde.data.icerik), durum: govde.data.durum, izinAnahtari: govde.data.izinAnahtari || null, surum: { increment: 1 } },
      })
    })
    return NextResponse.json({ sablon: s })
  } catch (e) {
    if (uniqueIhlali(e)) return NextResponse.json({ error: `'${govde.data.kod}' kodlu başka bir şablon var` }, { status: 409 })
    throw e
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { error } = await requirePermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (error) return error
  const { id } = await params
  const s = await prisma.raporSablon.findUnique({ where: { id }, select: { id: true, durum: true } })
  if (!s) return NextResponse.json({ error: 'Şablon bulunamadı' }, { status: 404 })
  if (s.durum === 'YAYINDA') return NextResponse.json({ error: 'Yayındaki şablon silinemez; önce ARSIV veya TASLAK yapın' }, { status: 409 })
  await prisma.raporSablon.delete({ where: { id } }) // sürümler ve çalıştırmalar Cascade
  return NextResponse.json({ ok: true })
}

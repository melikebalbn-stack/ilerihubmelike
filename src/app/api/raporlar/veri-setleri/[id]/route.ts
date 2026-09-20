import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { VeriSetiGovde, json, tanimHatalari, uniqueIhlali } from '../_ortak'
import type { VeriSetiTanim } from '@/lib/rapor/tipler'

export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { error } = await requirePermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (error) return error
  const { id } = await params
  const v = await prisma.raporVeriSeti.findUnique({
    where: { id },
    include: { sablonlar: { select: { id: true, kod: true, ad: true, durum: true } }, olusturan: { select: { name: true } } },
  })
  if (!v) return NextResponse.json({ error: 'Veri seti bulunamadı' }, { status: 404 })
  return NextResponse.json({ veriSeti: v })
}

export async function PUT(req: Request, { params }: Ctx) {
  const { error } = await requirePermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (error) return error
  const { id } = await params
  const govde = VeriSetiGovde.safeParse(await req.json().catch(() => null))
  if (!govde.success) return NextResponse.json({ error: govde.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }, { status: 400 })
  const hatalar = tanimHatalari(govde.data.tanim as VeriSetiTanim)
  if (hatalar.length) return NextResponse.json({ error: 'Tanım geçersiz', hatalar }, { status: 400 })
  const mevcut = await prisma.raporVeriSeti.findUnique({ where: { id }, select: { id: true } })
  if (!mevcut) return NextResponse.json({ error: 'Veri seti bulunamadı' }, { status: 404 })
  try {
    const v = await prisma.raporVeriSeti.update({
      where: { id },
      data: { ad: govde.data.ad, aciklama: govde.data.aciklama ?? null, tanim: json(govde.data.tanim), ...(govde.data.onbellekSn !== undefined ? { onbellekSn: govde.data.onbellekSn } : {}), ...(govde.data.aktif !== undefined ? { aktif: govde.data.aktif } : {}) },
    })
    return NextResponse.json({ veriSeti: v })
  } catch (e) {
    if (uniqueIhlali(e)) return NextResponse.json({ error: `'${govde.data.ad}' adında başka bir veri seti var` }, { status: 409 })
    throw e
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { error } = await requirePermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (error) return error
  const { id } = await params
  const v = await prisma.raporVeriSeti.findUnique({ where: { id }, select: { id: true, _count: { select: { sablonlar: true } } } })
  if (!v) return NextResponse.json({ error: 'Veri seti bulunamadı' }, { status: 404 })
  if (v._count.sablonlar > 0) {
    return NextResponse.json({ error: `Bu veri setini ${v._count.sablonlar} şablon kullanıyor; önce şablonları başka veri setine taşıyın` }, { status: 409 })
  }
  await prisma.raporVeriSeti.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

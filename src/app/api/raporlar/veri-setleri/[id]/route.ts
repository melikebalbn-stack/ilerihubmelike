import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { json, uniqueIhlali, veriSetiGovdesi } from '../_ortak'
import type { VeriSetiTanim } from '@/lib/rapor/tipler'
import { veriSetiAlanlari } from '@/lib/rapor/veri-seti-alanlar'

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
  return NextResponse.json({ veriSeti: v, alanlar: await veriSetiAlanlari(v.tanim as unknown as VeriSetiTanim) })
}

/**
 * PUT — veri setini güncelle. (Bu uç 8935f5c39'da yanlışlıkla silinmişti; ekran PUT atınca 405 alıyordu.)
 * Doğrulama yolu POST /api/raporlar/veri-setleri ile ortak: veriSetiGovdesi().
 */
export async function PUT(req: Request, { params }: Ctx) {
  const { error } = await requirePermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (error) return error
  const { id } = await params
  const { veri, hata } = await veriSetiGovdesi(req)
  if (hata) return hata
  const mevcut = await prisma.raporVeriSeti.findUnique({ where: { id }, select: { id: true } })
  if (!mevcut) return NextResponse.json({ error: 'Veri seti bulunamadı' }, { status: 404 })
  try {
    const v = await prisma.raporVeriSeti.update({
      where: { id },
      data: {
        ad: veri.ad, aciklama: veri.aciklama ?? null, tanim: json(veri.tanim),
        ...(veri.onbellekSn !== undefined ? { onbellekSn: veri.onbellekSn } : {}),
        ...(veri.aktif !== undefined ? { aktif: veri.aktif } : {}),
      },
    })
    return NextResponse.json({ veriSeti: v })
  } catch (e) {
    if (uniqueIhlali(e)) return NextResponse.json({ error: `'${veri.ad}' adında bir veri seti zaten var` }, { status: 409 })
    throw e
  }
}

/** DELETE — kullanılmıyorsa sil; kullanan şablon varsa 409 + rapor kodlarını say. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { error } = await requirePermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (error) return error
  const { id } = await params
  const v = await prisma.raporVeriSeti.findUnique({
    where: { id },
    select: { id: true, ad: true, sablonlar: { select: { kod: true, ad: true }, orderBy: { kod: 'asc' } } },
  })
  if (!v) return NextResponse.json({ error: 'Veri seti bulunamadı' }, { status: 404 })
  if (v.sablonlar.length) {
    const liste = v.sablonlar.slice(0, 5).map((s) => `${s.kod} (${s.ad})`).join(', ')
    const kalan = v.sablonlar.length > 5 ? ` ve ${v.sablonlar.length - 5} rapor daha` : ''
    return NextResponse.json({
      error: `'${v.ad}' veri setini ${v.sablonlar.length} rapor kullanıyor: ${liste}${kalan}. Önce bu raporları başka veri setine taşıyın veya silin.`,
      sablonlar: v.sablonlar,
    }, { status: 409 })
  }
  await prisma.raporVeriSeti.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

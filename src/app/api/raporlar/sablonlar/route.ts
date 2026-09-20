import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { sablonDogrula } from '@/lib/rapor/sablon-dogrula'
import type { SablonIcerik, VeriSetiTanim } from '@/lib/rapor/tipler'
import { SablonGovde, json, uniqueIhlali, zodMesaj } from './_ortak'

export const dynamic = 'force-dynamic'

/** GET — şablon listesi (tasarımcı). */
export async function GET() {
  const { error } = await requirePermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (error) return error
  const liste = await prisma.raporSablon.findMany({
    select: { id: true, kod: true, ad: true, durum: true, surum: true, guncellenme: true, veriSeti: { select: { ad: true } } },
    orderBy: [{ durum: 'asc' }, { kod: 'asc' }],
  })
  return NextResponse.json({ sablonlar: liste.map((s) => ({ id: s.id, kod: s.kod, ad: s.ad, durum: s.durum, surum: s.surum, veriSetiAd: s.veriSeti.ad, guncellenme: s.guncellenme })) })
}

/** POST — yeni şablon. */
export async function POST(req: Request) {
  const { userId, error } = await requirePermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (error) return error
  const govde = SablonGovde.safeParse(await req.json().catch(() => null))
  if (!govde.success) return NextResponse.json({ error: zodMesaj(govde.error) }, { status: 400 })
  const veriSeti = await prisma.raporVeriSeti.findUnique({ where: { id: govde.data.veriSetiId }, select: { tanim: true } })
  if (!veriSeti) return NextResponse.json({ error: 'Veri seti bulunamadı' }, { status: 400 })
  const hatalar = sablonDogrula(govde.data.icerik as SablonIcerik, Object.keys((veriSeti.tanim as unknown as VeriSetiTanim).alanlar ?? {}))
  if (hatalar.length) return NextResponse.json({ error: 'Şablon geçersiz', hatalar }, { status: 400 })
  try {
    const s = await prisma.raporSablon.create({
      data: { kod: govde.data.kod, ad: govde.data.ad, aciklama: govde.data.aciklama ?? null, veriSetiId: govde.data.veriSetiId, icerik: json(govde.data.icerik), durum: govde.data.durum, izinAnahtari: govde.data.izinAnahtari || null, olusturanId: userId },
    })
    return NextResponse.json({ sablon: s }, { status: 201 })
  } catch (e) {
    if (uniqueIhlali(e)) return NextResponse.json({ error: `'${govde.data.kod}' kodlu bir şablon zaten var` }, { status: 409 })
    throw e
  }
}

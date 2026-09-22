import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { VeriSetiGovde, json, tanimHatalari, uniqueIhlali } from '../_ortak'
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

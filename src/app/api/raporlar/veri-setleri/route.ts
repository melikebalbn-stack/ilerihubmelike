import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { json, uniqueIhlali, veriSetiGovdesi } from './_ortak'
import type { VeriSetiTanim } from '@/lib/rapor/tipler'

export const dynamic = 'force-dynamic'

/** GET — veri seti listesi. */
export async function GET() {
  const { error } = await requirePermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (error) return error
  const liste = await prisma.raporVeriSeti.findMany({
    select: { id: true, ad: true, aciklama: true, aktif: true, tanim: true, guncellenme: true, _count: { select: { sablonlar: true } } },
    orderBy: { ad: 'asc' },
  })
  return NextResponse.json({
    veriSetleri: liste.map((v) => ({
      id: v.id, ad: v.ad, aciklama: v.aciklama, aktif: v.aktif, guncellenme: v.guncellenme,
      kaynakSayisi: ((v.tanim as unknown as VeriSetiTanim)?.kaynaklar ?? []).length,
      sablonSayisi: v._count.sablonlar,
    })),
  })
}

/** POST — yeni veri seti. */
export async function POST(req: Request) {
  const { userId, error } = await requirePermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (error) return error
  const { veri, hata } = await veriSetiGovdesi(req)
  if (hata) return hata
  try {
    const v = await prisma.raporVeriSeti.create({
      data: { ad: veri.ad, aciklama: veri.aciklama ?? null, tanim: json(veri.tanim), onbellekSn: veri.onbellekSn ?? 300, aktif: veri.aktif ?? true, olusturanId: userId },
    })
    return NextResponse.json({ veriSeti: v }, { status: 201 })
  } catch (e) {
    if (uniqueIhlali(e)) return NextResponse.json({ error: `'${veri.ad}' adında bir veri seti zaten var` }, { status: 409 })
    throw e
  }
}

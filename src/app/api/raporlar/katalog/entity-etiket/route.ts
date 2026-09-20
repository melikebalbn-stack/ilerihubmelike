import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'

export const dynamic = 'force-dynamic'

const Govde = z.object({ kaynakAd: z.string().min(1), entity: z.string().min(1), etiket: z.string().trim().max(120).nullable(), aciklama: z.string().trim().max(500).nullable().optional() })

/** PATCH — entity Türkçe etiketi (rapor.katalog). Tablo rapor_katalog_entity; etiket boşsa satır silinir. */
export async function PATCH(req: Request) {
  const { error } = await requirePermission(PERMISSION_KEYS.RAPOR_KATALOG)
  if (error) return error
  const govde = Govde.safeParse(await req.json().catch(() => null))
  if (!govde.success) return NextResponse.json({ error: 'Geçersiz gövde' }, { status: 400 })
  const { kaynakAd, entity } = govde.data
  const etiket = govde.data.etiket || null
  const aciklama = govde.data.aciklama || null
  const var_ = await prisma.raporKatalog.count({ where: { kaynakAd, entity } })
  if (!var_) return NextResponse.json({ error: 'Entity katalogda bulunamadı' }, { status: 404 })
  try {
    if (!etiket && !aciklama) {
      await prisma.raporKatalogEntity.deleteMany({ where: { kaynakAd, entity } })
      return NextResponse.json({ ok: true, etiket: null })
    }
    const r = await prisma.raporKatalogEntity.upsert({ where: { kaynakAd_entity: { kaynakAd, entity } }, create: { kaynakAd, entity, etiket, aciklama }, update: { etiket, aciklama } })
    return NextResponse.json({ ok: true, etiket: r.etiket })
  } catch (e) {
    if (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2021') {
      return NextResponse.json({ error: 'rapor_katalog_entity tablosu henüz oluşturulmadı (migration bekliyor)' }, { status: 503 })
    }
    throw e
  }
}

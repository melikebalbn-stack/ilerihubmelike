import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'

export const dynamic = 'force-dynamic'

const Govde = z.object({
  kaynakAd: z.string().min(1),
  entity: z.string().min(1),
  alan: z.string().min(1),
  etiket: z.string().trim().max(120).nullable(),
  /** true → aynı alan adı bu projeksiyonun TÜM entity'lerinde etiketlenir. */
  tumEntityler: z.boolean().optional(),
})

/** PATCH — katalog alanına Türkçe etiket (rapor.katalog). Boş/null → etiket silinir. */
export async function PATCH(req: Request) {
  const { error } = await requirePermission(PERMISSION_KEYS.RAPOR_KATALOG)
  if (error) return error
  const govde = Govde.safeParse(await req.json().catch(() => null))
  if (!govde.success) return NextResponse.json({ error: 'Geçersiz gövde' }, { status: 400 })
  const { kaynakAd, entity, alan, tumEntityler } = govde.data
  const etiket = govde.data.etiket || null
  const r = await prisma.raporKatalog.updateMany({
    where: { kaynakAd, alan, ...(tumEntityler ? {} : { entity }) },
    data: { etiket },
  })
  if (r.count === 0) return NextResponse.json({ error: 'Alan katalogda bulunamadı' }, { status: 404 })
  return NextResponse.json({ ok: true, guncellenen: r.count, etiket })
}

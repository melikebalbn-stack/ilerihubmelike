import { NextResponse } from 'next/server'
import { hataYaniti } from '../../_hata'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { projeksiyonYukle } from '@/lib/rapor/katalog'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const Govde = z.object({ projeksiyon: z.string().regex(/^[A-Za-z0-9_]+$/, 'Geçersiz projeksiyon adı') })

/** POST { projeksiyon } — IFS $metadata'yı çekip rapor_katalog'a yükler (rapor.katalog). */
export async function POST(req: Request) {
  const { error } = await requirePermission(PERMISSION_KEYS.RAPOR_KATALOG)
  if (error) return error
  const govde = Govde.safeParse(await req.json().catch(() => ({})))
  if (!govde.success) return NextResponse.json({ error: govde.error.issues[0]?.message ?? 'Geçersiz gövde' }, { status: 400 })
  try {
    const sonuc = await projeksiyonYukle(govde.data.projeksiyon)
    return NextResponse.json({ projeksiyon: govde.data.projeksiyon, ...sonuc })
  } catch (e) {
    return hataYaniti(e, { kaynakTipi: 'ifs', kaynakAd: govde.data.projeksiyon }, 502, 'rapor-katalog-yukle')
  }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { alanDegerleri, tabloYok } from '../_degerler'

export const dynamic = 'force-dynamic'

/** GET ?kaynakAd&entity&alan — alanın değerleri + Türkçe etiketleri (rapor.tasarla). */
export async function GET(req: Request) {
  const { error } = await requirePermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (error) return error
  const u = new URL(req.url)
  const kaynakAd = u.searchParams.get('kaynakAd')?.trim(), entity = u.searchParams.get('entity')?.trim(), alan = u.searchParams.get('alan')?.trim()
  if (!kaynakAd || !entity || !alan) return NextResponse.json({ error: 'kaynakAd, entity ve alan zorunlu' }, { status: 400 })
  const degerler = await alanDegerleri(kaynakAd, entity, alan)
  return NextResponse.json({ degerler, ...(degerler.length === 0 ? { not: 'Değer yok: alan enum değilse elle değer ekleyebilirsiniz (tablo migration bekliyorsa da liste boş gelir).' } : {}) })
}

const Govde = z.object({
  kaynakAd: z.string().min(1),
  entity: z.string().min(1),
  alan: z.string().min(1),
  /** Kaydedilecek satırlar; etiket boş/null → etiket silinir. `kaynak` verilmezse 'ELLE'. */
  degerler: z.array(z.object({ deger: z.string().min(1).max(200), etiket: z.string().trim().max(120).nullable(), kaynak: z.enum(['ENUM', 'AI', 'ELLE']).optional() })).max(500),
  /** true → listede olmayan mevcut satırlar silinir (elle eklenen değer kaldırma). */
  eksikleriSil: z.boolean().optional(),
})

/**
 * PUT — değer etiketlerini kaydeder (rapor.katalog). Elle düzeltilen satır kaynak='ELLE' olur;
 * sonraki "AI ile doldur" bu satırların üzerine YAZMAZ (AI yalnız etiketsiz/AI satırları doldurur).
 */
export async function PUT(req: Request) {
  const { error } = await requirePermission(PERMISSION_KEYS.RAPOR_KATALOG)
  if (error) return error
  const govde = Govde.safeParse(await req.json().catch(() => null))
  if (!govde.success) return NextResponse.json({ error: govde.error.issues[0]?.message ?? 'Geçersiz gövde' }, { status: 400 })
  const { kaynakAd, entity, alan, degerler, eksikleriSil } = govde.data

  try {
    await prisma.$transaction([
      ...degerler.map((d) => {
        const etiket = d.etiket?.trim() || null
        const kaynak = d.kaynak ?? 'ELLE'
        return prisma.raporKatalogDeger.upsert({
          where: { kaynakAd_entity_alan_deger: { kaynakAd, entity, alan, deger: d.deger } },
          create: { kaynakAd, entity, alan, deger: d.deger, etiket, kaynak: etiket ? kaynak : 'ENUM' },
          update: { etiket, kaynak: etiket ? kaynak : 'ENUM' },
        })
      }),
      ...(eksikleriSil ? [prisma.raporKatalogDeger.deleteMany({ where: { kaynakAd, entity, alan, deger: { notIn: degerler.map((d) => d.deger) } } })] : []),
    ])
  } catch (e) {
    if (tabloYok(e)) return NextResponse.json({ error: 'rapor_katalog_deger tablosu henüz oluşturulmadı (migration bekliyor)' }, { status: 503 })
    throw e
  }
  return NextResponse.json({ ok: true, degerler: await alanDegerleri(kaynakAd, entity, alan) })
}

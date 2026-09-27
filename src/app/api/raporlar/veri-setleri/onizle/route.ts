import { NextResponse } from 'next/server'
import { hataYaniti } from '../../_hata'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { veriSetiCalistir } from '@/lib/rapor/veri-seti'
import { TanimSchema, tanimHatalari } from '../_ortak'
import type { VeriSetiTanim } from '@/lib/rapor/tipler'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ONIZLEME_SATIR = 20
const ONIZLEME_IFS_TOP = 100

/** Parametre değerleri tipli gelir: JSON'da Date taşınamaz, tip ipucu ile sunucuda çevrilir. */
const Govde = z.object({
  tanim: TanimSchema,
  parametreler: z.record(z.string(), z.object({ tip: z.enum(['metin', 'sayi', 'tarih']), deger: z.string() })).default({}),
})

function parametreCevir(p: Record<string, { tip: 'metin' | 'sayi' | 'tarih'; deger: string }>): { degerler: Record<string, unknown>; hatalar: string[] } {
  const degerler: Record<string, unknown> = {}
  const hatalar: string[] = []
  for (const [ad, { tip, deger }] of Object.entries(p)) {
    if (deger.trim() === '') continue
    if (tip === 'sayi') { const n = Number(deger.replace(',', '.')); if (!Number.isFinite(n)) hatalar.push(`'${ad}' sayı olmalı`); else degerler[ad] = n }
    else if (tip === 'tarih') { const d = new Date(deger); if (Number.isNaN(d.getTime())) hatalar.push(`'${ad}' geçerli tarih olmalı`); else degerler[ad] = d }
    else degerler[ad] = deger
  }
  return { degerler, hatalar }
}

/** POST { tanim, parametreler } — kaydetmeden çalıştırır; ilk 20 satır + istatistik (IFS $top ≤ 100). */
export async function POST(req: Request) {
  const { error } = await requirePermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (error) return error
  const govde = Govde.safeParse(await req.json().catch(() => null))
  if (!govde.success) return NextResponse.json({ error: govde.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }, { status: 400 })
  const tanim = govde.data.tanim as VeriSetiTanim
  const hatalar = tanimHatalari(tanim)
  if (hatalar.length) return NextResponse.json({ error: 'Tanım geçersiz', hatalar }, { status: 400 })
  const { degerler, hatalar: pHata } = parametreCevir(govde.data.parametreler)
  if (pHata.length) return NextResponse.json({ error: pHata.join('; ') }, { status: 400 })

  try {
    const sonuc = await veriSetiCalistir(tanim, degerler, { ifsTopSinir: ONIZLEME_IFS_TOP })
    return NextResponse.json({
      satirlar: sonuc.satirlar.slice(0, ONIZLEME_SATIR),
      toplamSatir: sonuc.satirlar.length,
      kaynakIstatistik: sonuc.kaynakIstatistik,
      toplamSureMs: sonuc.toplamSureMs,
      not: `IFS kaynakları önizlemede en fazla ${ONIZLEME_IFS_TOP} satır çeker`,
    })
  } catch (e) {
    return hataYaniti(e, {}, 400, 'rapor-onizle')
  }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { veriSetiCalistir } from '@/lib/rapor/veri-seti'
import { raporRender } from '@/lib/rapor/render'
import { sablonDogrula } from '@/lib/rapor/sablon-dogrula'
import { parametreleriHazirla } from '@/lib/rapor/sablon-parametre'
import type { SablonIcerik, VeriSetiTanim } from '@/lib/rapor/tipler'
import { IcerikSchema } from '../../_ortak'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ONIZLEME_SATIR = 50

/**
 * POST { parametreler, icerik?, veriSetiId? } — şablon önizlemesi: veri setini çalıştır (ilk 50 satır),
 * raporRender HTML'i döndür. `icerik` verilirse kaydedilmemiş tasarım önizlenir (id='yeni' de olabilir).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requirePermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (error) return error
  const { id } = await params
  const Govde = z.object({ parametreler: z.record(z.string(), z.unknown()).default({}), icerik: IcerikSchema.optional(), veriSetiId: z.string().optional() })
  const govde = Govde.safeParse(await req.json().catch(() => null))
  if (!govde.success) return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 })

  let icerik: SablonIcerik | null = (govde.data.icerik as SablonIcerik | undefined) ?? null
  let veriSetiId = govde.data.veriSetiId
  let kod = 'ONIZLEME'
  if (id !== 'yeni') {
    const s = await prisma.raporSablon.findUnique({ where: { id }, select: { kod: true, icerik: true, veriSetiId: true } })
    if (!s) return NextResponse.json({ error: 'Şablon bulunamadı' }, { status: 404 })
    kod = s.kod
    icerik ??= s.icerik as unknown as SablonIcerik
    veriSetiId ??= s.veriSetiId
  }
  if (!icerik || !veriSetiId) return NextResponse.json({ error: 'İçerik ve veri seti gerekli' }, { status: 400 })
  const veriSeti = await prisma.raporVeriSeti.findUnique({ where: { id: veriSetiId }, select: { tanim: true } })
  if (!veriSeti) return NextResponse.json({ error: 'Veri seti bulunamadı' }, { status: 400 })
  const tanim = veriSeti.tanim as unknown as VeriSetiTanim
  const hatalar = sablonDogrula(icerik, Object.keys(tanim.alanlar ?? {}))
  if (hatalar.length) return NextResponse.json({ error: 'Şablon geçersiz', hatalar }, { status: 400 })
  const { degerler, hatalar: pHata } = parametreleriHazirla(icerik, govde.data.parametreler)
  if (pHata.length) return NextResponse.json({ error: `Eksik/geçersiz parametre: ${pHata.join('; ')}` }, { status: 400 })

  try {
    const veri = await veriSetiCalistir(tanim, degerler, { ifsTopSinir: 200 })
    const satirlar = veri.satirlar.slice(0, ONIZLEME_SATIR)
    const calistiran = (await prisma.user.findUnique({ where: { id: userId }, select: { name: true } }))?.name ?? undefined
    const r = raporRender({ ...icerik, altBaslik: `${icerik.altBaslik ?? ''}${veri.satirlar.length > ONIZLEME_SATIR ? ` — ÖNİZLEME: ${veri.satirlar.length} satırın ilk ${ONIZLEME_SATIR}'si` : ''}`.trim() || undefined }, satirlar, { parametreler: degerler, calistiran, raporKodu: kod })
    return NextResponse.json({ html: r.html, satirSayisi: satirlar.length, toplamSatir: veri.satirlar.length, sureMs: veri.toplamSureMs + r.sureMs, kaynakIstatistik: veri.kaynakIstatistik })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 })
  }
}

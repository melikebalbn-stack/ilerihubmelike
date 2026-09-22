import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/require-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { veriSetiCalistir } from '@/lib/rapor/veri-seti'
import { calistirmaHatasiKaydet, calistirmaKaydet, raporBaglami } from '@/lib/rapor/sunucu-calistirma'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/** Tarayıcıya gönderilecek en fazla satır; aşarsa kesilir + uyarı (görünüm katmanı istemcide). */
const VERI_SATIR_SINIRI = 10_000

const Govde = z.object({ parametreler: z.record(z.string(), z.unknown()).default({}) })

/**
 * POST /api/raporlar/[id]/veri — etkileşimli rapor: veri setini çalıştırır, HAM satırları döndürür.
 * Görünüm (filtre/grup/toplam) istemcide gorunumUygula ile kurulur. Yetki/parametre/kayıt: sunucu-calistirma.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requirePermission(PERMISSION_KEYS.RAPOR_VIEW)
  if (error) return error
  const { id } = await params
  const govde = Govde.safeParse(await req.json().catch(() => ({})))
  if (!govde.success) return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 })

  const b = await raporBaglami(id, userId, govde.data.parametreler, 'EKRAN')
  if (b.hata) return b.hata
  const { sablon, tanim, degerler, kayit } = b.baglam

  const t0 = Date.now()
  try {
    const veri = await veriSetiCalistir(tanim, degerler)
    const kesildi = veri.satirlar.length > VERI_SATIR_SINIRI
    const satirlar = kesildi ? veri.satirlar.slice(0, VERI_SATIR_SINIRI) : veri.satirlar
    const sureMs = Date.now() - t0
    await calistirmaKaydet(kayit, satirlar.length, sureMs)
    return NextResponse.json({
      satirlar,
      satirSayisi: satirlar.length,
      toplamSatir: veri.satirlar.length,
      kesildi,
      ...(kesildi ? { uyari: `Veri seti ${veri.satirlar.length.toLocaleString('tr-TR')} satır döndürdü; ilk ${VERI_SATIR_SINIRI.toLocaleString('tr-TR')} satır gösteriliyor. Parametrelerle daraltın.` } : {}),
      sureMs,
      kaynakIstatistik: veri.kaynakIstatistik,
      parametreler: JSON.parse(JSON.stringify(degerler)),
    })
  } catch (e) {
    const mesaj = await calistirmaHatasiKaydet(kayit, sablon.kod, Date.now() - t0, e)
    return NextResponse.json({ error: `Rapor çalıştırılamadı: ${mesaj}` }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hesapTarihiCoz, servisKapasiteTopluGetir } from '@/lib/servis-yonetimi/kapasite'
import { generateGuzergahListesiPdfBuffer } from '@/lib/pdf/guzergah-listesi-pdf'
import {
  exportDenetimiHatasi,
  exportDenetimiYaz,
  exportYetkisiIste,
} from '@/lib/servis-yonetimi/export-denetim'

export const dynamic = 'force-dynamic'

// GET /api/servis-yonetimi/export/guzergah-listesi-pdf — Güzergâh Listesi (PDF).
// Tüm güzergâhlar (aktif+pasif); kapasite sütunları kapasite motorundan (yalnız aktifler).
// Yetki: servis.view VE servis.export; denetim fail-closed. KVKK: kişi bilgisi yok.
export async function GET() {
  const { error, userId } = await exportYetkisiIste()
  if (error) return error

  try {
    const [guzergahlar, toplu] = await Promise.all([
      prisma.servisGuzergah.findMany({
        orderBy: [{ kod: 'asc' }],
        include: {
          yerleske: { select: { kod: true, ad: true } },
          _count: { select: { duraklar: { where: { aktif: true } } } },
        },
      }),
      servisKapasiteTopluGetir(hesapTarihiCoz(null)),
    ])
    const kapasiteler = new Map(toplu.guzergahlar.map((g) => [g.guzergahId, g]))

    const satirlar = guzergahlar.map((g) => {
      const k = kapasiteler.get(g.id)
      return {
        kod: g.kod,
        ad: g.ad,
        bolge: g.bolge,
        yerleske: `${g.yerleske.kod} — ${g.yerleske.ad}`,
        durakSayisi: g._count.duraklar,
        plakalar: k?.araclar ?? [],
        dilimKod: k?.dilimKod ?? null,
        tekilPersonel: k?.tekilPersonel ?? null,
        kapasite: k?.ozet ?? null,
        aktif: g.aktif,
      }
    })
    const buf = generateGuzergahListesiPdfBuffer({ tarih: toplu.tarih, satirlar })

    if (!(await exportDenetimiYaz(userId, {
      rapor: 'GUZERGAH_LISTESI_PDF', format: 'PDF', satirSayisi: satirlar.length, filtre: { tarih: toplu.tarih },
    }))) {
      return exportDenetimiHatasi()
    }
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Guzergah-Listesi-${toplu.tarih}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Güzergâh listesi PDF export hatası:', err)
    return NextResponse.json({ ok: false, message: 'PDF oluşturulurken hata oluştu.' }, { status: 500 })
  }
}

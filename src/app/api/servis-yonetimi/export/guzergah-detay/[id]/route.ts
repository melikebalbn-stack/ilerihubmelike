import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import {
  guzergahDetayAracAtamalariniHazirla,
  guzergahDetayDuraklariniHazirla,
  guzergahDetaySoforAtamalariniHazirla,
  type GuzergahDetayPdfData,
} from '@/lib/servis-yonetimi/export'
import { generateGuzergahDetayPdfBuffer } from '@/lib/pdf/guzergah-detay-pdf'

export const dynamic = 'force-dynamic'

// GET /api/servis-yonetimi/export/guzergah-detay/[id] — PDF. servis.export izni.
// Yalnız AKTİF durak/saat/araç/şoför ataması gösterilir (pasif geçmiş kayıtlar
// bu raporun kapsamı dışında — geçmiş için "Geçmiş" (audit) ekranları var).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requirePermission('servis.export')
  if (error) return error

  const { id } = await params

  const guzergah = await prisma.servisGuzergah.findUnique({
    where: { id },
    include: { yerleske: { select: { kod: true, ad: true } } },
  })
  if (!guzergah) {
    return NextResponse.json({ ok: false, message: 'Güzergâh bulunamadı.' }, { status: 404 })
  }

  const [duraklar, aracAtamalari, soforAtamalari] = await Promise.all([
    prisma.servisGuzergahDurak.findMany({
      where: { guzergahId: id, aktif: true },
      orderBy: { sira: 'asc' },
      select: {
        sira: true,
        durak: { select: { kod: true, ad: true } },
        saatler: {
          where: { aktif: true },
          select: { saat: true, dilim: { select: { kod: true, yon: true } } },
        },
      },
    }),
    prisma.servisGuzergahAracVarsayilan.findMany({
      where: { guzergahId: id, aktif: true },
      select: {
        rol: true,
        dilim: { select: { kod: true, yon: true } },
        arac: { select: { plaka: true, kapasite: true } },
      },
    }),
    prisma.servisGuzergahSoforVarsayilan.findMany({
      where: { guzergahId: id, aktif: true },
      select: {
        rol: true,
        dilim: { select: { kod: true, yon: true } },
        sofor: { select: { adSoyad: true } },
      },
    }),
  ])

  const data: GuzergahDetayPdfData = {
    guzergah: {
      kod: guzergah.kod,
      ad: guzergah.ad,
      bolge: guzergah.bolge,
      aktif: guzergah.aktif,
      gecerlilikBaslangici: guzergah.gecerlilikBaslangici,
      gecerlilikBitisi: guzergah.gecerlilikBitisi,
      yerleske: guzergah.yerleske,
    },
    duraklar: guzergahDetayDuraklariniHazirla(duraklar),
    aracAtamalari: guzergahDetayAracAtamalariniHazirla(aracAtamalari),
    soforAtamalari: guzergahDetaySoforAtamalariniHazirla(soforAtamalari),
  }

  const pdfBuffer = generateGuzergahDetayPdfBuffer(data)
  const fileName = `Guzergah-Detay-${guzergah.kod}.pdf`.replace(/[/\\?%*:|"<>]/g, '-')

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': pdfBuffer.length.toString(),
      'Cache-Control': 'no-store',
    },
  })
}

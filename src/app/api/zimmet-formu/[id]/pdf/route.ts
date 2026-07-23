import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { ZimmetOnayDurumu } from '@/generated/prisma'
import { generateZimmetPdf } from '@/lib/zimmet/pdf'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, error } = await requireUser()
    if (error) return error

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const mod = searchParams.get('mod') === 'dijital' ? 'dijital' : 'islak'

    const zimmet = await prisma.zimmetFormu.findUnique({
      where: { id },
      include: {
        zimmetSahibi: { select: { name: true, email: true } },
        createdBy: { select: { name: true, email: true } },
      },
    })

    if (!zimmet) {
      return NextResponse.json({ error: 'Zimmet formu bulunamadı' }, { status: 404 })
    }

    // Sahip kendi tutanağını, zimmet-formu.view yetkilisi hepsini indirebilir.
    const yetkili =
      zimmet.zimmetSahibiId === user.id || (await hasPermission('zimmet-formu.view'))
    if (!yetkili) {
      return NextResponse.json({ error: 'Bu tutanağı indirme yetkiniz yok' }, { status: 403 })
    }

    if (zimmet.durum !== ZimmetOnayDurumu.ONAYLANDI) {
      return NextResponse.json({ error: 'Onay bekleniyor' }, { status: 403 })
    }

    const pdfBytes = await generateZimmetPdf({
      id: zimmet.id,
      zimmetSahibiAdi: zimmet.zimmetSahibi.name ?? zimmet.zimmetSahibi.email,
      altZimmetSahibi: zimmet.altZimmetSahibi,
      departman: zimmet.departman,
      tur: zimmet.tur,
      turDiger: zimmet.turDiger,
      seriNumarasi: zimmet.seriNumarasi,
      aciklama: zimmet.aciklama,
      ozellik: zimmet.ozellik,
      macAdresi: zimmet.macAdresi,
      pcAdi: zimmet.pcAdi,
      imeiNumarasi: zimmet.imeiNumarasi,
      verilisTarihi: zimmet.verilisTarihi,
      cihazDurumu: zimmet.cihazDurumu,
      durum: zimmet.durum,
      teslimNotu: zimmet.teslimNotu,
      teslimEdenAdi: zimmet.createdBy.name ?? zimmet.createdBy.email,
      createdAt: zimmet.createdAt,
      teslimEdenImzalandi: mod === 'dijital',
      teslimEdenImzaTarihi:
        mod === 'dijital'
          ? (zimmet.onayTarihi ?? zimmet.updatedAt).toISOString()
          : undefined,
      zimmetSahibiImzalandi: zimmet.zimmetSahibiImzaTarihi !== null,
      zimmetSahibiImzaTarihi: zimmet.zimmetSahibiImzaTarihi?.toISOString() ?? undefined,
    })

    const fileName = `zimmet-${id.slice(0, 8)}-${mod}.pdf`

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[GET /api/zimmet-formu/[id]/pdf]', err)
    return NextResponse.json({ error: 'PDF oluşturulamadı' }, { status: 500 })
  }
}

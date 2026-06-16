import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { generateOffboardingPdf, type OffboardingOrg } from '@/lib/offboarding/offboarding-pdf'

export const dynamic = 'force-dynamic'

interface Ctx {
  params: Promise<{ id: string }>
}

/**
 * GET /api/offboarding/[id]/pdf
 *
 * İK-FR-001 PDF'i üretir. Auth: offboarding.view.
 * Query:
 *   ?org=ileri-mekanik | ileri-group  (default personelTuru'ndan; logo HER ZAMAN İLERİ GROUP)
 *   ?download=1  → attachment (default inline)
 */
export async function GET(request: NextRequest, { params }: Ctx) {
  const { error } = await requirePermission('offboarding.view')
  if (error) return error

  const { id } = await params
  const form = await prisma.offboardingForm.findUnique({
    where: { id },
    include: {
      assetItems: { orderBy: { sira: 'asc' } },
      accessItems: { orderBy: { sira: 'asc' } },
      teslimAlan: { select: { name: true, email: true } },
    },
  })
  if (!form) return NextResponse.json({ error: 'Form bulunamadı' }, { status: 404 })

  // NOT: Alt onay bloğu SABİT şablon yazarlarını taşır (kontrollü doküman);
  // kaydın hazirlayanId/onaylayan1Id/onaylayan2Id alanları PDF'te kullanılmaz.

  // Marka: query > personelTuru türevi
  const orgParam = request.nextUrl.searchParams.get('org')
  const org: OffboardingOrg =
    orgParam === 'ileri-mekanik' || orgParam === 'ileri-group'
      ? orgParam
      : form.personelTuru === 'ILERI_MEKANIK'
        ? 'ileri-mekanik'
        : 'ileri-group'

  const pdfBytes = await generateOffboardingPdf({
    formNo: form.formNo,
    adSoyad: form.adSoyad,
    sicilNo: form.sicilNo,
    departman: form.departman,
    gorev: form.gorev,
    iseGirisTarihi: form.iseGirisTarihi,
    ayrilisTarihi: form.ayrilisTarihi,
    personelTuru: form.personelTuru,
    ayrilisTuru: form.ayrilisTuru,
    beyanOnay: form.beyanOnay,
    teslimEdenAd: form.teslimEdenAd,
    teslimAlanName: form.teslimAlan ? form.teslimAlan.name || form.teslimAlan.email : null,
    notes: form.notes,
    status: form.status,
    assetItems: form.assetItems,
    accessItems: form.accessItems,
    org,
  })

  const disposition = request.nextUrl.searchParams.get('download') === '1' ? 'attachment' : 'inline'
  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="IK-FR-001_${form.formNo}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}

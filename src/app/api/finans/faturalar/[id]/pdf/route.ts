import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { apiNotFound, apiForbidden, apiError } from '@/lib/api-response'
import { canAccessFaturaTakip } from '@/lib/faturalar-access'
import { resolveAndStorePdf } from '../../_lib/elogo'

// GET — faturanın eLogo PDF'ini indirir. Zaten diskte varsa direkt o dönülür; yoksa
// (arka plan taraması bulamamışsa / henüz denenmemişse) burada tekrar aranır.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    const { id } = await params
    const invoice = await prisma.invoice.findUnique({ where: { id } })
    if (!invoice) return apiNotFound('Fatura bulunamadı')

    const fs = await import('fs/promises')

    if (invoice.elogoPdfPath) {
      try {
        const bytes = await fs.readFile(invoice.elogoPdfPath)
        return servePdf(bytes, invoice.invoiceNumber)
      } catch {
        // Dosya diskten silinmiş olabilir — aşağıda tekrar dener.
      }
    }

    const dateStr = invoice.invoiceDate.toISOString().slice(0, 10)
    const result = await resolveAndStorePdf({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, invoiceDateISO: dateStr })
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { elogoCheckedAt: new Date(), ...(result && { elogoUuid: result.uuid, elogoPdfPath: result.pdfPath }) },
    })
    if (!result) return apiNotFound('Bu fatura eLogo\'da bulunamadı')

    const bytes = await fs.readFile(result.pdfPath)
    return servePdf(bytes, invoice.invoiceNumber)
  } catch (error) {
    return apiError('PDF alınırken bir hata oluştu', 500, {
      endpoint: 'finans/faturalar/[id]/pdf GET',
      error,
    })
  }
}

function servePdf(bytes: Buffer, invoiceNumber: string) {
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Fatura_${invoiceNumber}.pdf"`,
      'Content-Length': bytes.length.toString(),
    },
  })
}

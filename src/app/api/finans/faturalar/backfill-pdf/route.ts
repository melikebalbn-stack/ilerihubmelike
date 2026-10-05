import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { apiSuccess, apiForbidden, apiError } from '@/lib/api-response'
import { canAccessFaturaTakip } from '@/lib/faturalar-access'
import { backfillPdfs } from '../_lib/elogo'

// POST — PDF'i henüz olmayan TÜM eski faturalar için eLogo'da toplu arama başlatır.
// Arka planda çalışır (fire-and-forget) — yüzlerce fatura dakikalar sürebilir, HTTP isteği
// beklemeden hemen "başladı" döner. İlerleme GET ile takip edilir.
export async function POST() {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    const pending = await prisma.invoice.findMany({
      where: { elogoPdfPath: null },
      select: { id: true, invoiceNumber: true, invoiceDate: true },
    })

    void backfillPdfs(
      pending.map((p) => ({
        id: p.id,
        invoiceNumber: p.invoiceNumber,
        invoiceDateISO: p.invoiceDate.toISOString(),
      }))
    )
      .then((results) =>
        Promise.all(
          results.map((r) =>
            prisma.invoice.update({
              where: { id: r.id },
              data: {
                elogoCheckedAt: new Date(),
                ...(r.uuid && r.pdfPath && { elogoUuid: r.uuid, elogoPdfPath: r.pdfPath }),
              },
            })
          )
        )
      )
      .catch((err) => console.error('[fatura-takip] toplu eLogo PDF taraması hatası:', err))

    return apiSuccess({ started: true, count: pending.length })
  } catch (error) {
    return apiError('Toplu PDF taraması başlatılırken bir hata oluştu', 500, {
      endpoint: 'finans/faturalar/backfill-pdf POST',
      error,
    })
  }
}

// GET — ilerleme durumu: toplam / bulunan / taranıp bulunamayan / henüz taranmamış.
export async function GET() {
  try {
    const { user, error } = await requireUser()
    if (error) return error
    if (!canAccessFaturaTakip(user.role, user.department)) return apiForbidden()

    const [total, found, checkedNotFound] = await Promise.all([
      prisma.invoice.count(),
      prisma.invoice.count({ where: { elogoPdfPath: { not: null } } }),
      prisma.invoice.count({ where: { elogoPdfPath: null, elogoCheckedAt: { not: null } } }),
    ])

    return apiSuccess({
      total,
      found,
      checkedNotFound,
      remaining: total - found - checkedNotFound,
    })
  } catch (error) {
    return apiError('Durum alınırken bir hata oluştu', 500, {
      endpoint: 'finans/faturalar/backfill-pdf GET',
      error,
    })
  }
}

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Info } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ReportResultBadge, type ReportResult } from '@/components/quality/ReportResultBadge'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

/**
 * KALITE-4A stub — rapor metadata read-only kart + "doldurma sayfası
 * yakında" notu. Ölçüm doldurma UI KALITE-4B'de bu sayfayı baştan yazacak.
 */
export default async function ReportDetailStubPage({ params }: Props) {
  const { error } = await requireUser()
  if (error) redirect('/login')
  if (!(await hasPermission('quality.report.read'))) redirect('/dashboard')

  const { id } = await params
  const report = await prisma.measurementReport.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      finalizedBy: { select: { id: true, name: true, email: true } },
      _count: { select: { characteristics: true } },
    },
  })
  if (!report) notFound()

  const fmt = (d: Date | null) =>
    d
      ? new Date(d).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })
      : '—'

  return (
    <div className="container mx-auto px-6 py-8 max-w-5xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 text-slate-500">
          <Link href="/kalite/raporlar">
            <ArrowLeft className="h-4 w-4 mr-1" /> Raporlar
          </Link>
        </Button>
        <div className="flex items-center gap-3 mt-1">
          <h1 className="text-2xl font-bold text-[#1B4F72]">{report.reportNo}</h1>
          <ReportResultBadge result={report.result as ReportResult} />
        </div>
        <p className="text-sm text-slate-500 mt-1">
          {report.partName} ({report.drawingNo}-{report.revision})
        </p>
      </div>

      {/* Stub notice */}
      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 flex gap-2">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <strong>Doldurma ekranı yakında.</strong> Ölçüm girişi + auto-result +
          finalize akışı KALITE-4B'de aktif olacak. Şu an rapor metadata
          görüntülenebilir; karakter satırları arka planda hazır
          ({report._count.characteristics} satır).
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Şablon Bilgileri (snapshot)</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Form No</dt>
              <dd className="font-mono mt-0.5">{report.formNo}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Parça</dt>
              <dd className="font-medium mt-0.5">{report.partName}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Resim No</dt>
              <dd className="font-mono mt-0.5">{report.drawingNo}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Revizyon</dt>
              <dd className="font-mono mt-0.5">{report.revision}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Rapor Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Lot No</dt>
              <dd className="font-mono mt-0.5">{report.lotNo ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Operatör No</dt>
              <dd className="font-mono mt-0.5">{report.operatorNo ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">İş Emri Miktarı</dt>
              <dd className="tabular-nums mt-0.5">{report.orderQty ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Makina</dt>
              <dd className="mt-0.5">{report.machine ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Mastar No</dt>
              <dd className="font-mono mt-0.5">{report.gaugeNo ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Eskalasyon</dt>
              <dd className="mt-0.5">{report.escalationContact ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Ölçüm Tarihi</dt>
              <dd className="mt-0.5">{fmt(report.measurementDate)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Oluşturan</dt>
              <dd className="mt-0.5">
                {report.createdBy?.name ?? report.createdBy?.email ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Oluşturma</dt>
              <dd className="mt-0.5">{fmt(report.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Finalize</dt>
              <dd className="mt-0.5">{fmt(report.finalizedAt)}</dd>
            </div>
            {report.finalizedBy && (
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-slate-500">
                  Finalize Eden
                </dt>
                <dd className="mt-0.5">
                  {report.finalizedBy.name ?? report.finalizedBy.email}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {report.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notlar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{report.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

import { redirect } from 'next/navigation'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import Link from 'next/link'
import { Plus, ClipboardCheck } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { ReportsListTable } from '@/components/quality/ReportsListTable'

export const dynamic = 'force-dynamic'

export default async function ReportsListPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canRead = await hasPermission('quality.report.read')
  if (!canRead) return <YetkisizErisim permission="quality.report.read" />

  const canCreate = await hasPermission('quality.report.create')

  // Filter dropdown için aktif şablonlar
  const templates = await prisma.measurementTemplate.findMany({
    where: { active: true },
    orderBy: [{ partName: 'asc' }, { revision: 'asc' }],
    select: { id: true, partName: true, drawingNo: true, revision: true },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Ölçüm Raporları
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Lot başına oluşturulan ölçüm raporları
          </p>
        </div>
        {canCreate && (
          <Button asChild className="bg-[#1B4F72] hover:bg-[#1B4F72]/90">
            <Link href="/kalite/raporlar/yeni">
              <Plus className="h-4 w-4 mr-1" />
              Yeni Rapor
            </Link>
          </Button>
        )}
      </div>

      <ReportsListTable templates={templates} />
    </div>
  )
}

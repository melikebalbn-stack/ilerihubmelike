import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, ClipboardList } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { prisma } from '@/lib/prisma'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const dynamic = 'force-dynamic'

export default async function TemplatesListPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canManage = await hasPermission('quality.template.manage')
  const canRead = await hasPermission([
    'quality.template.manage',
    'quality.report.create',
  ])
  if (!canRead) redirect('/dashboard')

  const templates = await prisma.measurementTemplate.findMany({
    orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      formNo: true,
      partName: true,
      drawingNo: true,
      revision: true,
      operation: true,
      department: true,
      active: true,
      createdAt: true,
      _count: { select: { characteristics: true, reports: true } },
    },
  })

  const activeCount = templates.filter((t) => t.active).length

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1B4F72] flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            Ölçüm Şablonları
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {templates.length} şablon ({activeCount} aktif)
          </p>
        </div>
        {canManage && (
          <Button asChild className="bg-[#1B4F72] hover:bg-[#1B4F72]/90">
            <Link href="/kalite/sablonlar/yeni">
              <Plus className="h-4 w-4 mr-1" />
              Yeni Şablon
            </Link>
          </Button>
        )}
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-600 mb-4">Henüz şablon tanımlanmamış</p>
            {canManage && (
              <Button asChild className="bg-[#1B4F72] hover:bg-[#1B4F72]/90">
                <Link href="/kalite/sablonlar/yeni">
                  <Plus className="h-4 w-4 mr-1" />
                  Yeni Şablon
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form No</TableHead>
                  <TableHead>Parça Adı</TableHead>
                  <TableHead>Resim No</TableHead>
                  <TableHead>Rev.</TableHead>
                  <TableHead>Operasyon</TableHead>
                  <TableHead className="text-right">Karakter</TableHead>
                  <TableHead className="text-right">Rapor</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Oluşturma</TableHead>
                  <TableHead className="text-right">Eylem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.formNo}</TableCell>
                    <TableCell className="font-medium">{t.partName}</TableCell>
                    <TableCell className="font-mono text-xs">{t.drawingNo}</TableCell>
                    <TableCell className="font-mono text-xs">{t.revision}</TableCell>
                    <TableCell className="text-sm">
                      {t.operation ? (
                        t.operation
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t._count.characteristics}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-500">
                      {t._count.reports}
                    </TableCell>
                    <TableCell>
                      {t.active ? (
                        <Badge variant="default" className="bg-emerald-600">Aktif</Badge>
                      ) : (
                        <Badge variant="outline">Pasif</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {new Date(t.createdAt).toLocaleDateString('tr-TR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/kalite/sablonlar/${t.id}`}>
                          {canManage ? 'Düzenle' : 'Görüntüle'}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

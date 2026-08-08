import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, PackageOpen } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { canManageRma } from '@/lib/quality/rma-access'
import { Button } from '@/components/ui/button'
import { RmaListTable } from '@/components/quality/rma/RmaListTable'

export const dynamic = 'force-dynamic'

/**
 * RMA/SMA İade Formu listesi (KAL-KYT-16).
 * Okuma: oturumu olan herkes (permission gate YOK — kasıtlı). Oturumsuz → /login.
 * "Yeni Kayıt" yalnız canManageRma'ya görünür.
 */
export default async function RmaListPage() {
  const { session, error } = await requireUser()
  if (error) redirect('/login')

  const canManage = canManageRma(session)

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#1B4F72] flex items-center gap-2">
            <PackageOpen className="h-6 w-6" />
            RMA/SMA İade Formu
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Müşteri iade takip kayıtları (KAL-KYT-16)
          </p>
        </div>
        {canManage && (
          <Button asChild className="bg-[#1B4F72] hover:bg-[#1B4F72]/90 shrink-0">
            <Link href="/kalite/rma/yeni" className="inline-flex items-center gap-1 whitespace-nowrap shrink-0">
              <Plus className="h-4 w-4 shrink-0" />
              Yeni Kayıt
            </Link>
          </Button>
        )}
      </div>

      <RmaListTable />
    </div>
  )
}

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, LogOut } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { Button } from '@/components/ui/button'
import { OffboardingListClient } from '@/components/offboarding/OffboardingListClient'

export const dynamic = 'force-dynamic'

export default async function OffboardingListPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canView = await hasPermission('offboarding.view')
  if (!canView) redirect('/dashboard')

  const canCreate = await hasPermission('offboarding.create')

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1B4F72] flex items-center gap-2">
            <LogOut className="h-6 w-6" />
            İlişik Kesme / Zimmet İade
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Görevi sona eren personel ve yüklenici için varlık ve yetki iadesi süreci
          </p>
        </div>
        {canCreate && (
          <Button asChild className="bg-[#1B4F72] hover:bg-[#1B4F72]/90">
            <Link href="/offboarding/new">
              <Plus className="h-4 w-4 mr-1" />
              Yeni İlişik Kesme
            </Link>
          </Button>
        )}
      </div>

      <OffboardingListClient />
    </div>
  )
}

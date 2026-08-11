import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, ClipboardX } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { canManageUygunsuzluk } from '@/lib/quality/uygunsuzluk-access'
import { Button } from '@/components/ui/button'
import { UygunsuzlukListTable } from '@/components/quality/uygunsuzluk/UygunsuzlukListTable'

export const dynamic = 'force-dynamic'

/**
 * Kalite uygunsuzluk listesi (KAL-KYT-15 Bölüm 2).
 * Okuma: oturumu olan herkes (permission gate YOK — API GET'i de oturum yeterli).
 * "Yeni Kayıt" yalnız canManageUygunsuzluk'a görünür.
 */
export default async function UygunsuzlukListPage() {
  const { session, error } = await requireUser()
  if (error) redirect('/login')

  const canManage = canManageUygunsuzluk(session)

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#1B4F72] flex items-center gap-2">
            <ClipboardX className="h-6 w-6" />
            Uygunsuzluk Kayıtları
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kalite uygunsuzluk formu (KAL-KYT-15 Bölüm 2)
          </p>
        </div>
        {canManage && (
          <Button asChild className="bg-[#1B4F72] hover:bg-[#1B4F72]/90 shrink-0">
            <Link href="/kalite/uygunsuzluk/yeni" className="inline-flex items-center gap-1 whitespace-nowrap">
              <Plus className="h-4 w-4 shrink-0" />
              Yeni Kayıt
            </Link>
          </Button>
        )}
      </div>

      <UygunsuzlukListTable canManage={canManage} />
    </div>
  )
}

import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { canManageUygunsuzluk } from '@/lib/quality/uygunsuzluk-access'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { UygunsuzlukFormClient } from '@/components/quality/uygunsuzluk/UygunsuzlukFormClient'

export const dynamic = 'force-dynamic'

/** Yeni uygunsuzluk kaydı — yalnız canManageUygunsuzluk. Oturumsuz → /login. */
export default async function UygunsuzlukYeniPage() {
  const { session, error } = await requireUser()
  if (error) redirect('/login')
  if (!canManageUygunsuzluk(session)) return <YetkisizErisim permission="uygunsuzluk.manage" />

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      <UygunsuzlukFormClient initial={null} canManage />
    </div>
  )
}

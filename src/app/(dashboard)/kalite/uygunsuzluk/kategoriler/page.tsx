import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { canManageUygunsuzluk } from '@/lib/quality/uygunsuzluk-access'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { KategoriYonetimiClient } from '@/components/quality/uygunsuzluk/KategoriYonetimiClient'

export const dynamic = 'force-dynamic'

/** Uygunsuzluk kategorileri yönetimi — yalnız canManageUygunsuzluk. */
export default async function UygunsuzlukKategorilerPage() {
  const { session, error } = await requireUser()
  if (error) redirect('/login')
  if (!canManageUygunsuzluk(session)) return <YetkisizErisim permission="uygunsuzluk.manage" />

  return (
    <div className="container mx-auto px-6 py-8 max-w-2xl">
      <KategoriYonetimiClient />
    </div>
  )
}

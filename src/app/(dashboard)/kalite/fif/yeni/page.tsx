import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { canManageFif } from '@/lib/quality/fif-access'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { FifFormClient } from '@/components/quality/fif/FifFormClient'

export const dynamic = 'force-dynamic'

/** Yeni FİF — yalnız canManageFif. Oturumsuz → /login. */
export default async function FifYeniPage() {
  const { session, error } = await requireUser()
  if (error) redirect('/login')
  if (!canManageFif(session)) return <YetkisizErisim permission="fif.manage" />

  return (
    <div className="container mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-[#1B4F72] mb-6">Yeni FİF</h1>
      <FifFormClient initial={null} />
    </div>
  )
}

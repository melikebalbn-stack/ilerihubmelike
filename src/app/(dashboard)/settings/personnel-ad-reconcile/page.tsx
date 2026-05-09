import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Link2 } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { ReconcileClient } from './reconcile-client'

export default async function PersonnelAdReconcilePage() {
  const { user, error } = await requireUser()
  if (error) redirect('/login')
  if (user.role !== 'SUPER_ADMIN') redirect('/dashboard')

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      <nav className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
        <Link href="/settings" className="hover:text-foreground">
          Ayarlar
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span>Yetkilendirme</span>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">AD Eşleşme</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Link2 className="h-6 w-6 text-teal-600" />
          Personnel ↔ AD Eşleşme
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aktif kullanıcı ile Personnel kayıtları arasındaki bağlantıları yönet.
          Otomatik öneriler eşleşmeleri hızlandırır; manuel bind son adım.
        </p>
      </div>

      <ReconcileClient />
    </div>
  )
}

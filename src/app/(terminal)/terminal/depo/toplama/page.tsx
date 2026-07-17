import { requirePermission } from '@/lib/auth/require-permission'
import { MalzemeToplamaClient } from './_client'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Malzeme Toplama' }

// Malzeme Toplama (EL-6a). Guard: admin.system.manage. SADECE OKUMA (yazma EL-6b).
export default async function MalzemeToplamaPage() {
  const { error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Bu ekran için yetkiniz bulunmuyor.
      </div>
    )
  }

  return <MalzemeToplamaClient />
}

import { requirePermission } from '@/lib/auth/require-permission'
import { StokTasimaClient } from './_client'

export const dynamic = 'force-dynamic'

// Stok Taşıma sihirbazı (EL-2, mock). Guard: admin.system.manage.
export default async function StokTasimaPage() {
  const { error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Bu ekran için yetkiniz bulunmuyor.
      </div>
    )
  }

  return <StokTasimaClient />
}

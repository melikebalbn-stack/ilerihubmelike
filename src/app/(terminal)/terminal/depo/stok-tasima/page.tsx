import { requirePermission } from '@/lib/auth/require-permission'
import { TerminalYetkiYok } from '../../_shared'
import { StokTasimaClient } from './_client'

export const dynamic = 'force-dynamic'

// Stok Taşıma sihirbazı. Guard: depo.terminal.use | admin.system.manage.
export default async function StokTasimaPage() {
  const { error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return <TerminalYetkiYok />

  return <StokTasimaClient />
}

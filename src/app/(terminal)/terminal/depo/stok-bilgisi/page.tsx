import { requirePermission } from '@/lib/auth/require-permission'
import { TerminalYetkiYok } from '../../_shared'
import { StokBilgisiClient } from './_client'

export const dynamic = 'force-dynamic'

// Malzeme Stok Bilgisi (salt okuma). Guard: depo.terminal.use | admin.system.manage.
export default async function StokBilgisiPage() {
  const { error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return <TerminalYetkiYok />

  return <StokBilgisiClient />
}

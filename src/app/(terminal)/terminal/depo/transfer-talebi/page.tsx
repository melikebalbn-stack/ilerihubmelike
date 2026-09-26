import { requirePermission } from '@/lib/auth/require-permission'
import { TerminalYetkiYok } from '../../_shared'
import { TransferTalebiClient } from './_client'

export const dynamic = 'force-dynamic'

// Transfer Talebi (IFS TRDST taşıma talebi — onaylı talebe stok bağla, transfer et). Guard: depo.terminal.use | admin.system.manage.
export default async function TransferTalebiPage() {
  const { error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return <TerminalYetkiYok />

  return <TransferTalebiClient />
}

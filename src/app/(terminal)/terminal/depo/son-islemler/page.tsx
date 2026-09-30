import { requirePermission } from '@/lib/auth/require-permission'
import { TerminalYetkiYok } from '../../_shared'
import { SonIslemlerClient } from './_client'

export const dynamic = 'force-dynamic'

// Son İşlemlerim — operatörün kendi depo hareketleri + geri alma. Guard: depo.terminal.use | admin.system.manage.
export default async function SonIslemlerPage() {
  const { error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return <TerminalYetkiYok />

  return <SonIslemlerClient />
}

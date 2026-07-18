import { requirePermission } from '@/lib/auth/require-permission'
import { TerminalYetkiYok } from '../../_shared'
import { DepoYardimClient } from './_client'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'El Terminali — Yardım' }

// Depo el terminali tanıtım/yardım rehberi. SALT STATİK içerik — API/DB çağrısı YOK.
// Guard: depo.terminal.use | admin.system.manage (diğer depo sayfalarıyla aynı desen).
export default async function DepoYardimPage() {
  const { session, error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return <TerminalYetkiYok />

  return <DepoYardimClient operatorName={session.user.name ?? 'Operatör'} />
}

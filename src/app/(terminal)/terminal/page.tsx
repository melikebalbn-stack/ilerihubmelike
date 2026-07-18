import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/auth/require-permission'
import { getUserPermissions } from '@/lib/auth/get-user-permissions'
import { TerminalYetkiYok } from './_shared'
import { TerminalRootClient } from './_client'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Terminal Yönlendirici' }

// Terminal kök yönlendiricisi.
// - Yönetici (admin.system.manage) → yönlendirici ekranını görür (depo + üretim kartları).
// - Yalnız depo operatörü (depo.terminal.use, admin YOK) → doğrudan /terminal/depo.
// TODO: üretim rolü → /terminal/uretim yönlendirmesi (kapsam dışı, ayrı iş).
export default async function TerminalRootPage() {
  const { session, error } = await requirePermission(['depo.terminal.use', 'admin.system.manage'])
  if (error) return <TerminalYetkiYok />

  // Depo operatörü (admin değil) → yönlendiriciyi atla, doğrudan depoya git.
  const perms = await getUserPermissions(session.user.id)
  if (perms.has('depo.terminal.use') && !perms.has('admin.system.manage')) {
    redirect('/terminal/depo')
  }

  return <TerminalRootClient operatorName={session.user.name ?? 'Operatör'} />
}

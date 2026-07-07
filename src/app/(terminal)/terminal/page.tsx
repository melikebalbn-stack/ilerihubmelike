import { requirePermission } from '@/lib/auth/require-permission'
import { TerminalRootClient } from './_client'

export const dynamic = 'force-dynamic'

// Terminal kök menüsü (EL-1). Guard geçici: admin.system.manage (terminal pattern'i).
export default async function TerminalRootPage() {
  const { session, error } = await requirePermission('admin.system.manage')
  if (error) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Bu ekran için yetkiniz bulunmuyor.
      </div>
    )
  }

  return <TerminalRootClient operatorName={session.user.name ?? 'Operatör'} />
}

import { requirePermission } from '@/lib/auth/require-permission'
import { TerminalRootClient } from './_client'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Terminal Yönlendirici' }

// Terminal kök yönlendiricisi. Guard geçici: admin.system.manage (yalnız yönetici).
// TODO: rol bazlı otomatik yönlendirme — uretim rolü → /terminal/uretim,
// depo rolü → /terminal/depo; yönetici bu yönlendirici ekranını görür.
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

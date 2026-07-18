import { requirePermission } from '@/lib/auth/require-permission'
import { MOCK_IS_MERKEZI, type TerminalIsEmri } from '@/lib/uretim/terminal-mock'
import { getShopOrderOperations } from '@/lib/ifs/shop-order-operations'
import { IsEmirleriClient } from './_client'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'IPRO — İş Emirleri' }

// Üretim Terminali — iş emri listesi (E1). Guard geçici (admin.system.manage).
// Veri GERÇEK IFS'ten (ShopOrderOperations). İş merkezi şimdilik sabit
// (MOCK_IS_MERKEZI); ileride Workstation modeline bağlanacak.
export default async function IsEmirleriPage() {
  const { session, error } = await requirePermission('admin.system.manage')
  if (error) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Bu ekran için yetkiniz bulunmuyor.
      </div>
    )
  }

  let isEmirleri: TerminalIsEmri[] = []
  let ifsError: string | null = null
  try {
    isEmirleri = await getShopOrderOperations({ workCenter: MOCK_IS_MERKEZI.kod })
  } catch (e) {
    ifsError = e instanceof Error ? e.message : 'IFS verisi alınamadı'
  }

  return (
    <IsEmirleriClient
      operatorName={session.user.name ?? 'Operatör'}
      isMerkezi={MOCK_IS_MERKEZI.kod}
      isEmirleri={isEmirleri}
      error={ifsError}
    />
  )
}

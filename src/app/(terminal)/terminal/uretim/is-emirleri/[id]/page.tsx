import { requirePermission } from '@/lib/auth/require-permission'
import type { TerminalIsEmri } from '@/lib/uretim/terminal-mock'
import { getShopOrderOperation } from '@/lib/ifs/shop-order-operations'
import { IsEmriDetayClient } from './_client'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

// Üretim Terminali — iş emri detay/başlat (E1). Guard geçici (admin.system.manage).
// id formatı `${orderNo}-${operationNo}`; kayıt GERÇEK IFS'ten (ShopOrderOperations).
export default async function IsEmriDetayPage({ params }: PageProps) {
  const { session, error } = await requirePermission('admin.system.manage')
  if (error) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Bu ekran için yetkiniz bulunmuyor.
      </div>
    )
  }

  const { id } = await params
  // id = `${orderNo}-${operationNo}` — son '-' den böl (orderNo tire içerebilir).
  const sep = id.lastIndexOf('-')
  const orderNo = sep > 0 ? id.slice(0, sep) : id
  const operationNo = sep > 0 ? Number(id.slice(sep + 1)) : NaN

  let isEmri: TerminalIsEmri | null = null
  let ifsError: string | null = null
  if (orderNo && Number.isFinite(operationNo)) {
    try {
      isEmri = await getShopOrderOperation(orderNo, operationNo)
    } catch (e) {
      ifsError = e instanceof Error ? e.message : 'IFS verisi alınamadı'
    }
  }

  return (
    <IsEmriDetayClient
      operatorName={session.user.name ?? 'Operatör'}
      isEmri={isEmri}
      error={ifsError}
    />
  )
}

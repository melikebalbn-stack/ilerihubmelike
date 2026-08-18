import { requirePermission } from '@/lib/auth/require-permission'
import { getShopOrderOperations } from '@/lib/ifs/shop-order-operations'
import { TerminalMenuClient } from './_client'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'IPRO' }

// Üretim Terminali — ana menü (T1). Guard geçici: /uretim/bildirim ile aynı
// admin.system.manage kontrolü (ayrı iş). İş merkezi ARTIK sabit değil: operatör
// açık iş emri olan iş merkezlerinden birini seçer (?wc query ile taşınır).
export default async function UretimTerminalPage({
  searchParams,
}: {
  searchParams: Promise<{ wc?: string }>
}) {
  const { session, error } = await requirePermission('admin.system.manage')
  if (error) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Bu ekran için yetkiniz bulunmuyor.
      </div>
    )
  }

  const { wc } = await searchParams
  const seciliWc = typeof wc === 'string' && wc.trim() ? wc.trim() : null

  // Açık iş emirlerinin DISTINCT iş merkezleri (açık iş adediyle) — seçim listesi.
  // Kaynak: IFS ShopOrderOperations (getShopOrderOperations import; DEĞİŞTİRİLMEDİ).
  // Açık işi olmayan WC gösterilmez. Operasyon verisi WC ADI vermez → kod + adet.
  let merkezler: { kod: string; adet: number }[] = []
  let ifsError: string | null = null
  try {
    const ops = await getShopOrderOperations({})
    const sayac = new Map<string, number>()
    for (const o of ops) {
      if (o.isMerkezi) sayac.set(o.isMerkezi, (sayac.get(o.isMerkezi) ?? 0) + 1)
    }
    merkezler = [...sayac.entries()]
      .map(([kod, adet]) => ({ kod, adet }))
      .sort((a, b) => b.adet - a.adet || a.kod.localeCompare(b.kod, 'tr'))
  } catch (e) {
    ifsError = e instanceof Error ? e.message : 'IFS verisi alınamadı'
  }

  return (
    <TerminalMenuClient
      operatorName={session.user.name ?? 'Operatör'}
      merkezler={merkezler}
      seciliWc={seciliWc}
      ifsError={ifsError}
    />
  )
}

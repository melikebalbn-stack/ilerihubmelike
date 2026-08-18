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

  // Açık iş emirlerinin DISTINCT iş merkezleri (kod + ad + açık iş adedi) — seçim
  // listesi. Kaynak: IFS ShopOrderOperations. Açık işi olmayan WC gösterilmez.
  // Ad = WorkCenterDescription (operasyon kaydından); ilk boş-olmayan değer alınır.
  let merkezler: { kod: string; ad: string; adet: number }[] = []
  let ifsError: string | null = null
  try {
    const ops = await getShopOrderOperations({})
    const sayac = new Map<string, number>()
    const adlar = new Map<string, string>()
    for (const o of ops) {
      if (!o.isMerkezi) continue
      sayac.set(o.isMerkezi, (sayac.get(o.isMerkezi) ?? 0) + 1)
      if (o.isMerkeziAdi && !adlar.get(o.isMerkezi)) adlar.set(o.isMerkezi, o.isMerkeziAdi)
    }
    merkezler = [...sayac.entries()]
      .map(([kod, adet]) => ({ kod, ad: adlar.get(kod) ?? '', adet }))
      .sort((a, b) => b.adet - a.adet || a.kod.localeCompare(b.kod, 'tr'))
  } catch (e) {
    ifsError = e instanceof Error ? e.message : 'IFS verisi alınamadı'
  }

  // Seçili WC'nin adı (menü başlığında kod yerine ad göstermek için).
  const seciliWcAd = seciliWc ? (merkezler.find((m) => m.kod === seciliWc)?.ad ?? '') : ''

  return (
    <TerminalMenuClient
      operatorName={session.user.name ?? 'Operatör'}
      merkezler={merkezler}
      seciliWc={seciliWc}
      seciliWcAd={seciliWcAd}
      ifsError={ifsError}
    />
  )
}

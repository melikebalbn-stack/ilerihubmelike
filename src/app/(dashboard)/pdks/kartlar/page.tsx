import { redirect } from 'next/navigation'
import { CreditCard } from 'lucide-react'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { KartlarClient } from '@/components/pdks/KartlarClient'

export const dynamic = 'force-dynamic'

// PDKS Faz 2 — kart yönetimi. Okuma pdks.view (veya manage), yazma pdks.manage. Guard sidebar ile birebir.
export default async function PdksKartlarPage({ searchParams }: { searchParams: Promise<{ kartNo?: string }> }) {
  const { error } = await requireUser()
  if (error) redirect('/login')

  if (!(await hasPermission(['pdks.view', 'pdks.manage']))) return <YetkisizErisim permission="pdks.view" />
  const canManage = await hasPermission('pdks.manage')
  const { kartNo } = await searchParams
  // Yalnız kart no biçimindeki değer ön-doldurulur (Geçiş Kayıtları › Personele bağla).
  const baslangicKartNo = kartNo && /^[\d\s-]{3,12}$/.test(kartNo) ? kartNo : undefined

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1B4F72]">
          <CreditCard className="h-6 w-6" />
          Kartlar
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Geçiş kartları ve panel senkronu. Aktif/pasif kaynağı Hub personel kaydıdır; personel pasife
          alınınca kartı otomatik kapatılır ve panelden silinir.
        </p>
      </div>
      <KartlarClient canManage={canManage} baslangicKartNo={baslangicKartNo} />
    </div>
  )
}

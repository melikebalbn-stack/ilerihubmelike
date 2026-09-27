import { redirect } from 'next/navigation'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { CalendarDays } from 'lucide-react'
import { TakvimBolumu } from '@/components/ipro/yonetim/TakvimClient'

export const dynamic = 'force-dynamic'

// PDKS Faz 4 — tatil takvimi. TEK TATİL TAKVİMİ: IproTatil (IPRO OEE, SLA ve PDKS ortak okur).
// Düzenleme ipro.takvim.yonet VEYA pdks.manage. PDKS hafta sonu kuralı (Cumartesi + Pazar) kodda
// türetilir; IPRO yalnız Pazar'ı tatil sayar — takvimdeki renk IPRO görünümüdür.
export default async function PdksTatillerPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')
  if (!(await hasPermission(['pdks.manage', 'ipro.takvim.yonet']))) return <YetkisizErisim permission="pdks.manage" />
  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1B4F72]"><CalendarDays className="h-6 w-6" /> Tatil Takvimi</h1>
        <p className="mt-1 text-sm text-slate-500">
          Şirketin tek tatil takvimi — IPRO (üretim) ve PDKS (puantaj) aynı kayıtları kullanır. PDKS’de Cumartesi ve Pazar
          her zaman hafta sonudur; “Yarım gün” bitişi 13:00; “Mesai (çalışılan gün)” tipi yalnız IPRO içindir, PDKS’de mesai
          yalnız onaylı mesai formundan gelir.
        </p>
      </div>
      <TakvimBolumu canEdit />
    </div>
  )
}

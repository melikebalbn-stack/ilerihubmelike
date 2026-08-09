import { redirect } from 'next/navigation'
import { Info, ListTree } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { canManageHataKodu } from '@/lib/quality/hata-kodu-access'
import { HataKoduAgacClient } from '@/components/quality/hata-kodu/HataKoduAgacClient'

export const dynamic = 'force-dynamic'

/**
 * Kalite hata kodları yönetim ekranı (KAL-KYT-15 Bölüm 1).
 *
 * Okuma: oturumu olan herkes (permission gate YOK — API GET'i de oturum yeterli).
 * Yazma kontrolleri yalnız canManageHataKodu'ya render edilir.
 * Menüde ise kalem yalnız kalite ekibine / izin sahibine görünür — RMA'dan farklı
 * olarak bu bir ayar ekranı, herkesin menüsünde durmasına gerek yok.
 */
export default async function HataKodlariPage() {
  const { session, error } = await requireUser()
  if (error) redirect('/login')

  const canManage = canManageHataKodu(session)

  return (
    <div className="container mx-auto px-6 py-8 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1B4F72] flex items-center gap-2">
          <ListTree className="h-6 w-6" />
          Hata Kodları
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Kalite hata kodu ağacı (KAL-KYT-15 Bölüm 1) — bölüm başlıkları ve alt kodlar.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Hata kodları geçmiş kalite kayıtlarıyla ilişkilidir. Kullanılmayan kodları pasif
          yapın; kod silme kapalıdır.
        </span>
      </div>

      <HataKoduAgacClient canManage={canManage} />
    </div>
  )
}

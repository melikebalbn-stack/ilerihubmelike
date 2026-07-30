import { redirect } from 'next/navigation'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'

// Fabrika Haritası (izleme ekranı) — IPRO tezgahlarının izometrik temsili sahnesi.
// Sahne tek dosyalık, kendi inline style/script'iyle çalışan bir HTML'dir; React'e
// dönüştürülmez. Next hydration'ına karışmasın diye auth arkasındaki bir route'tan
// (sahne/route.ts) servis edilip iframe içinde izole çalıştırılır.
export const dynamic = 'force-dynamic'

export default async function IproHaritaPage({
  searchParams,
}: {
  searchParams: Promise<{ tv?: string }>
}) {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canView = await hasPermission('ipro.view')
  const canAdmin = await hasPermission('ipro.admin')
  if (!canView && !canAdmin) return <YetkisizErisim permission="ipro.view" />

  const sp = await searchParams
  // ?tv=1 sahneye ulaşmalı (TV/duvar ekranı modu). iframe src'ine forward edilir.
  const src = sp?.tv === '1' ? '/ipro/harita/sahne?tv=1' : '/ipro/harita/sahne'

  // iframe: header hariç viewport'u kaplar. Dashboard <main> padding'ini (p-4/lg:p-6)
  // negatif margin ile geri alıp tam ekran veririz; border yok.
  return (
    <div className="-m-4 lg:-m-6 h-[calc(100dvh-3.5rem)] lg:h-[calc(100dvh-4rem)]">
      <iframe
        src={src}
        title="Fabrika Haritası"
        className="h-full w-full border-0"
      />
    </div>
  )
}

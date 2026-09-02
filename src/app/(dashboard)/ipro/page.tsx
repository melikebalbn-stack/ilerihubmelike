import { redirect } from 'next/navigation'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { IproKapakClient } from './_client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'IPRO' }

// IPRO kapak sayfası — modül kartları. Canlı veri YOK (istenmedi); yalnız yetkiye
// göre görünen kart/pill listesi. Guard: ipro.view | ipro.admin (kardeş IPRO sayfa
// deseni). Her hedefin görünürlüğü kendi guard'ına göre — Sidebar iproMenuItems
// permission dizileriyle BİREBİR (takvim 3-yollu, sinyal admin-only).
export default async function IproKapakPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canView = await hasPermission('ipro.view')
  const canAdmin = await hasPermission('ipro.admin')
  if (!canView && !canAdmin) return <YetkisizErisim permission="ipro.view" />

  const canTakvim = await hasPermission('ipro.takvim.yonet')
  const viewOrAdmin = canView || canAdmin

  // Hedef → guard (Sidebar iproMenuItems ile aynı). İzinli href'ler client'a geçer;
  // client statik kart/pill tanımlarını bu kümeyle süzer (ikon/görsel client'ta).
  const izinli = (href: string): boolean => {
    switch (href) {
      case '/ipro/takvim':
        return viewOrAdmin || canTakvim // ipro.view | ipro.admin | ipro.takvim.yonet
      case '/ipro/sinyal':
        return canAdmin // yalnız ipro.admin
      default:
        return viewOrAdmin // diğer tüm hedefler: ipro.view | ipro.admin
    }
  }

  const tumHedefler = [
    '/ipro/izleme', '/ipro/oee', '/terminal/uretim', '/ipro/harita', '/ipro/is-emirleri', '/ipro/tezgahlar',
    '/ipro/operator-eslemeleri', '/ipro/sebepler', '/ipro/takvim', '/ipro/kiosklar', '/ipro/ifs-eslemeleri', '/ipro/sinyal',
  ]
  const izinliHedefler = tumHedefler.filter(izinli)

  return <IproKapakClient izinliHedefler={izinliHedefler} />
}

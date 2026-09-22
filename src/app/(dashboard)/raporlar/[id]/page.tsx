import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { etkilesimliMi, type SablonIcerik, type VeriSetiTanim } from '@/lib/rapor/tipler'
import { veriSetiAlanlari } from '@/lib/rapor/veri-seti-alanlar'
import RaporCalistirClient from './_components/rapor-calistir-client'
import EtkilesimliRapor from './_components/etkilesimli-rapor'

export const dynamic = 'force-dynamic'

// Raporlar → çalıştırma. rapor.view + (şablonun izinAnahtari varsa o izin). Şablon türüne göre:
// 'etkilesimli' → EtkilesimliRapor (ham veri /veri, görünüm istemcide), 'belge' → mevcut A4 ekranı.
export default async function RaporCalistirPage({ params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canView = await hasPermission(PERMISSION_KEYS.RAPOR_VIEW)
  if (!canView) return <YetkisizErisim permission={PERMISSION_KEYS.RAPOR_VIEW} />

  const { id } = await params
  const sablon = await prisma.raporSablon.findUnique({
    where: { id },
    select: { id: true, kod: true, ad: true, aciklama: true, durum: true, surum: true, izinAnahtari: true, veriSetiId: true, icerik: true, veriSeti: { select: { ad: true, tanim: true } } },
  })
  if (!sablon || sablon.durum === 'ARSIV') notFound()
  const tasarlayabilir = await hasPermission(PERMISSION_KEYS.RAPOR_TASARLA)
  if (sablon.durum === 'TASLAK' && !tasarlayabilir) return <YetkisizErisim permission={PERMISSION_KEYS.RAPOR_TASARLA} />
  if (sablon.izinAnahtari && !(await hasPermission(sablon.izinAnahtari))) return <YetkisizErisim permission={sablon.izinAnahtari} />

  if (etkilesimliMi(sablon.icerik)) {
    const alanlar = await veriSetiAlanlari(sablon.veriSeti.tanim as unknown as VeriSetiTanim)
    return (
      <EtkilesimliRapor
        sablon={{ id: sablon.id, kod: sablon.kod, ad: sablon.ad, aciklama: sablon.aciklama ?? '', durum: sablon.durum, surum: sablon.surum, veriSetiId: sablon.veriSetiId, veriSetiAd: sablon.veriSeti.ad, izinAnahtari: sablon.izinAnahtari ?? '' }}
        icerik={sablon.icerik}
        alanlar={alanlar}
        tasarlayabilir={tasarlayabilir}
      />
    )
  }

  const icerik = sablon.icerik as unknown as SablonIcerik
  return (
    <RaporCalistirClient
      sablon={{ id: sablon.id, kod: sablon.kod, ad: sablon.ad, aciklama: sablon.aciklama, durum: sablon.durum }}
      parametreler={icerik.parametreler ?? []}
      tasarlayabilir={tasarlayabilir}
    />
  )
}

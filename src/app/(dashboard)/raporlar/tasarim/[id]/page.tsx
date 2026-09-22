import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { PERMISSION_KEYS } from '@/lib/auth/permissions'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { etkilesimliMi, type SablonIcerik } from '@/lib/rapor/tipler'
import SablonTasarimClient from './_components/sablon-tasarim-client'
import YeniSablonSecim from './_components/yeni-sablon-secim'

export const dynamic = 'force-dynamic'

// Şablon tasarımı (rapor.tasarla). id='yeni' → boş şablon.
export default async function SablonTasarimPage({ params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser()
  if (error) redirect('/login')
  if (!(await hasPermission(PERMISSION_KEYS.RAPOR_TASARLA))) return <YetkisizErisim permission={PERMISSION_KEYS.RAPOR_TASARLA} />

  const veriSetleri = await prisma.raporVeriSeti.findMany({ where: { aktif: true }, select: { id: true, ad: true }, orderBy: { ad: 'asc' } })
  // Kategori önerileri: mevcut şablonların icerik.kategori değerleri (migration yok, JSON'dan).
  const tumIcerikler = await prisma.raporSablon.findMany({ select: { icerik: true } })
  const kategoriler = [...new Set(tumIcerikler.map((x) => ((x.icerik as { kategori?: string } | null)?.kategori ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr-TR'))
  const { id } = await params
  if (id === 'yeni') return <YeniSablonSecim veriSetleri={veriSetleri} kategoriler={kategoriler} belgeTasarim={<SablonTasarimClient veriSetleri={veriSetleri} kategoriler={kategoriler} />} />

  const s = await prisma.raporSablon.findUnique({ where: { id }, select: { id: true, kod: true, ad: true, aciklama: true, veriSetiId: true, durum: true, surum: true, izinAnahtari: true, icerik: true } })
  if (!s) notFound()
  if (etkilesimliMi(s.icerik)) redirect(`/raporlar/${s.id}`) // etkileşimli şablon ekranda kurgulanır
  return (
    <SablonTasarimClient
      veriSetleri={veriSetleri}
      kategoriler={kategoriler}
      mevcut={{ id: s.id, kod: s.kod, ad: s.ad, aciklama: s.aciklama ?? '', veriSetiId: s.veriSetiId, durum: s.durum, surum: s.surum, izinAnahtari: s.izinAnahtari ?? '', icerik: s.icerik as unknown as SablonIcerik }}
    />
  )
}

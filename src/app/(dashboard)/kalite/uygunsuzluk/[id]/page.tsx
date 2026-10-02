import { redirect, notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { canManageUygunsuzluk } from '@/lib/quality/uygunsuzluk-access'
import { prisma } from '@/lib/prisma'
import {
  UygunsuzlukFormClient,
  type UygunsuzlukDetay,
} from '@/components/quality/uygunsuzluk/UygunsuzlukFormClient'

export const dynamic = 'force-dynamic'

/**
 * Uygunsuzluk detay/düzenleme. Okuma: oturum. Yazma: canManageUygunsuzluk
 * (form salt-okunur açılır, kaydet butonu görünmez).
 */
export default async function UygunsuzlukDetayPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { session, error } = await requireUser()
  if (error) redirect('/login')
  const { id } = await params

  const kayit = await prisma.kaliteUygunsuzluk.findUnique({
    where: { id },
    include: {
      sorumlu: { select: { adSoyad: true, sicilNo: true } },
      onaylayan: { select: { adSoyad: true, sicilNo: true } },
      kategori: { select: { id: true, ad: true } },
      katilimcilar: { include: { personnel: { select: { id: true, adSoyad: true, sicilNo: true } } } },
      satirlar: { orderBy: { siraNo: 'asc' } },
      tarihGecmisi: { orderBy: { degistirmeTarihi: 'desc' } },
      dosyalar: { orderBy: { yuklemeTarihi: 'desc' } },
    },
  })
  if (!kayit) notFound()

  // Tarih geçmişi audit alanı plain string (FK yok) — isim için ayrı tek sorgu.
  const degistirenIdler = [...new Set(kayit.tarihGecmisi.map((t) => t.degistirenId).filter((x): x is string => !!x))]
  const kullanicilar = degistirenIdler.length > 0
    ? await prisma.user.findMany({ where: { id: { in: degistirenIdler } }, select: { id: true, name: true } })
    : []
  const kullaniciAdMap = new Map(kullanicilar.map((u) => [u.id, u.name ?? u.id]))

  const initial: UygunsuzlukDetay = {
    id: kayit.id,
    no: kayit.no,
    tarih: kayit.tarih.toISOString(),
    mamulUrunKodu: kayit.mamulUrunKodu,
    altParcaKodu: kayit.altParcaKodu,
    musteriAdi: kayit.musteriAdi,
    isEmriNo: kayit.isEmriNo,
    isEmriAdeti: kayit.isEmriAdeti,
    kategoriId: kayit.kategoriId,
    kategori: kayit.kategori,
    tespitEdenBolumId: kayit.tespitEdenBolumId,
    kokNeden: kayit.kokNeden,
    kacisKokNedeni: kayit.kacisKokNedeni,
    duzelticiFaaliyet: kayit.duzelticiFaaliyet,
    geciciAksiyon: kayit.geciciAksiyon,
    sorumluId: kayit.sorumluId,
    sorumlu: kayit.sorumlu,
    onaylayanId: kayit.onaylayanId,
    onaylayan: kayit.onaylayan,
    katilimcilar: kayit.katilimcilar.map((k) => k.personnel),
    termin: kayit.termin ? kayit.termin.toISOString() : null,
    kapanisTarihi: kayit.kapanisTarihi ? kayit.kapanisTarihi.toISOString() : null,
    ogrenilmisDersler: kayit.ogrenilmisDersler,
    tarihGecmisi: kayit.tarihGecmisi.map((t) => ({
      alanAdi: t.alanAdi,
      eskiDeger: t.eskiDeger ? t.eskiDeger.toISOString() : null,
      yeniDeger: t.yeniDeger ? t.yeniDeger.toISOString() : null,
      degistirenAdi: t.degistirenId ? (kullaniciAdMap.get(t.degistirenId) ?? null) : null,
      degistirmeTarihi: t.degistirmeTarihi.toISOString(),
    })),
    dosyalar: kayit.dosyalar.map((d) => ({
      id: d.id,
      dosyaAdi: d.dosyaAdi,
      dosyaUrl: d.dosyaUrl,
      dosyaBoyutu: d.dosyaBoyutu,
      yuklemeTarihi: d.yuklemeTarihi.toISOString(),
    })),
    satirlar: kayit.satirlar.map((s) => ({
      siraNo: s.siraNo,
      yariMamulKodu: s.yariMamulKodu,
      malzemeAdi: s.malzemeAdi,
      redAdeti: s.redAdeti,
      reworkAdedi: s.reworkAdedi,
      hurdaAdedi: s.hurdaAdedi,
      olusanBolumId: s.olusanBolumId,
      hataKoduId: s.hataKoduId,
      hataDetayi: s.hataDetayi,
      karar: s.karar,
    })),
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      <UygunsuzlukFormClient initial={initial} canManage={canManageUygunsuzluk(session)} />
    </div>
  )
}

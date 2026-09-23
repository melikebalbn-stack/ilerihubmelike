'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { AlertTriangle, Ban, CheckCircle2, Loader2, FileSpreadsheet } from 'lucide-react'

// MASTER madde 43 — Veri Kalite Merkezi. SALT TESPİT yapar (madde 21):
// hiçbir kaydı düzeltme/silme/pasifleştirme butonu YOK, yalnız ilgili
// kaydın mevcut yönetim ekranına link verir.

type VeriKaliteKayit = Record<string, unknown>

type VeriKaliteSatiri = {
  kod: string
  baslik: string
  adet: number
  kayitlar: VeriKaliteKayit[]
  kirpildi: boolean
  hata?: string
  kapsamDisi?: boolean
  not?: string
}

function tarihStr(deger: unknown): string {
  if (typeof deger !== 'string' || !deger) return '-'
  const d = new Date(deger)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('tr-TR')
}

// Bulgu satırından ilgili kaydın MEVCUT yönetim ekranına link üretir. Bazı
// kayıt türlerinin (araç/durak/şoför) ayrı bir detay sayfası yok — bu
// ekranlar servis-yonetimi ana sayfasının sekmelerinde yönetiliyor, o
// yüzden en spesifik hedef bulunamayınca genel modül sayfasına gider.
function bulguLinki(kod: string, kayit: VeriKaliteKayit): string {
  switch (kod) {
    case 'aktif-personel-servis-yok':
    case 'pasif-personel-servis-aktif':
      return `/personnel/${kayit.id}`
    case 'mukerrer-aktif-servis':
    case 'cakisan-atamalar':
    case 'suresi-bitmis-gecici-atama':
      return `/personnel/${kayit.personnelId}`
    case 'servis-var-arac-yok':
    case 'servis-var-sofor-yok':
    case 'guzergah-sefer-dilimi-tanimsiz':
      return `/servis-yonetimi/guzergah/${kayit.guzergahId}`
    default:
      return '/servis-yonetimi'
  }
}

function kayitEtiketi(kod: string, kayit: VeriKaliteKayit): string {
  switch (kod) {
    case 'aktif-personel-servis-yok':
    case 'pasif-personel-servis-aktif':
      return `${kayit.adSoyad} (${kayit.sicilNo ?? '-'}) — ${kayit.bolum ?? '-'}`
    case 'mukerrer-aktif-servis':
      return `${kayit.adSoyad} (${kayit.sicilNo ?? '-'}) — ${kayit.aktifAtamaSayisi} aktif atama`
    case 'cakisan-atamalar':
      return `${kayit.adSoyad} (${kayit.sicilNo ?? '-'}) — ${kayit.cakisanCiftSayisi} çakışan çift`
    case 'suresi-bitmis-gecici-atama':
      return `${kayit.adSoyad} (${kayit.sicilNo ?? '-'}) — ${kayit.guzergahKod}, bitiş ${tarihStr(kayit.bitisTarihi)}`
    case 'servis-var-arac-yok':
    case 'servis-var-sofor-yok':
      return `${kayit.guzergahKod} — ${kayit.guzergahAd} / ${kayit.dilimKod} (${kayit.etkilenenPersonelSayisi} personel)`
    case 'guzergah-sefer-dilimi-tanimsiz':
      return `${kayit.guzergahKod} — ${kayit.guzergahAd}`
    case 'kapasitesi-eksik-arac':
      return `${kayit.plaka} — kapasite ${kayit.kapasite} (${kayit.firmaAd})`
    case 'koordinatsiz-durak':
      return `${kayit.kod} — ${kayit.ad}${kayit.aktifGuzergahaBagli ? ' (aktif güzergaha bağlı)' : ''}`
    case 'tarih-cakismasi-arac-sofor': {
      const etiket = kayit.tur === 'ARAC' ? kayit.aracPlaka : kayit.soforAdSoyad
      const a1 = kayit.atama1 as { guzergahKod?: string } | undefined
      const a2 = kayit.atama2 as { guzergahKod?: string } | undefined
      return `${etiket} — ${a1?.guzergahKod ?? '-'} / ${a2?.guzergahKod ?? '-'} çakışması (${kayit.dilimKod})`
    }
    case 'aktif-arac-pasif-firma':
      return `${kayit.plaka} — ${kayit.firmaAd} (pasif firma)`
    case 'dis-firma-soforu-firmasiz':
      return `${kayit.adSoyad}${kayit.disFirmaSoforKodu ? ` (${kayit.disFirmaSoforKodu})` : ''}`
    default:
      return String(kayit.id ?? '')
  }
}

function VeriKaliteKart({ satir }: { satir: VeriKaliteSatiri }) {
  if (satir.hata) {
    return (
      <Card className="border-red-300 bg-red-50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-red-700">
            <AlertTriangle className="h-4 w-4" />
            {satir.baslik}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-700">Bu kontrol çalıştırılamadı: {satir.hata}</p>
        </CardContent>
      </Card>
    )
  }

  if (satir.kapsamDisi) {
    return (
      <Card className="bg-muted/40 opacity-70">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Ban className="h-4 w-4" />
            {satir.baslik}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{satir.not}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <span>{satir.baslik}</span>
          <Badge variant={satir.adet > 0 ? 'destructive' : 'secondary'}>{satir.adet}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {satir.adet === 0 ? (
          <p className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" /> Sorun bulunmadı.
          </p>
        ) : (
          <>
            {satir.kirpildi && (
              <p className="text-xs text-amber-600">
                İlk {satir.kayitlar.length} kayıt gösteriliyor, toplam {satir.adet}.
              </p>
            )}
            <ul className="divide-y text-sm">
              {satir.kayitlar.map((kayit, i) => (
                <li key={i} className="py-1.5">
                  <Link href={bulguLinki(satir.kod, kayit)} className="text-blue-700 hover:underline">
                    {kayitEtiketi(satir.kod, kayit)}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function VeriKaliteMerkeziPage() {
  const { data: session } = useSession()
  const permissions = session?.user?.permissions || []
  const canView = permissions.includes('servis.view')
  // Dışa aktarım AYRI eksen: sayfayı görebilen herkes dosyayı indirememeli.
  // Uç de aynı ikiliyi AND ile istiyor (requireAllPermissions).
  const canExport = permissions.includes('servis.export')

  const [satirlar, setSatirlar] = useState<VeriKaliteSatiri[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [genelHata, setGenelHata] = useState<string | null>(null)

  useEffect(() => {
    if (!canView) return
    let iptal = false
    ;(async () => {
      try {
        const res = await fetch('/api/servis-yonetimi/veri-kalite')
        const json = await res.json()
        if (!res.ok || !json.ok) {
          if (!iptal) setGenelHata(json.message || 'Veri kalite raporu alınamadı.')
          return
        }
        if (!iptal) setSatirlar(json.data)
      } catch {
        if (!iptal) setGenelHata('Veri kalite raporu alınırken beklenmeyen bir hata oluştu.')
      } finally {
        if (!iptal) setYukleniyor(false)
      }
    })()
    return () => {
      iptal = true
    }
  }, [canView])

  if (!canView) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Bu sayfayı görüntüleme yetkiniz yok.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Veri Kalite Merkezi</h1>
          <p className="text-sm text-muted-foreground">
            Servis yönetimi verilerinde tutarsızlık taraması — salt tespit, hiçbir kayıt otomatik düzeltilmez.
          </p>
        </div>
        {/* Düz <a> + buttonVariants — <Button asChild> KULLANILMIYOR: button.tsx'te
            asChild yalnız tip olarak tanımlı, gövdede okunmuyor, bu yüzden
            <button><a></a></button> (geçersiz HTML) üretiyor. Görsel sonuç aynı. */}
        {canExport && (
          <a
            href="/api/servis-yonetimi/veri-kalite/export"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Excel indir
          </a>
        )}
      </div>
      {yukleniyor ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : genelHata ? (
        <p className="text-sm text-red-600">{genelHata}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {satirlar.map(satir => (
            <VeriKaliteKart key={satir.kod} satir={satir} />
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { Clock3, History, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// 13 modelin (15 hedefTipi değeri) ortak "İşlem Geçmişi" gösterimi — tek bir
// paylaşılan Dialog + tek bir GET /api/servis-yonetimi/islem-gecmisi uç
// noktası (bkz. plan onayı, madde 5). Her modelin tablo satırında bir
// <GecmisButonu> + bu Dialog kullanılır.
export type ServisIslemHedefTipi =
  | 'FIRMA' | 'YERLESKE' | 'SEFER_DILIMI' | 'GUZERGAH' | 'DURAK'
  | 'GUZERGAH_DURAK' | 'GUZERGAH_DURAK_SAAT' | 'ARAC' | 'SOFOR'
  | 'GUZERGAH_ARAC_VARSAYILAN' | 'GUZERGAH_SOFOR_VARSAYILAN'
  | 'PERSONEL_ATAMA' | 'PERSONEL_ATAMA_DILIM' | 'SORUMLUSU' | 'PERSONEL_DURUM'

type IslemTuru = 'OLUSTURMA' | 'GUNCELLEME' | 'PASIFLESTIRME' | 'AKTIFLESTIRME'

type GecmisKaydi = {
  id: string
  islem: IslemTuru
  oncekiDeger: Record<string, unknown> | null
  yeniDeger: Record<string, unknown> | null
  aciklama: string | null
  tarih: string
  user: { name: string | null } | null
}

const ISLEM_ETIKET: Record<IslemTuru, string> = {
  OLUSTURMA: 'Oluşturuldu',
  GUNCELLEME: 'Güncellendi',
  PASIFLESTIRME: 'Pasifleştirildi',
  AKTIFLESTIRME: 'Geri Alındı',
}

// Serbest JSON dump YOK — yalnız bilinen alanlar için Türkçe etiket ve
// okunabilir değer üretilir. KVKK/madde 23: yazma tarafında olduğu gibi
// (kaydetIslemGecmisi) burada da yalnız satırın kendi skaler/FK alanları
// bekleniyor; bu bileşen JOIN'lenmiş insan-adı gösterecek şekilde
// TASARLANMADI — hedefId üzerinden ilgili kaydın kendi detay ekranına
// zaten erişimi olan kullanıcı, gerekirse oradan personelin kim olduğunu
// görür.
const ALAN_ETIKET: Record<string, string> = {
  ad: 'Ad', yetkiliAdi: 'Yetkili', telefon: 'Telefon', eposta: 'E-posta', adres: 'Adres',
  aktif: 'Durum', personnelId: 'Personel ID', guzergahId: 'Güzergâh ID', durakId: 'Durak ID',
  baslangicTarihi: 'Başlangıç', bitisTarihi: 'Bitiş', atamaKaynagi: 'Atama Kaynağı',
  dilimIdleri: 'Sefer Dilimleri',
}

function alanDegeriGoster(alan: string, deger: unknown): string {
  if (deger === null || deger === undefined) return '-'
  if (alan === 'aktif') return deger ? 'Aktif' : 'Pasif'
  if (alan === 'dilimIdleri' && Array.isArray(deger)) return `${deger.length} dilim seçildi`
  if ((alan === 'baslangicTarihi' || alan === 'bitisTarihi') && typeof deger === 'string') return deger.slice(0, 10)
  return String(deger)
}

function DegerSatirlari({ oncekiDeger, yeniDeger }: { oncekiDeger: Record<string, unknown> | null; yeniDeger: Record<string, unknown> | null }) {
  const alanlar = [...new Set([...Object.keys(oncekiDeger || {}), ...Object.keys(yeniDeger || {})])]
  if (alanlar.length === 0) return null
  return (
    <div className="mt-1 space-y-0.5">
      {alanlar.map((alan) => (
        <p key={alan} className="text-xs text-muted-foreground">
          {ALAN_ETIKET[alan] || alan}:{' '}
          {oncekiDeger && alan in oncekiDeger && (
            <>
              <span className="line-through">{alanDegeriGoster(alan, oncekiDeger[alan])}</span>
              {' → '}
            </>
          )}
          <span className="font-medium text-foreground">{alanDegeriGoster(alan, yeniDeger?.[alan])}</span>
        </p>
      ))}
    </div>
  )
}

export function ServisGecmisDialog({
  hedefTipi,
  hedefId,
  baslik,
  open,
  onOpenChange,
}: {
  // Bir kaydın alt kayıtları farklı bir hedefTipi altında loglanabiliyor
  // (örn. Personel Atama'nın dilim seçimi PERSONEL_ATAMA_DILIM) — bu yüzden
  // dizi de kabul edilir, hepsi aynı zaman çizelgesinde birleştirilir.
  hedefTipi: ServisIslemHedefTipi | ServisIslemHedefTipi[]
  hedefId: string
  baslik: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [kayitlar, setKayitlar] = useState<GecmisKaydi[]>([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    setHata(null)
    try {
      const tipiParam = Array.isArray(hedefTipi) ? hedefTipi.join(',') : hedefTipi
      const res = await fetch(`/api/servis-yonetimi/islem-gecmisi?hedefTipi=${tipiParam}&hedefId=${encodeURIComponent(hedefId)}`)
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setHata(json.message || 'İşlem geçmişi alınamadı.')
        return
      }
      setKayitlar(json.data)
    } catch {
      setHata('İşlem geçmişi alınırken beklenmeyen bir hata oluştu.')
    } finally {
      setYukleniyor(false)
    }
  }, [hedefTipi, hedefId])

  useEffect(() => {
    if (open) void yukle()
  }, [open, yukle])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{baslik} — İşlem Geçmişi</DialogTitle></DialogHeader>
        {yukleniyor && <Loader2 className="h-5 w-5 animate-spin" />}
        {!yukleniyor && hata && <p className="text-sm text-red-600">{hata}</p>}
        {!yukleniyor && !hata && kayitlar.length === 0 && (
          <p className="text-sm text-muted-foreground">İşlem geçmişi bulunmuyor.</p>
        )}
        {!yukleniyor && kayitlar.length > 0 && (
          <div className="space-y-0">
            {kayitlar.map((k) => (
              <div key={k.id} className="relative border-l-2 border-muted pb-4 pl-5 last:pb-0">
                <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-background bg-[#1B4F72]" />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{ISLEM_ETIKET[k.islem]}</p>
                  <time className="flex items-center text-xs text-muted-foreground">
                    <Clock3 className="mr-1 h-3 w-3" />
                    {new Date(k.tarih).toLocaleString('tr-TR')}
                  </time>
                </div>
                <p className="text-xs text-muted-foreground">{k.user?.name || 'Sistem'}</p>
                <DegerSatirlari oncekiDeger={k.oncekiDeger} yeniDeger={k.yeniDeger} />
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function GecmisButonu({ onClick }: { onClick: () => void }) {
  return (
    <Button size="sm" variant="ghost" onClick={onClick} title="İşlem Geçmişi">
      <History className="h-4 w-4" />
    </Button>
  )
}

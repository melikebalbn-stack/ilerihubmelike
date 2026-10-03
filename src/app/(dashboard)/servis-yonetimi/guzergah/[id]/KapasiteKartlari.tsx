'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ServisKapasiteToplu } from '@/lib/servis-yonetimi/kapasite'
import { bosKoltukMetni, dolulukMetni, durumEtiketi, koltukMetni } from '../../_lib/kapasite-gosterim'
import { servisIstek } from '../../_lib/servis-istek'

// Güzergâh detayı üst kartları (B2): Koltuk / Personel / Boş koltuk / Doluluk.
// Sayılar Servis Paneli ile AYNI kaynaktan (kapasite motoru, kapasite-toplu ucu) gelir —
// güzergâhın en dolu sefer dilimi. Hesap yok, yalnız biçimlendirme.
export function KapasiteKartlari({ guzergahId }: { guzergahId: string }) {
  const [ozet, setOzet] = useState<ServisKapasiteToplu['guzergahlar'][number] | null>(null)

  useEffect(() => {
    let iptal = false
    void servisIstek(
      `/api/servis-yonetimi/kapasite-toplu?guzergahId=${encodeURIComponent(guzergahId)}`,
      undefined,
      'Kapasite özeti alınamadı.',
    ).then((sonuc) => {
      if (iptal || !sonuc.ok) return
      const veri = (sonuc.json as { data?: ServisKapasiteToplu } | null)?.data
      setOzet(veri?.guzergahlar?.[0] ?? null)
    })
    return () => {
      iptal = true
    }
  }, [guzergahId])

  // Pasif güzergâh ya da henüz yükleniyor/hata: kart gösterilmez (sayfa bunsuz da tam çalışır).
  if (!ozet) return null
  const o = ozet.ozet
  const asim = o.durum === 'ASIM'
  const kartlar = [
    { ad: 'Koltuk', deger: koltukMetni(o) },
    { ad: 'Personel', deger: String(o.atananPersonelSayisi) },
    { ad: 'Boş koltuk', deger: bosKoltukMetni(o), kirmizi: asim },
    { ad: 'Doluluk', deger: dolulukMetni(o.dolulukOrani), kirmizi: asim },
  ]
  return (
    <section aria-label="Kapasite özeti" className="space-y-1">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kartlar.map((k) => (
          <Card key={k.ad} className={k.kirmizi ? 'border-red-300 bg-red-50 dark:bg-red-950/20' : undefined}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">{k.ad}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-semibold tabular-nums ${k.kirmizi ? 'text-red-600' : ''}`} data-testid={`guzergah-kart-${k.ad}`}>
                {k.deger}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Bugün · {durumEtiketi(o)}
        {ozet.dilimSayisi > 1 && ozet.dilimKod ? ` · en dolu dilim: ${ozet.dilimKod}` : ''}
      </p>
    </section>
  )
}

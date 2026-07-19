/**
 * IPRO tanım formlarındaki bayrak etiketleri.
 *
 * KAYNAK: MAS Excel kolon başlıkları — scripts/ipro/import-hurda.ts ve
 * import-durus.ts bu başlıkları birebir okuyor. Etiketler uydurulmadı,
 * MAS'ın kendi metni kullanıldı.
 *
 * `uygulanmiyor: true` → alan MAS'tan geliyor ve saklanıyor ama IPRO akışında
 * (kiosk/üretim kaydı) HENÜZ bir davranışa bağlı değil. Dev DB'de üçünün de
 * true kaydı yok (0/115) — yani MAS'ta da kullanılmamışlar.
 */

export type BayrakTanim = {
  alan: string
  etiket: string
  ipucu?: string
  uygulanmiyor?: boolean
}

export const HURDA_BAYRAKLARI: BayrakTanim[] = [
  { alan: 'hurda', etiket: 'Hurda' },
  { alan: 'rework', etiket: 'Rework' },
  { alan: 'uretimHurdaRework', etiket: 'Üretim Hurda/Rework' },
  { alan: 'bilesenHurdaRework', etiket: 'Bileşen Hurda/Rework' },
  { alan: 'oeeEtkiler', etiket: "OEE'yi Etkiler", ipucu: 'İşaretliyse bu sebep OEE hesabına dahil edilir.' },
  { alan: 'yorumZorunlu', etiket: 'Yorum Zorunlu', ipucu: 'Operatör bu sebebi seçtiğinde açıklama girmek zorunda.' },
  {
    alan: 'sinyalsizGiris',
    etiket: 'Sinyalsiz Hurda Girişi',
    ipucu: 'PLC sinyali olmayan tezgahta bu sebep elle girilebilir.',
  },
]

export const DURUS_BAYRAKLARI: BayrakTanim[] = [
  { alan: 'planli', etiket: 'Planlı', ipucu: 'Çay/yemek molası, planlı bakım gibi önceden bilinen duruşlar.' },
  { alan: 'uretimDisi', etiket: 'Üretim Dışı', ipucu: 'İş emri yok / planda üretim yok gibi üretim dışı zaman.' },
  { alan: 'setupDurusu', etiket: 'Setup Duruşu', ipucu: 'Kalıp bağlama, ürün değişimi gibi hazırlık duruşları.' },
  { alan: 'makineKaynakli', etiket: 'Makine Kaynaklı' },
  { alan: 'operatorKaynakli', etiket: 'Operatör Kaynaklı' },
  { alan: 'plcKilitle', etiket: 'PLC Kilitle' },
  { alan: 'uretimdeGosterilsin', etiket: 'Üretimde de gösterilsin mi?' },
  {
    alan: 'askiyaAl',
    etiket: 'Askıya Al',
    uygulanmiyor: true,
    ipucu: 'MAS özelliği, IPRO’da henüz uygulanmıyor.',
  },
  {
    alan: 'yetkiliOnayGerekli',
    etiket: 'Yetkili Sicili Onayı Gerekli',
    uygulanmiyor: true,
    ipucu: 'MAS özelliği, IPRO’da henüz uygulanmıyor.',
  },
  {
    alan: 'durusAktifkenIsBitirilemez',
    etiket: 'Duruş Aktifken İş Bitirilemez',
    uygulanmiyor: true,
    ipucu: 'MAS özelliği, IPRO’da henüz uygulanmıyor.',
  },
]

/** MAS "Bitiş Tipi" kolonunun dev DB'deki mevcut değerleri (Both 92, Manual 23). */
export const BITIS_TIPI_SECENEKLERI = ['Both', 'Manual'] as const

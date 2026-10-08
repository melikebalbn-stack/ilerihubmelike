import 'server-only'
import { prisma } from '@/lib/prisma'

/**
 * PDKS yönetilebilir ayarları (SystemSetting pdks_*). İV/yönetici ekrandan düzenler —
 * daha önce yalnız elle SQL ile değişiyordu. Sistem tarafından yazılan anahtarlar
 * (pdks_mutabakat_son) ve ileri JSON ayarları (pdks_olay_esleme, pdks_bosluk_uyarilari,
 * pdks_kart_no_bicimi) BİLİNÇLİ olarak bu ekranın dışında — onlar ayrı yönetilir.
 */
export type AyarTip = 'bool' | 'saat' | 'tamsayi' | 'metin'

export interface AyarTanim {
  key: string
  grup: 'Puantaj' | 'Bildirim' | 'Anomali'
  etiket: string
  tip: AyarTip
  varsayilan: string
  aciklama?: string
}

export const PDKS_AYARLAR: AyarTanim[] = [
  // --- Puantaj ---
  { key: 'pdks_gecis_sensoru_zorunlu', grup: 'Puantaj', etiket: 'Geçiş yönü zorunlu', tip: 'bool', varsayilan: 'false', aciklama: 'Giriş/çıkış yönü olmayan okutmalar puantaja girmesin.' },
  { key: 'pdks_yarim_gun_bitis', grup: 'Puantaj', etiket: 'Yarım gün bitiş saati', tip: 'saat', varsayilan: '13:00' },
  { key: 'pdks_ceyrek_yuvarlama', grup: 'Puantaj', etiket: 'Erken çıkış çeyrek yuvarlama', tip: 'bool', varsayilan: 'true', aciklama: 'Çıkış dakikası ≤15 → :00, >15 → :30.' },
  { key: 'pdks_cuma_muaf_bas', grup: 'Puantaj', etiket: 'Cuma muafiyet başlangıcı', tip: 'saat', varsayilan: '13:00', aciklama: "Cuma namazı penceresi. Kapatmak için '-' yaz." },
  { key: 'pdks_cuma_muaf_bit', grup: 'Puantaj', etiket: 'Cuma muafiyet bitişi', tip: 'saat', varsayilan: '14:00' },
  { key: 'pdks_aylik_gec_esigi', grup: 'Puantaj', etiket: 'Aylık tolerans-içi geç eşiği', tip: 'tamsayi', varsayilan: '3', aciklama: 'Ay içinde bu sayı aşılınca İV uyarısı.' },
  // --- Bildirim ---
  { key: 'pdks_devamsizlik_bildirim_acik', grup: 'Bildirim', etiket: 'Sabah devamsızlık bildirimi', tip: 'bool', varsayilan: 'false' },
  { key: 'pdks_bildirim_saati', grup: 'Bildirim', etiket: 'Bildirim saati', tip: 'saat', varsayilan: '09:00' },
  { key: 'pdks_devamsizlik_iv_mailler', grup: 'Bildirim', etiket: 'İV mail listesi', tip: 'metin', varsayilan: '', aciklama: 'Virgülle ayrılmış e-posta adresleri.' },
  // --- Anomali ---
  { key: 'pdks_anomali_hiz_esik_sn', grup: 'Anomali', etiket: 'Kart paylaşımı hız eşiği (sn)', tip: 'tamsayi', varsayilan: '60', aciklama: 'Bu süreden kısa sürede farklı kapı → şüphe.' },
]

const SAAT = /^([01]\d|2[0-3]):[0-5]\d$/

/** Değeri tipine göre doğrular; hata varsa mesaj döndürür (yoksa null). */
export function ayarDogrula(t: AyarTanim, deger: string): string | null {
  const v = deger.trim()
  switch (t.tip) {
    case 'bool':
      return v === 'true' || v === 'false' ? null : `${t.etiket}: true/false olmalı`
    case 'saat':
      // Cuma muafiyeti '-' ile kapatılabilir
      if (t.key === 'pdks_cuma_muaf_bas' && v === '-') return null
      return SAAT.test(v) ? null : `${t.etiket}: SS:DD formatında olmalı`
    case 'tamsayi':
      return /^\d+$/.test(v) ? null : `${t.etiket}: pozitif tam sayı olmalı`
    case 'metin':
      return null
  }
}

/** Tüm PDKS ayarlarını {key: value} olarak döndürür (eksikler varsayılanla doldurulur). */
export async function pdksAyarlariOku(): Promise<Record<string, string>> {
  const keys = PDKS_AYARLAR.map((a) => a.key)
  const rows = await prisma.systemSetting.findMany({ where: { key: { in: keys } }, select: { key: true, value: true } })
  const mevcut = new Map(rows.map((r) => [r.key, r.value]))
  const sonuc: Record<string, string> = {}
  for (const a of PDKS_AYARLAR) sonuc[a.key] = mevcut.get(a.key) ?? a.varsayilan
  return sonuc
}

/** Gelen {key: value} değerlerini doğrular ve upsert eder. Tanımsız anahtar reddedilir. */
export async function pdksAyarlariYaz(girdi: Record<string, string>): Promise<{ yazilan: number }> {
  const tanimlar = new Map(PDKS_AYARLAR.map((a) => [a.key, a]))
  const yazilacak: { key: string; value: string }[] = []
  for (const [key, rawDeger] of Object.entries(girdi)) {
    const t = tanimlar.get(key)
    if (!t) throw new Error(`Tanımsız ayar: ${key}`)
    const deger = String(rawDeger ?? '').trim()
    const hata = ayarDogrula(t, deger)
    if (hata) throw new Error(hata)
    yazilacak.push({ key, value: deger })
  }
  await prisma.$transaction(
    yazilacak.map((x) =>
      prisma.systemSetting.upsert({
        where: { key: x.key },
        update: { value: x.value },
        create: { key: x.key, value: x.value, category: 'pdks' },
      }),
    ),
  )
  return { yazilan: yazilacak.length }
}

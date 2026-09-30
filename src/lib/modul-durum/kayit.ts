/**
 * Modül yayın durumu — KAYIT (client-safe, DB'ye dokunmaz).
 *
 * Amaç: yeni bir modül canlıya çıkabilsin ama kullanıcılara görünmesin.
 * Melih test edip açana kadar GİZLİ kalır. Mevcut modüller etkilenmez:
 * SystemSetting'de kaydı OLMAYAN her modül ACIK sayılır (VARSAYILAN_DURUM).
 *
 * Durumlar:
 *   GIZLI — yalnız SUPER_ADMIN. Menüde yok, rota 404, cron/bildirim susar.
 *   PILOT — SUPER_ADMIN + pilotBolumler'deki aktif kişiler. Cron/bildirim susar.
 *   ACIK  — herkes (kişinin kendi izinleri neyse). Cron/bildirim çalışır.
 *
 * Durum SystemSetting'de tutulur (yeni tablo YOK):
 *   modul_durum_<anahtar>  = GIZLI | PILOT | ACIK
 *   modul_pilot_<anahtar>  = virgülle ayrılmış bölüm adları (yalnız PILOT'ta anlamlı)
 *
 * Bu dosya client'tan da import edilir (Sidebar, ayar ekranı) — 'server-only' YOK,
 * prisma import YOK. DB'ye bakan her şey sunucu.ts'te.
 */

export type ModulDurum = 'GIZLI' | 'PILOT' | 'ACIK'

export const MODUL_DURUMLARI = ['GIZLI', 'PILOT', 'ACIK'] as const satisfies readonly ModulDurum[]

/** Kaydı olmayan modül ACIK sayılır — mevcut 47 modülün davranışı DEĞİŞMEZ. */
export const VARSAYILAN_DURUM: ModulDurum = 'ACIK'

export const DURUM_ETIKETLERI: Record<ModulDurum, string> = {
  GIZLI: 'Gizli',
  PILOT: 'Pilot',
  ACIK: 'Açık',
}

export const DURUM_ACIKLAMALARI: Record<ModulDurum, string> = {
  GIZLI: 'Yalnız SUPER_ADMIN görür ve girebilir. Cron/bildirim susar.',
  PILOT: 'SUPER_ADMIN + seçilen bölümler görür. Cron/bildirim susar.',
  ACIK: 'Herkes kendi izinleri kadar görür. Cron/bildirim çalışır.',
}

export interface ModulKaydi {
  /** SystemSetting anahtarının son parçası. Kısa, tireli, değişmez. */
  anahtar: string
  /** Ayar ekranında görünen ad. */
  etiket: string
  /** Rota öneki — layout guard'ının koruduğu yol (bilgi amaçlı, tek kaynak). */
  rota: string
}

/**
 * Yayın kapısı OLAN modüller. Buraya eklenmeyen modül her zaman açıktır.
 * Yeni modül devreye alınırken buraya bir satır eklenir ve modülün
 * layout.tsx'inde modulGuard(anahtar) çağrılır.
 */
export const MODUL_KAYDI: readonly ModulKaydi[] = [
  { anahtar: 'proje-takip', etiket: 'Proje Takip', rota: '/proje-takip' },
  { anahtar: 'servis-yonetimi', etiket: 'Servis ve Güzergâh', rota: '/servis-yonetimi' },
  { anahtar: 'izin', etiket: 'İzin', rota: '/izin' },
  { anahtar: 'faturalar', etiket: 'Fatura Takip', rota: '/sistem-gelistirme/faturalar' },
] as const

export const durumAnahtari = (anahtar: string) => `modul_durum_${anahtar}`
export const pilotAnahtari = (anahtar: string) => `modul_pilot_${anahtar}`

/** SystemSetting kategorisi — /api/system/settings?category=modul ile okunur. */
export const MODUL_KATEGORI = 'modul'

export function modulBul(anahtar: string): ModulKaydi | undefined {
  return MODUL_KAYDI.find((m) => m.anahtar === anahtar)
}

/** Ham SystemSetting değerini durum'a çevirir; tanınmayan/boş değer VARSAYILAN_DURUM. */
export function durumCoz(ham: string | null | undefined): ModulDurum {
  const d = ham?.trim().toUpperCase()
  return (MODUL_DURUMLARI as readonly string[]).includes(d ?? '') ? (d as ModulDurum) : VARSAYILAN_DURUM
}

/** "İnsan Varlıkları, Kalite" → ['İnsan Varlıkları', 'Kalite'] (boşlar atılır). */
export function pilotBolumleriCoz(ham: string | null | undefined): string[] {
  return (ham ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export const pilotBolumleriYaz = (bolumler: string[]): string =>
  bolumler.map((s) => s.trim()).filter(Boolean).join(', ')

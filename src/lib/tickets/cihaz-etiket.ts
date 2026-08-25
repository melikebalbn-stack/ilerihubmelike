/**
 * Ticket ↔ zimmet (cihaz) bağı için etiket üretimi.
 *
 * İki ayrı biçim var, bilinçli olarak:
 *   - cihazAnlikGoruntu → Ticket.assetInfo'ya SUNUCUDA yazılan anlık görüntü.
 *     Cihaz sonradan pasifleşse/silinse bile talep geçmişi okunabilir kalsın diye
 *     metin olarak dondurulur. Ayraç " — ".
 *   - cihazSecimEtiketi → formdaki açılır listede gösterilen satır. Ayraç " · ".
 *
 * TUR_LABELS zimmet modülündeki haritanın aynısı. Kasıtlı kopya: zimmet
 * modülünün dosyalarına dokunmamak için (her tüketicinin kendi haritasını
 * taşıması bu repoda yerleşik desen — 6 ayrı yerde aynı harita var).
 */

export const ZIMMET_TUR_LABELS: Record<string, string> = {
  NOTEBOOK_BILGISAYAR: 'Notebook Bilgisayar',
  DESKTOP_BILGISAYAR: 'Desktop Bilgisayar',
  CEP_TELEFONU: 'Cep Telefonu',
  EL_TERMINALI: 'El Terminali',
  OFFICE_365: 'Office 365',
  YAZICI: 'Yazıcı',
  MONITOR: 'Monitör',
  MIKROFON: 'Mikrofon',
  DIGER: 'Diğer',
}

export interface CihazEtiketGirdi {
  tur: string
  turDiger?: string | null
  marka?: string | null
  model?: string | null
  seriNumarasi?: string | null
  pcAdi?: string | null
}

function turAdi(c: CihazEtiketGirdi): string {
  const ozel = c.turDiger?.trim()
  if (ozel) return ozel
  return ZIMMET_TUR_LABELS[c.tur] ?? c.tur
}

/** Boş/whitespace parçaları eler, ayracın tekrarlamasını önler. */
function birlestir(parcalar: (string | null | undefined)[], ayrac: string): string {
  return parcalar
    .map(p => p?.trim())
    .filter((p): p is string => !!p)
    .join(ayrac)
}

/**
 * Ticket.assetInfo'ya yazılan anlık görüntü.
 * Örn: "Notebook Bilgisayar — Dell Latitude 5540 — SN:ABC123"
 * Marka/model/seri boşsa o parça hiç yazılmaz, " — " tekrarlamaz.
 */
export function cihazAnlikGoruntu(c: CihazEtiketGirdi): string {
  const markaModel = birlestir([c.marka, c.model], ' ')
  const seri = c.seriNumarasi?.trim() ? `SN:${c.seriNumarasi.trim()}` : null
  return birlestir([turAdi(c), markaModel, seri], ' — ')
}

/**
 * Açılır liste satırı.
 * Örn: "Notebook Bilgisayar · Dell Latitude 5540 · SN:ABC123"
 * Seri yoksa pcAdi, o da yoksa yalnız tür.
 */
export function cihazSecimEtiketi(c: CihazEtiketGirdi): string {
  const markaModel = birlestir([c.marka, c.model], ' ')
  const seri = c.seriNumarasi?.trim()
    ? `SN:${c.seriNumarasi.trim()}`
    : c.pcAdi?.trim() || null
  return birlestir([turAdi(c), markaModel, seri], ' · ')
}

/** Ticket.assetInfo serbest metin sınırı. Aşarsa 400. */
export const ASSET_INFO_MAX = 200

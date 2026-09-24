'use client'

/**
 * Rapor modülü istemci tarafı fetch yardımcısı.
 *
 * NEDEN: uçlardan biri eksik/yanlış metodla çağrıldığında Next boş gövdeli 405 (veya HTML hata
 * sayfası) döndürüyor; ekranlar da doğrudan `r.json()` çağırdığı için hata
 * "Failed to execute 'json' on 'Response'" diye görünüyordu — gerçek sebep kayboluyordu.
 * Burada yanıt önce METİN olarak okunur, JSON ayrıştırılamazsa ham metin gösterilir ve
 * duruma göre anlaşılır Türkçe mesaj üretilir.
 */

/** HTTP durumuna göre varsayılan Türkçe mesaj (uç `{error}` döndürdüyse o kullanılır). */
const DURUM_MESAJI: Record<number, string> = {
  400: 'İstek geçersiz',
  401: 'Oturum doğrulanamadı — sayfayı yenileyip tekrar giriş yapın',
  403: 'Bu işlem için yetkiniz yok',
  404: 'Kayıt bulunamadı',
  405: 'Bu işlem sunucuda tanımlı değil (uç eksik)',
  409: 'Çakışma: kayıt başkası tarafından kullanılıyor veya aynı ad zaten var',
  413: 'Gönderilen içerik çok büyük',
  415: 'Desteklenmeyen içerik türü',
  429: 'Çok fazla istek — biraz bekleyip tekrar deneyin',
  500: 'Sunucu hatası',
  502: 'Sunucuya ulaşılamadı',
  503: 'Servis şu an kullanılamıyor',
  504: 'Sunucu zaman aşımına uğradı',
}

export class ApiHatasi extends Error {
  constructor(public durum: number, mesaj: string, public hatalar: string[] = []) {
    super(mesaj)
    this.name = 'ApiHatasi'
  }
}

/** Hata gövdesi HTML/boş olabilir → okunur bir özet çıkar. */
function hamOzet(metin: string): string {
  const duz = metin.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return duz ? duz.slice(0, 200) : ''
}

function mesajUret(durum: number, govde: unknown, ham: string): { mesaj: string; hatalar: string[] } {
  const d = (typeof govde === 'object' && govde !== null ? govde : {}) as { error?: unknown; hatalar?: unknown; message?: unknown }
  const hatalar = Array.isArray(d.hatalar) ? d.hatalar.map(String) : []
  const ucMesaji = typeof d.error === 'string' ? d.error : typeof d.message === 'string' ? d.message : ''
  if (ucMesaji) return { mesaj: ucMesaji, hatalar }
  const varsayilan = DURUM_MESAJI[durum] ?? `Beklenmeyen yanıt (HTTP ${durum})`
  const ozet = hamOzet(ham)
  // Gövde JSON değilse (HTML hata sayfası / boş 405) ham metni de göster.
  return { mesaj: ozet ? `${varsayilan} (HTTP ${durum}) — ${ozet}` : `${varsayilan} (HTTP ${durum})`, hatalar }
}

/**
 * JSON yanıt bekleyen çağrılar. Hata durumunda ApiHatasi fırlatır (durum + hatalar dizisiyle).
 * Ağ hatası da aynı tipe çevrilir (durum 0).
 */
export async function apiIstek<T>(url: string, init?: RequestInit): Promise<T> {
  let yanit: Response
  try {
    yanit = await fetch(url, init)
  } catch (e) {
    throw new ApiHatasi(0, `Sunucuya bağlanılamadı: ${e instanceof Error ? e.message : String(e)}`)
  }
  const ham = await yanit.text()
  let govde: unknown = null
  let ayristirilabildi = true
  if (ham.trim()) {
    try { govde = JSON.parse(ham) } catch { ayristirilabildi = false }
  } else {
    ayristirilabildi = false
  }
  if (!yanit.ok) {
    const { mesaj, hatalar } = mesajUret(yanit.status, govde, ayristirilabildi ? '' : ham)
    throw new ApiHatasi(yanit.status, mesaj, hatalar)
  }
  if (!ayristirilabildi) {
    throw new ApiHatasi(yanit.status, `Sunucu JSON yerine beklenmeyen yanıt döndürdü${hamOzet(ham) ? `: ${hamOzet(ham)}` : ' (boş gövde)'}`)
  }
  return govde as T
}

/** GET kısayolu. */
export const apiGet = <T,>(url: string) => apiIstek<T>(url)

/** JSON gövdeli POST/PUT/PATCH/DELETE kısayolu. */
export const apiGonder = <T,>(url: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', govde?: unknown) =>
  apiIstek<T>(url, {
    method,
    ...(govde === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde) }),
  })

/**
 * Gövdeyi okumayan sürüm — blob/dosya indiren uçlar için. Yanıt hatalıysa ApiHatasi fırlatır
 * (hata gövdesi metin olarak okunup mesaja katılır).
 */
export async function apiYanit(url: string, init?: RequestInit): Promise<Response> {
  let yanit: Response
  try {
    yanit = await fetch(url, init)
  } catch (e) {
    throw new ApiHatasi(0, `Sunucuya bağlanılamadı: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (yanit.ok) return yanit
  const ham = await yanit.text().catch(() => '')
  let govde: unknown = null
  try { govde = ham ? JSON.parse(ham) : null } catch { /* HTML/boş gövde */ }
  const { mesaj, hatalar } = mesajUret(yanit.status, govde, govde ? '' : ham)
  throw new ApiHatasi(yanit.status, mesaj, hatalar)
}

/** Yakalanan hatayı ekranda gösterilecek metne çevirir. */
export const hataMetni = (e: unknown) => (e instanceof Error ? e.message : String(e))
/** Uç `hatalar: []` döndürdüyse onları da döner (kaydetme ekranlarındaki liste için). */
export const hataListesi = (e: unknown) => (e instanceof ApiHatasi ? e.hatalar : [])

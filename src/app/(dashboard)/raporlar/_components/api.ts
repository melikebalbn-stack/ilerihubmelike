'use client'

import { durumCevir, hataCevir, type CevrilmisHata } from '@/lib/rapor/hata-cevir'

/**
 * Rapor modülü istemci tarafı fetch yardımcısı.
 *
 * NEDEN: uçlardan biri eksik/yanlış metodla çağrıldığında Next boş gövdeli 405 (veya HTML hata
 * sayfası) döndürüyor; ekranlar da doğrudan `r.json()` çağırdığı için hata
 * "Failed to execute 'json' on 'Response'" diye görünüyordu — gerçek sebep kayboluyordu.
 * Burada yanıt önce METİN olarak okunur, JSON ayrıştırılamazsa ham metin gösterilir ve
 * duruma göre anlaşılır Türkçe mesaj üretilir.
 */

// Durum kodu → Türkçe metin TEK YERDE: lib/rapor/hata-cevir.ts (sunucu yanıtları da oradan çevrilir).
const DURUM_MESAJI: Record<number, string> = { 400: 'İstek geçersiz', 415: 'Desteklenmeyen içerik türü' }

export class ApiHatasi extends Error {
  constructor(public durum: number, mesaj: string, public hatalar: string[] = [], public cevrilmis?: CevrilmisHata) {
    super(mesaj)
    this.name = 'ApiHatasi'
  }
}

/** Hata gövdesi HTML/boş olabilir → okunur bir özet çıkar. */
function hamOzet(metin: string): string {
  const duz = metin.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return duz ? duz.slice(0, 200) : ''
}

/** Sunucu `hata` nesnesi döndürdüyse onu kullan; yoksa durum kodundan üret (eski uçlar). */
function cozumle(durum: number, govde: unknown, ham: string): { mesaj: string; hatalar: string[]; cevrilmis: CevrilmisHata } {
  const d = (typeof govde === 'object' && govde !== null ? govde : {}) as { error?: unknown; hatalar?: unknown; message?: unknown; hata?: unknown }
  const hatalar = Array.isArray(d.hatalar) ? d.hatalar.map(String) : []
  const ucMesaji = typeof d.error === 'string' ? d.error : typeof d.message === 'string' ? d.message : ''

  // 1) Yeni biçim: { hata: { baslik, aciklama, cozum, teknikDetay, agirlik } }
  const h = d.hata as Partial<CevrilmisHata> | undefined
  if (h && typeof h.baslik === 'string' && typeof h.aciklama === 'string') {
    const cevrilmis: CevrilmisHata = {
      baslik: h.baslik, aciklama: h.aciklama, cozum: h.cozum,
      teknikDetay: h.teknikDetay ?? ucMesaji ?? '', agirlik: h.agirlik === 'uyari' ? 'uyari' : 'hata',
    }
    return { mesaj: ucMesaji || `${cevrilmis.baslik}: ${cevrilmis.aciklama}`, hatalar, cevrilmis }
  }

  // 2) Eski biçim / çeviri yok: durum koduna göre üret, uç mesajını açıklamaya koy.
  const ozet = hamOzet(ham)
  const temelDetay = ucMesaji || ozet || `HTTP ${durum}`
  const durumdan = durumCevir(durum, ucMesaji || ozet)
  if (durumdan) {
    const cevrilmis = ucMesaji ? { ...durumdan, aciklama: ucMesaji, teknikDetay: temelDetay } : durumdan
    return { mesaj: ucMesaji || `${cevrilmis.baslik}: ${cevrilmis.aciklama}`, hatalar, cevrilmis }
  }
  if (ucMesaji) return { mesaj: ucMesaji, hatalar, cevrilmis: hataCevir(ucMesaji) }
  const varsayilan = DURUM_MESAJI[durum] ?? `Beklenmeyen yanıt (HTTP ${durum})`
  const mesaj = ozet ? `${varsayilan} (HTTP ${durum}) — ${ozet}` : `${varsayilan} (HTTP ${durum})`
  return { mesaj, hatalar, cevrilmis: { baslik: varsayilan, aciklama: ozet || `Sunucu HTTP ${durum} döndürdü.`, teknikDetay: temelDetay, agirlik: 'hata' } }
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
    throw new ApiHatasi(0, `Sunucuya bağlanılamadı: ${e instanceof Error ? e.message : String(e)}`, [], durumCevir(0, String(e)) ?? undefined)
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
    const { mesaj, hatalar, cevrilmis } = cozumle(yanit.status, govde, ayristirilabildi ? '' : ham)
    throw new ApiHatasi(yanit.status, mesaj, hatalar, cevrilmis)
  }
  if (!ayristirilabildi) {
    throw new ApiHatasi(yanit.status, `Sunucu JSON yerine beklenmeyen yanıt döndürdü${hamOzet(ham) ? `: ${hamOzet(ham)}` : ' (boş gövde)'}`, [], {
      baslik: 'Sunucudan beklenmeyen yanıt',
      aciklama: 'İstek başarılı görünüyor ama gövde JSON değil; ekran sonucu okuyamadı.',
      cozum: 'Sayfayı yenileyip tekrar deneyin; sürerse ayrıntıyı BT ekibine iletin.',
      teknikDetay: ham.slice(0, 2000) || '(boş gövde)', agirlik: 'hata',
    })
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
    throw new ApiHatasi(0, `Sunucuya bağlanılamadı: ${e instanceof Error ? e.message : String(e)}`, [], durumCevir(0, String(e)) ?? undefined)
  }
  if (yanit.ok) return yanit
  const ham = await yanit.text().catch(() => '')
  let govde: unknown = null
  try { govde = ham ? JSON.parse(ham) : null } catch { /* HTML/boş gövde */ }
  const { mesaj, hatalar, cevrilmis } = cozumle(yanit.status, govde, govde ? '' : ham)
  throw new ApiHatasi(yanit.status, mesaj, hatalar, cevrilmis)
}

/** Yakalanan hatayı ekranda gösterilecek metne çevirir. */
export const hataMetni = (e: unknown) => (e instanceof Error ? e.message : String(e))
/** Uç `hatalar: []` döndürdüyse onları da döner (kaydetme ekranlarındaki liste için). */
export const hataListesi = (e: unknown) => (e instanceof ApiHatasi ? e.hatalar : [])

/** Yakalanan hatanın çevrilmiş yapısı (yoksa ham metinden üretilir) — ekranlardaki hata kutusu için. */
export const hataYapisi = (e: unknown): CevrilmisHata =>
  (e instanceof ApiHatasi && e.cevrilmis) ? e.cevrilmis : hataCevir(e instanceof Error ? e.message : String(e))

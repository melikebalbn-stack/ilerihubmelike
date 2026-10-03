// Servis ekranlarının ORTAK istek yardımcısı.
//
// 🔴 requirePermission 401/403 yanıtı `{ error: 'Yetersiz yetki', required }`
// döner — `message` ve `ok` alanı YOK. Bu yüzden `json.message || 'Kaydedilemedi.'`
// kalıbı yetkisiz kullanıcıya anlamsız bir mesaj gösteriyordu; üstelik pasifleştir /
// geri al çağrılarında yanıt hiç okunmuyordu (sessiz başarısızlık).

export const YETKI_YOK_MESAJI = 'Bu işlem için yetkiniz yok.'
export const OTURUM_YOK_MESAJI = 'Oturumunuz sona ermiş olabilir. Sayfayı yenileyip tekrar giriş yapın.'
export const AG_HATASI_MESAJI = 'Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.'

type ApiGovdesi = { ok?: boolean; message?: unknown; [anahtar: string]: unknown } | null | undefined

/** HTTP durumuna ve gövdeye göre kullanıcıya gösterilecek Türkçe mesaj. */
export function apiHataMesaji(status: number, json: ApiGovdesi, varsayilan: string): string {
  if (status === 403) return YETKI_YOK_MESAJI
  if (status === 401) return OTURUM_YOK_MESAJI
  const mesaj = json && typeof json.message === 'string' && json.message.trim() ? json.message : null
  return mesaj ?? varsayilan
}

export type ServisIstekSonucu =
  | { ok: true; status: number; json: ApiGovdesi }
  | { ok: false; status: number; mesaj: string; json: ApiGovdesi }

/**
 * fetch + gövde okuma + hata mesajı. Asla throw etmez: ağ hatası ve JSON
 * olmayan yanıt da `ok: false` olarak döner (çağıran try/catch yazmak zorunda kalmaz).
 */
export async function servisIstek(
  url: string,
  init?: RequestInit,
  varsayilanMesaj = 'İşlem tamamlanamadı.',
): Promise<ServisIstekSonucu> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    return { ok: false, status: 0, mesaj: AG_HATASI_MESAJI, json: null }
  }
  let json: ApiGovdesi = null
  try {
    json = (await res.json()) as ApiGovdesi
  } catch {
    json = null
  }
  if (!res.ok || (json && json.ok === false)) {
    return { ok: false, status: res.status, mesaj: apiHataMesaji(res.status, json, varsayilanMesaj), json }
  }
  return { ok: true, status: res.status, json }
}

/** JSON gövdeli POST/PATCH/PUT için kısayol. */
export function jsonIstek(method: 'POST' | 'PATCH' | 'PUT', govde: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde) }
}

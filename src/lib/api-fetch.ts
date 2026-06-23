import { toast } from 'sonner';

/**
 * PR-SR401-C: Genel 401 ele alma merkezi.
 *
 * `fetch` ile birebir aynı imza (drop-in). Tek farkı: response.status === 401 ise
 * görünür "oturum doldu" uyarısı verir ve kullanıcıyı /login'e callbackUrl ile yönlendirir
 * (giriş sonrası AYNI sayfaya döner).
 *
 * Tetik: SADECE HTTP status 401. Gövdeye bakılmaz — korumalı API'ler 401 gövdesini
 * tutarsız döndürüyor ({error:'Yetkisiz erişim'} vs {error:'Unauthorized'} vs düz metin),
 * tek güvenilir sinyal status kodu.
 *
 * Debounce: arka arkaya gelen 401'lerde (paralel istekler) tek toast + tek yönlendirme.
 * Bayrak sıfırlanmaz; tam sayfa navigasyonu modül state'ini zaten resetler.
 *
 * Kullanım: `fetch(...)` çağrılarını `apiFetch(...)` ile değiştir. Dönüş tipi aynı (Response),
 * çağıranın mevcut res.ok / res.json() mantığı korunur.
 */

let handling401 = false;

function handleUnauthenticated(): void {
  if (typeof window === 'undefined') return;
  if (handling401) return; // tek toast + tek yönlendirme
  handling401 = true;

  toast.error('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.');

  const { pathname, search } = window.location;
  const callbackUrl = encodeURIComponent(pathname + search);
  // Kısa gecikme: kullanıcı uyarıyı görsün, ardından login'e (callbackUrl ile) dön.
  window.setTimeout(() => {
    window.location.href = `/login?callbackUrl=${callbackUrl}`;
  }, 1200);
}

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    handleUnauthenticated();
  }
  return res;
}

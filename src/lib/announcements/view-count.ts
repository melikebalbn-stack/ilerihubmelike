/**
 * Görüntülenme sayacı kuralı — TEK KAYNAK (saf, test edilir).
 *
 * viewCount = TEKİL okuyucu. Bir kullanıcının İLK okundu kaydı (AnnouncementRead
 * INSERT) oluştuğunda +1; aynı kişi tekrar görüldü/onay çağırınca (kayıt zaten
 * var, unique kısıt) sayaç ARTMAZ. /goruldu, /acknowledge ve [id] GET bu kuralı
 * uygular (kayıt yoksa create + increment, varsa dokunma/onay güncelle).
 */
export function viewCountDelta(hasExistingRead: boolean): 0 | 1 {
  return hasExistingRead ? 0 : 1;
}

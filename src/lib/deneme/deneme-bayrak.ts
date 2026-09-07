// IV-FR-27 · Bildirim kill switch.
//
// recruitment/personele-donustur-bayrak.ts ile BİREBİR aynı desen: env değişkeni,
// varsayılan KAPALI (tanımsızsa false), tek okuma noktası.
//
// GEREKÇE: Faz 3 (cron + bildirim) canlıya çıktı ama Faz 4 (ekranlar) henüz yok.
// Bayrak kapalıyken form AÇILIR — veri birikir, zincir sahada doğrulanır — ama
// hiçbir bildirim gitmez, çünkü maildeki bağlantının açacağı ekran daha yok.
// Faz 4 bitince env `true` yapılır, kod değişikliği gerekmez.
//
// KAPSAM: YALNIZ IV-FR-27 bildirimleri. check-evaluations'ın mevcut İV maili
// (TWO_MONTH / SIX_MONTH) ve belge takibi (İlk Yardım / Yangın / MYK) bu bayraktan
// ETKİLENMEZ — onlar deneme modülünden bağımsız ve zaten çalışıyor.

export const DENEME_BILDIRIM_ENV = "DENEME_BILDIRIM_ENABLED";

/** Bayrak açık mı? Varsayılan KAPALI — değişken tanımsızsa false. */
export function denemeBildirimAcikMi(): boolean {
  return process.env[DENEME_BILDIRIM_ENV] === "true";
}

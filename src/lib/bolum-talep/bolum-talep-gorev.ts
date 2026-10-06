// Bölüm Değişikliği Talebi — "yeni görev" ve koltuk sonucu kararları (SAF).
//
// DB/oturum yok: hem uçlar hem testler aynı kuralı buradan okur.
// 06.10.2026 · ILR-00925 vakası: bölüm transferi uygulandı ama görev eski
// bölümün unvanında kaldığı için koltuk taşınamadı ("bolum uyusmuyor") ve bu
// bilgi yalnız denetime düştü — kimse görmedi.

/** Koltuk taşıma sonucu — personel-koltuk-senkron'un döndürdüğünün özeti. */
export type KoltukSonucOzet = {
  tasindi: boolean
  sebep?: string | null
  /** Taşıma yapılamadıysa koltuk açma denemesi olduysa sonucu. */
  acildi?: boolean
}

/**
 * Transferde görev güncellenecek mi?
 * Boş/whitespace ya da mevcutla aynı → DOKUNULMAZ (eski davranış korunur).
 */
export function transferGorevKarari(girdi: {
  yeniGorev?: string | null
  mevcutGorev: string | null
}): { guncellenecek: boolean; deger: string | null } {
  const yeni = (girdi.yeniGorev ?? '').trim()
  if (!yeni) return { guncellenecek: false, deger: null }
  if (yeni === (girdi.mevcutGorev ?? '').trim()) return { guncellenecek: false, deger: null }
  return { guncellenecek: true, deger: yeni }
}

/**
 * Talep kaydına yazılacak koltuk özeti (İV listesindeki rozetin kaynağı).
 * `acildi` true ise taşıma değil AÇMA olmuştur — yine "tamam" sayılır.
 */
export function talepKoltukOzeti(k: KoltukSonucOzet): { koltukTasindi: boolean; koltukSebep: string | null } {
  const tamam = k.tasindi || k.acildi === true
  return {
    koltukTasindi: tamam,
    koltukSebep: tamam ? null : (k.sebep ?? 'sebep bildirilmedi'),
  }
}

/** İV listesindeki rozet: yalnız koltuk TAŞINMADIYSA görünür. */
export function koltukRozeti(t: {
  durum: string
  koltukTasindi: boolean | null
}): { gorunur: boolean; metin: string } {
  // Karara bağlanmamış talepte koltuk hiç denenmemiştir — rozet yok.
  if (t.durum !== 'ONAYLANDI') return { gorunur: false, metin: '' }
  if (t.koltukTasindi !== false) return { gorunur: false, metin: '' }
  return { gorunur: true, metin: 'şema koltuğu taşınmadı' }
}

/**
 * Personel kartı uyarısı: kişinin bölümü ile ANA KOLTUĞUNUN bölümü farklıysa
 * şema ile kadro ayrışmıştır. Transferden bağımsız genel kontrol — elle yapılan
 * bölüm değişikliklerini de yakalar.
 */
export function koltukUyumsuzlugu(girdi: {
  personelBolumu: string | null
  koltukBolumu: string | null
}): { uyumsuz: boolean; mesaj: string | null } {
  const p = (girdi.personelBolumu ?? '').trim()
  const k = (girdi.koltukBolumu ?? '').trim()
  // Koltuk yoksa bu uyarının konusu değil (ayrı bir eksik: "şemada koltuğu yok").
  if (!p || !k) return { uyumsuz: false, mesaj: null }
  if (p === k) return { uyumsuz: false, mesaj: null }
  return {
    uyumsuz: true,
    mesaj: `Şema koltuğu "${k}" bölümünde; personel kaydı "${p}" diyor. Organizasyon şemasından elle taşınması gerekiyor.`,
  }
}

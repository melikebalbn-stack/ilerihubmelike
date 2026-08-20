const ACTION_LABELS: Record<string, string> = {
  OLUSTUR: 'Kayıt oluşturuldu', GUNCELLE: 'Kayıt güncellendi', IPTAL: 'Kayıt iptal edildi',
  CHECKLIST_EKLE: 'Checklist maddesi eklendi', CHECKLIST_GUNCELLE: 'Checklist maddesi güncellendi',
  CHECKLIST_SIL: 'Checklist maddesi silindi', CHECKLIST_TAMAMLA: 'Checklist durumu değiştirildi',
  TAMAMLAMAYA_GONDER: 'Tamamlamaya gönderildi', ONAY: 'Onay kararı verildi',
  REVIZYON_ISTE: 'Revizyon istendi', EK_YUKLE: 'Ek/kanıt yüklendi', EK_SIL: 'Ek/kanıt silindi',
  ONAY_GERI_ALINDI: 'Onay kararı geri alındı',
  BILDIRIM_KURALI_EKLE: 'Bildirim kuralı eklendi', BILDIRIM_KURALI_GUNCELLE: 'Bildirim kuralı güncellendi',
  BILDIRIM_KURALI_SIL: 'Bildirim kuralı silindi', DIS_KAYNAK_OLUSTUR: 'Dış kaynaktan kayıt oluşturuldu',
  DIS_KAYNAK_GUNCELLE: 'Dış kaynaktan güncellendi', DIS_KAYNAK_IPTAL: 'Dış kaynak tarafından iptal edildi',
  SONRAKI_DONEM_OLUSTURULDU: 'Sonraki dönem oluşturuldu',
}
const FIELD_LABELS: Record<string, string> = {
  anaKonu: 'Ana konu', surec: 'Süreç', kisaBaslik: 'Kısa başlık', aciklama: 'Açıklama',
  departmentId: 'Departman', periyot: 'Periyot', oncelik: 'Öncelik', disKurum: 'Dış kurum',
  nihaiSonTarih: 'Nihai son tarih', plananUygulamaTarihi: 'Planlanan tarih', anaSorumlu: 'Ana sorumlu',
  yedekSorumlu: 'Yedek sorumlu', bilgilendirilecekler: 'Bilgilendirilecek kişiler',
  gerceklesmeDurumu: 'Gerçekleşme durumu', gerceklesmeTarihi: 'Gerçekleşme tarihi',
  gerceklesmemeNedeni: 'Gerçekleşmeme/devir nedeni', baslik: 'Başlık', sorumlu: 'Sorumlu',
  sonTarih: 'Son tarih', zorunlu: 'Zorunluluk', kanitGerekli: 'Kanıt gerekliliği', tamamlandi: 'Tamamlanma',
  katilimcilar: 'Katılımcılar', bildirimKurallari: 'Bildirim kuralları', checklist: 'Checklist',
}
const SAFE_STATUSES = new Set(['TASLAK', 'PLANLANDI', 'DEVAM_EDIYOR', 'YAKLASIYOR', 'GECIKTI', 'TAMAMLANDI', 'TAMAMLANDI_ONAY_BEKLIYOR', 'ONAYLANDI', 'REVIZYON_ISTENDI', 'ERTELENDI', 'IPTAL_EDILDI', 'ASKIYA_ALINDI'])
const SAFE_DECISIONS = new Set(['ONAYLANDI', 'REVIZYON_ISTENDI'])
const ENUM_WORD_LABELS: Record<string, string> = {
  ALINDI: 'Alındı', ASKIYA: 'Askıya', BEKLIYOR: 'Bekliyor', DEVAM: 'Devam', EDILDI: 'Edildi', EDIYOR: 'Ediyor',
  ERTELENDI: 'Ertelendi', GECIKTI: 'Gecikti', IPTAL: 'İptal', ISTENDI: 'İstendi', ONAY: 'Onay', ONAYLANDI: 'Onaylandı',
  PLANLANDI: 'Planlandı', REVIZYON: 'Revizyon', SON: 'Son', TAMAMLANDI: 'Tamamlandı', TARIH: 'Tarih', TASLAK: 'Taslak',
  YAKLASIYOR: 'Yaklaşıyor',
}

export interface HistorySource {
  islemTuru: string
  alan: string | null
  eskiDeger: string | null
  yeniDeger: string | null
  createdAt: Date
  yapan: { name: string | null }
}
export interface SafeHistoryEntry { action: string; label: string; timestamp: string; actorName: string; details: string[] }

function parsedObject(value: string | null): Record<string, unknown> | null {
  if (!value?.startsWith('{')) return null
  try { const parsed: unknown = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null } catch { return null }
}
function enumLabel(value: string) { return value.split('_').map(part => ENUM_WORD_LABELS[part] ?? part.toLowerCase().replace(/^./, first => first.toLocaleUpperCase('tr'))).join(' ') }
function safeFields(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item in FIELD_LABELS).map(item => FIELD_LABELS[item])
}

export function formatHistoryEntry(source: HistorySource): SafeHistoryEntry {
  const metadata = parsedObject(source.yeniDeger)
  const details: string[] = []
  if (source.islemTuru === 'OLUSTUR' && metadata) {
    if (typeof metadata.yil === 'number' && Number.isInteger(metadata.yil)) details.push(`Yıl: ${metadata.yil}`)
    if (typeof metadata.periyot === 'string') details.push(`Periyot: ${enumLabel(metadata.periyot)}`)
  }
  if (['GUNCELLE', 'CHECKLIST_GUNCELLE', 'CHECKLIST_TAMAMLA'].includes(source.islemTuru) && metadata) {
    const fields = safeFields(metadata.degisenAlanlar)
    if (fields.length) details.push(`Değişen alanlar: ${fields.join(', ')}`)
  }
  if (source.islemTuru === 'TAMAMLAMAYA_GONDER' && metadata) addStatusDetails(metadata, details)
  if (['ONAY', 'REVIZYON_ISTE'].includes(source.islemTuru) && metadata) {
    if (typeof metadata.tur === 'number' && Number.isInteger(metadata.tur)) details.push(`Onay turu: ${metadata.tur}`)
    if (typeof metadata.sira === 'number' && Number.isInteger(metadata.sira)) details.push(`Kademe: ${metadata.sira}`)
    if (typeof metadata.karar === 'string' && SAFE_DECISIONS.has(metadata.karar)) details.push(`Karar: ${enumLabel(metadata.karar)}`)
    addStatusDetails(metadata, details)
  }
  if (source.islemTuru === 'ONAY_GERI_ALINDI' && metadata) {
    if (typeof metadata.tur === 'number' && Number.isInteger(metadata.tur)) details.push(`Onay turu: ${metadata.tur}`)
    if (typeof metadata.sira === 'number' && Number.isInteger(metadata.sira)) details.push(`Kademe: ${metadata.sira}`)
    if (typeof metadata.eskiKarar === 'string' && SAFE_DECISIONS.has(metadata.eskiKarar)) details.push(`Eski karar: ${enumLabel(metadata.eskiKarar)}`)
    if (typeof metadata.gerekce === 'string' && metadata.gerekce.trim()) details.push(`Gerekçe: ${metadata.gerekce.trim()}`)
    addStatusDetails(metadata, details)
  }
  if (['BILDIRIM_KURALI_EKLE', 'BILDIRIM_KURALI_SIL'].includes(source.islemTuru) && metadata && typeof metadata.tetik === 'string' && metadata.tetik.trim()) {
    details.push(`Tetikleyici: ${enumLabel(metadata.tetik)}`)
  }
  if (['DIS_KAYNAK_OLUSTUR', 'DIS_KAYNAK_GUNCELLE', 'DIS_KAYNAK_IPTAL'].includes(source.islemTuru) && metadata) {
    if (typeof metadata.kaynakModul === 'string' && metadata.kaynakModul.trim()) details.push(`Kaynak modül: ${metadata.kaynakModul.trim()}`)
    if (source.islemTuru !== 'DIS_KAYNAK_IPTAL') {
      const fields = safeFields(metadata.degisenAlanlar)
      if (fields.length) details.push(`Değişen alanlar: ${fields.join(', ')}`)
    }
  }
  if (source.islemTuru === 'SONRAKI_DONEM_OLUSTURULDU' && metadata) {
    if (typeof metadata.oncekiKayitId === 'string') details.push('Önceki dönem kaydından oluşturuldu')
    if (typeof metadata.yeniKayitId === 'string') details.push('Yeni dönem kaydı oluşturuldu')
    const fields = safeFields(metadata.kopyalananAlanlar)
    if (fields.length) details.push(`Kopyalanan bilgiler: ${fields.join(', ')}`)
  }
  if (['EK_YUKLE', 'EK_SIL'].includes(source.islemTuru) && metadata) {
    if (typeof metadata.dosyaTuru === 'string' && /^[\w.+-]+\/[\w.+-]+$/.test(metadata.dosyaTuru)) details.push(`Dosya türü: ${metadata.dosyaTuru}`)
    if (typeof metadata.boyut === 'number' && Number.isFinite(metadata.boyut) && metadata.boyut >= 0) details.push(`Boyut: ${formatBytes(metadata.boyut)}`)
  }
  return {
    action: source.islemTuru in ACTION_LABELS ? source.islemTuru : 'DIGER',
    label: ACTION_LABELS[source.islemTuru] ?? 'Diğer işlem',
    timestamp: source.createdAt.toISOString(), actorName: source.yapan.name?.trim() || 'Bilinmeyen kullanıcı', details,
  }
}
function addStatusDetails(metadata: Record<string, unknown>, details: string[]) {
  if (typeof metadata.oncekiDurum === 'string' && SAFE_STATUSES.has(metadata.oncekiDurum)) details.push(`Önceki durum: ${enumLabel(metadata.oncekiDurum)}`)
  if (typeof metadata.yeniDurum === 'string' && SAFE_STATUSES.has(metadata.yeniDurum)) details.push(`Yeni durum: ${enumLabel(metadata.yeniDurum)}`)
}
function formatBytes(value: number) { return value < 1024 * 1024 ? `${Math.ceil(value / 1024)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB` }

export { ACTION_LABELS }

export type ServisValidationResult = {
  valid: boolean
  errors: string[]
}

export type ServisFirmaForm = {
  ad: string
  yetkiliAdi?: string | null
  telefon?: string | null
  eposta?: string | null
  adres?: string | null
}

const EPOSTA_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateServisFirmaForm(form: ServisFirmaForm): ServisValidationResult {
  const errors: string[] = []

  if (!form.ad || form.ad.trim().length < 2) {
    errors.push('Firma adı en az 2 karakter olmalıdır.')
  }
  if (form.eposta && form.eposta.trim() && !EPOSTA_REGEX.test(form.eposta.trim())) {
    errors.push('Geçerli bir e-posta adresi girin.')
  }

  return { valid: errors.length === 0, errors }
}

export type ServisYerleskeForm = {
  kod: string
  ad: string
  adres?: string | null
  enlem?: number | null
  boylam?: number | null
}

export function validateServisYerleskeForm(form: ServisYerleskeForm): ServisValidationResult {
  const errors: string[] = []

  if (!form.kod || form.kod.trim().length < 2) {
    errors.push('Yerleşke kodu en az 2 karakter olmalıdır.')
  }
  if (!form.ad || form.ad.trim().length < 2) {
    errors.push('Yerleşke adı en az 2 karakter olmalıdır.')
  }
  if (form.enlem !== null && form.enlem !== undefined && (form.enlem < -90 || form.enlem > 90)) {
    errors.push('Enlem -90 ile 90 arasında olmalıdır.')
  }
  if (form.boylam !== null && form.boylam !== undefined && (form.boylam < -180 || form.boylam > 180)) {
    errors.push('Boylam -180 ile 180 arasında olmalıdır.')
  }

  return { valid: errors.length === 0, errors }
}

export type ServisGuzergahForm = {
  kod: string
  ad: string
  aciklama?: string | null
  bolge?: string | null
  yerleskeId: string
  gecerlilikBaslangici?: string | null
  gecerlilikBitisi?: string | null
}

function parseDateOnly(value?: string | null): Date | null {
  if (!value?.trim()) return null
  const date = new Date(`${value.trim()}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function validateServisGuzergahForm(form: ServisGuzergahForm): ServisValidationResult {
  const errors: string[] = []

  if (!form.kod || form.kod.trim().length < 2) {
    errors.push('Güzergâh kodu en az 2 karakter olmalıdır.')
  }
  if (!form.ad || form.ad.trim().length < 2) {
    errors.push('Güzergâh adı en az 2 karakter olmalıdır.')
  }
  if (!form.yerleskeId?.trim()) {
    errors.push('Yerleşke seçimi zorunludur.')
  }

  const baslangic = parseDateOnly(form.gecerlilikBaslangici)
  const bitis = parseDateOnly(form.gecerlilikBitisi)
  if (form.gecerlilikBaslangici?.trim() && !baslangic) {
    errors.push('Geçerlilik başlangıç tarihi geçersiz.')
  }
  if (form.gecerlilikBitisi?.trim() && !bitis) {
    errors.push('Geçerlilik bitiş tarihi geçersiz.')
  }
  if (baslangic && bitis && bitis < baslangic) {
    errors.push('Geçerlilik bitiş tarihi başlangıç tarihinden önce olamaz.')
  }

  return { valid: errors.length === 0, errors }
}

export type ServisDurakForm = {
  kod: string
  ad: string
  adresEtiketi?: string | null
  il?: string | null
  ilce?: string | null
  mahalle?: string | null
  enlem?: number | null
  boylam?: number | null
}

export function validateServisDurakForm(form: ServisDurakForm): ServisValidationResult {
  const errors: string[] = []

  if (!form.kod || form.kod.trim().length < 2) {
    errors.push('Durak kodu en az 2 karakter olmalıdır.')
  }
  if (!form.ad || form.ad.trim().length < 2) {
    errors.push('Durak adı en az 2 karakter olmalıdır.')
  }
  if (form.enlem !== null && form.enlem !== undefined && (!Number.isFinite(form.enlem) || form.enlem < -90 || form.enlem > 90)) {
    errors.push('Enlem -90 ile 90 arasında olmalıdır.')
  }
  if (form.boylam !== null && form.boylam !== undefined && (!Number.isFinite(form.boylam) || form.boylam < -180 || form.boylam > 180)) {
    errors.push('Boylam -180 ile 180 arasında olmalıdır.')
  }

  return { valid: errors.length === 0, errors }
}

export type ServisAracForm = {
  plaka: string
  kapasite: number
  firmaId: string
  aracTipi?: string | null
  gecerlilikBaslangici?: string | null
  gecerlilikBitisi?: string | null
}

export function validateServisAracForm(form: ServisAracForm): ServisValidationResult {
  const errors: string[] = []

  if (!form.plaka || form.plaka.replace(/\s+/g, '').length < 5) {
    errors.push('Plaka en az 5 karakter olmalıdır.')
  }
  if (!Number.isInteger(form.kapasite) || form.kapasite <= 0) {
    errors.push('Kapasite pozitif tam sayı olmalıdır.')
  }
  if (!form.firmaId?.trim()) {
    errors.push('Firma seçimi zorunludur.')
  }

  const baslangic = parseDateOnly(form.gecerlilikBaslangici)
  const bitis = parseDateOnly(form.gecerlilikBitisi)
  if (form.gecerlilikBaslangici?.trim() && !baslangic) {
    errors.push('Geçerlilik başlangıç tarihi geçersiz.')
  }
  if (form.gecerlilikBitisi?.trim() && !bitis) {
    errors.push('Geçerlilik bitiş tarihi geçersiz.')
  }
  if (baslangic && bitis && bitis < baslangic) {
    errors.push('Geçerlilik bitiş tarihi başlangıç tarihinden önce olamaz.')
  }

  return { valid: errors.length === 0, errors }
}

export type ServisSoforForm = {
  adSoyad: string
  telefon?: string | null
  firmaId?: string | null
  personnelId?: string | null
}

export function normalizeServisSoforTelefon(telefon?: string | null): string | null {
  if (!telefon?.trim()) return null
  const sade = telefon.trim().replace(/[\s()-]/g, '')
  const eslesme = sade.match(/^(?:\+90|0090|0)?([2-5]\d{9})$/)
  return eslesme ? `+90${eslesme[1]}` : null
}

export function validateServisSoforForm(form: ServisSoforForm): ServisValidationResult {
  const errors: string[] = []

  if (!form.adSoyad || form.adSoyad.trim().length < 3) {
    errors.push('Ad soyad en az 3 karakter olmalıdır.')
  }
  if (form.telefon?.trim() && !normalizeServisSoforTelefon(form.telefon)) {
    errors.push('Geçerli bir Türkiye telefon numarası girin.')
  }

  const firmaVar = !!form.firmaId?.trim()
  const personnelVar = !!form.personnelId?.trim()
  if (firmaVar === personnelVar) {
    errors.push('Şoför ya bir taşeron firmaya ya da bir personele bağlanmalıdır (ikisi birden değil).')
  }

  return { valid: errors.length === 0, errors }
}

export type ServisSeferDilimiYon = 'GIDIS' | 'DONUS'

export type ServisSeferDilimiForm = {
  kod: string
  ad: string
  yon: ServisSeferDilimiYon
  grupKodu?: string | null
  sira: number
}

export function validateServisSeferDilimiForm(form: ServisSeferDilimiForm): ServisValidationResult {
  const errors: string[] = []

  if (!form.kod || form.kod.trim().length < 2) {
    errors.push('Dilim kodu en az 2 karakter olmalıdır.')
  }
  if (!form.ad || form.ad.trim().length < 2) {
    errors.push('Dilim adı en az 2 karakter olmalıdır.')
  }
  if (form.yon !== 'GIDIS' && form.yon !== 'DONUS') {
    errors.push('Yön GİDİŞ veya DÖNÜŞ olmalıdır.')
  }
  if (!Number.isInteger(form.sira) || form.sira <= 0) {
    errors.push('Sıra pozitif tam sayı olmalıdır.')
  }

  return { valid: errors.length === 0, errors }
}

export type ServisGuzergahDurakForm = {
  durakId: string
}

export function validateServisGuzergahDurakForm(form: ServisGuzergahDurakForm): ServisValidationResult {
  const errors: string[] = []

  if (!form.durakId?.trim()) {
    errors.push('Durak seçimi zorunludur.')
  }

  return { valid: errors.length === 0, errors }
}

const SAAT_REGEX = /^([01][0-9]|2[0-3]):[0-5][0-9]$/

export type ServisGuzergahDurakSaatForm = {
  dilimId: string
  saat: string
}

export function validateServisGuzergahDurakSaatForm(form: ServisGuzergahDurakSaatForm): ServisValidationResult {
  const errors: string[] = []

  if (!form.dilimId?.trim()) {
    errors.push('Sefer dilimi seçimi zorunludur.')
  }
  if (!form.saat || !SAAT_REGEX.test(form.saat.trim())) {
    errors.push('Saat "SS:DD" formatında olmalıdır (00:00-23:59).')
  }

  return { valid: errors.length === 0, errors }
}

export type ServisRol = 'ANA' | 'YEDEK'

function validateRolVeTarihler(
  form: { rol: string; baslangicTarihi: string; bitisTarihi?: string | null },
  errors: string[],
) {
  if (form.rol !== 'ANA' && form.rol !== 'YEDEK') {
    errors.push('Rol ANA veya YEDEK olmalıdır.')
  }

  const baslangic = parseDateOnly(form.baslangicTarihi)
  if (!form.baslangicTarihi?.trim() || !baslangic) {
    errors.push('Başlangıç tarihi zorunludur ve geçerli olmalıdır.')
  }

  const bitis = parseDateOnly(form.bitisTarihi)
  if (form.bitisTarihi?.trim() && !bitis) {
    errors.push('Bitiş tarihi geçersiz.')
  }
  if (baslangic && bitis && bitis < baslangic) {
    errors.push('Bitiş tarihi başlangıç tarihinden önce olamaz.')
  }
}

export type ServisGuzergahAracVarsayilanForm = {
  guzergahId: string
  dilimId: string
  aracId: string
  rol: ServisRol
  baslangicTarihi: string
  bitisTarihi?: string | null
  neden?: string | null
  aciklama?: string | null
}

export function validateServisGuzergahAracVarsayilanForm(
  form: ServisGuzergahAracVarsayilanForm,
): ServisValidationResult {
  const errors: string[] = []

  if (!form.guzergahId?.trim()) errors.push('Güzergâh seçimi zorunludur.')
  if (!form.dilimId?.trim()) errors.push('Sefer dilimi seçimi zorunludur.')
  if (!form.aracId?.trim()) errors.push('Araç seçimi zorunludur.')
  validateRolVeTarihler(form, errors)

  return { valid: errors.length === 0, errors }
}

export type ServisGuzergahSoforVarsayilanForm = {
  guzergahId: string
  dilimId: string
  soforId: string
  rol: ServisRol
  baslangicTarihi: string
  bitisTarihi?: string | null
  neden?: string | null
  aciklama?: string | null
}

export function validateServisGuzergahSoforVarsayilanForm(
  form: ServisGuzergahSoforVarsayilanForm,
): ServisValidationResult {
  const errors: string[] = []

  if (!form.guzergahId?.trim()) errors.push('Güzergâh seçimi zorunludur.')
  if (!form.dilimId?.trim()) errors.push('Sefer dilimi seçimi zorunludur.')
  if (!form.soforId?.trim()) errors.push('Şoför seçimi zorunludur.')
  validateRolVeTarihler(form, errors)

  return { valid: errors.length === 0, errors }
}

// ServisSorumlusu — servis sorumlusu sürücüden ayrı bir roldür (bkz.
// schema.prisma yorumu). EXCLUDE/daterange kısıtı DB'de TANIMLI DEĞİL
// (migration SQL'de yalnız 4 EXCLUDE var, sorumlu bunlardan biri değil) —
// bilinçli tasarım: bir personel aynı anda birden fazla güzergahın
// sorumlusu olabilir. Yalnız CHECK (bitisTarihi IS NULL OR >= baslangic)
// karşılığı burada uygulanır, ANA-çakışma kontrolü YOK.
export type ServisSorumlusuForm = {
  personnelId: string
  guzergahId: string
  rol: ServisRol
  baslangicTarihi: string
  bitisTarihi?: string | null
  neden?: string | null
  aciklama?: string | null
}

export function validateServisSorumlusuForm(form: ServisSorumlusuForm): ServisValidationResult {
  const errors: string[] = []

  if (!form.personnelId?.trim()) errors.push('Personel seçimi zorunludur.')
  if (!form.guzergahId?.trim()) errors.push('Güzergâh seçimi zorunludur.')
  validateRolVeTarihler(form, errors)

  return { valid: errors.length === 0, errors }
}

// ServisPersonelDurum — güzergahtan BAĞIMSIZ, personel bazlı bir alan
// ("KENDİ GELİYOR" bir güzergah/durak değil, kullanım durumudur — bkz.
// ServisKullanimDurumu yorumu). EXCLUDE USING gist (personnelId WITH =,
// daterange(...) WITH &&) WHERE (aktif=true) — rol/durum ayrımı YOK, tüm
// aktif kayıtlar personnelId bazında birbiriyle çakışır (aynı personelin
// aynı anda iki farklı — hatta aynı — kullanım durumu olamaz).
// SIRKET_ARACI: 20260830112851_servis_sirket_araci_enum migration'ıyla
// (Melih) DB enum'una eklendi — burası yalnız o gerçek değeri yansıtıyor,
// enum'a dokunmuyor.
export type ServisKullanimDurumu = 'SERVIS_KULLANIYOR' | 'KENDI_GELIYOR' | 'KULLANMIYOR' | 'SIRKET_ARACI'

export type ServisPersonelDurumForm = {
  personnelId: string
  durum: ServisKullanimDurumu
  baslangicTarihi: string
  bitisTarihi?: string | null
  neden?: string | null
}

const GECERLI_KULLANIM_DURUMLARI: ServisKullanimDurumu[] = ['SERVIS_KULLANIYOR', 'KENDI_GELIYOR', 'KULLANMIYOR', 'SIRKET_ARACI']

export function validateServisPersonelDurumForm(form: ServisPersonelDurumForm): ServisValidationResult {
  const errors: string[] = []

  if (!form.personnelId?.trim()) errors.push('Personel seçimi zorunludur.')
  if (!GECERLI_KULLANIM_DURUMLARI.includes(form.durum)) {
    errors.push('Durum SERVIS_KULLANIYOR, KENDI_GELIYOR, KULLANMIYOR veya SIRKET_ARACI olmalıdır.')
  }

  const baslangic = parseDateOnly(form.baslangicTarihi)
  if (!form.baslangicTarihi?.trim() || !baslangic) {
    errors.push('Başlangıç tarihi zorunludur ve geçerli olmalıdır.')
  }

  const bitis = parseDateOnly(form.bitisTarihi)
  if (form.bitisTarihi?.trim() && !bitis) {
    errors.push('Bitiş tarihi geçersiz.')
  }
  if (baslangic && bitis && bitis < baslangic) {
    errors.push('Bitiş tarihi başlangıç tarihinden önce olamaz.')
  }

  return { valid: errors.length === 0, errors }
}

// ServisPersonelAtama — bir personelin bir güzergaha (opsiyonel: belirli bir
// durağa) zaman aralıklı ataması, N sefer dilimi ile. EXCLUDE USING gist
// (personnelId WITH =, daterange(...) WITH &&) WHERE (aktif=true) —
// ServisPersonelDurum ile BİREBİR aynı desen: guzergahId/durakId kısıta
// dahil değil, TÜM aktif atamalar personnelId bazında birbiriyle çakışır.
// dilimIdleri: şema yorumunda "en az 1 dilim" DB kısıtı yok (trigger
// gerektirir, istenmedi) — bu kod-seviyesi kural burada uygulanır.
export type ServisPersonelAtamaForm = {
  personnelId: string
  guzergahId: string
  durakId?: string | null
  baslangicTarihi: string
  bitisTarihi?: string | null
  dilimIdleri: string[]
}

export function validateServisPersonelAtamaForm(form: ServisPersonelAtamaForm): ServisValidationResult {
  const errors: string[] = []

  if (!form.personnelId?.trim()) errors.push('Personel seçimi zorunludur.')
  if (!form.guzergahId?.trim()) errors.push('Güzergâh seçimi zorunludur.')
  if (!form.dilimIdleri || form.dilimIdleri.filter((d) => d?.trim()).length === 0) {
    errors.push('En az bir sefer dilimi seçilmelidir.')
  }

  const baslangic = parseDateOnly(form.baslangicTarihi)
  if (!form.baslangicTarihi?.trim() || !baslangic) {
    errors.push('Başlangıç tarihi zorunludur ve geçerli olmalıdır.')
  }

  const bitis = parseDateOnly(form.bitisTarihi)
  if (form.bitisTarihi?.trim() && !bitis) {
    errors.push('Bitiş tarihi geçersiz.')
  }
  if (baslangic && bitis && bitis < baslangic) {
    errors.push('Bitiş tarihi başlangıç tarihinden önce olamaz.')
  }

  return { valid: errors.length === 0, errors }
}

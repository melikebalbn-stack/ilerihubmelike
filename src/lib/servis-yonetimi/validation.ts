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
  firmaId: string
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
  if (!form.firmaId?.trim()) {
    errors.push('Firma seçimi zorunludur.')
  }

  return { valid: errors.length === 0, errors }
}

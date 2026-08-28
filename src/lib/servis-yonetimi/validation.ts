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

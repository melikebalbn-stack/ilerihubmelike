import type { EnvanterUrunForm } from '@/types/envanter'

export type EnvanterValidationResult = {
  valid: boolean
  errors: string[]
}

const REQUIRED_GENERAL_FIELDS: Array<keyof EnvanterUrunForm> = [
  'kod',
  'ad',
  'kategori',
  'tip',
  'olcuBirimi',
]

function isEmpty(value: unknown) {
  return value === undefined || value === null || String(value).trim() === ''
}

function toNumber(value: string) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

export function validateEnvanterUrunForm(
  form: EnvanterUrunForm,
): EnvanterValidationResult {
  const errors: string[] = []

  REQUIRED_GENERAL_FIELDS.forEach((field) => {
    if (isEmpty(form[field])) {
      errors.push(`${field} alanı zorunludur.`)
    }
  })

  if (form.kod && form.kod.length < 2) {
    errors.push('Ürün kodu en az 2 karakter olmalıdır.')
  }

  if (form.ad && form.ad.length < 2) {
    errors.push('Ürün adı en az 2 karakter olmalıdır.')
  }

  validateVariants(form, errors)
  validateStock(form, errors)
  validatePurchase(form, errors)
  validateDistribution(form, errors)

  return {
    valid: errors.length === 0,
    errors,
  }
}

function validateVariants(form: EnvanterUrunForm, errors: string[]) {
  if (!form.varyantTipi) return

  if (
    (form.varyantTipi === 'BEDEN' || form.varyantTipi === 'BEDEN_RENK') &&
    form.bedenler.length === 0
  ) {
    errors.push('Beden varyantı için en az bir beden seçilmelidir.')
  }

  if (
    (form.varyantTipi === 'NUMARA' || form.varyantTipi === 'NUMARA_RENK') &&
    form.numaralar.length === 0
  ) {
    errors.push('Numara varyantı için en az bir numara seçilmelidir.')
  }

  if (
    (form.varyantTipi === 'RENK' ||
      form.varyantTipi === 'BEDEN_RENK' ||
      form.varyantTipi === 'NUMARA_RENK') &&
    form.renkler.length === 0
  ) {
    errors.push('Renk varyantı için en az bir renk seçilmelidir.')
  }
}

function validateStock(form: EnvanterUrunForm, errors: string[]) {
  Object.entries(form.stokSatirlari).forEach(([key, row]) => {
    const ilkGiris = toNumber(row.ilkGiris || '0')
    const minStok = toNumber(row.minStok || '0')
    const kritikStok = toNumber(row.kritikStok || '0')
    const maxStok = row.maxStok ? toNumber(row.maxStok) : null

    if (ilkGiris === null || ilkGiris < 0) {
      errors.push(`${key} için ilk giriş miktarı geçerli olmalıdır.`)
    }

    if (minStok === null || minStok < 0) {
      errors.push(`${key} için minimum stok geçerli olmalıdır.`)
    }

    if (kritikStok === null || kritikStok < 0) {
      errors.push(`${key} için kritik stok geçerli olmalıdır.`)
    }

    if (maxStok !== null && maxStok < 0) {
      errors.push(`${key} için maksimum stok geçerli olmalıdır.`)
    }

    if (minStok !== null && kritikStok !== null && kritikStok > minStok) {
      errors.push(`${key} için kritik stok minimum stoktan büyük olamaz.`)
    }

    if (
      maxStok !== null &&
      minStok !== null &&
      maxStok > 0 &&
      maxStok < minStok
    ) {
      errors.push(`${key} için maksimum stok minimum stoktan küçük olamaz.`)
    }
  })
}

function validatePurchase(form: EnvanterUrunForm, errors: string[]) {
  if (form.sonAlisFiyati) {
    const price = toNumber(form.sonAlisFiyati)
    if (price === null || price < 0) {
      errors.push('Son alış fiyatı geçerli olmalıdır.')
    }
  }

  if (form.kdvOrani) {
    const kdv = toNumber(form.kdvOrani)
    if (kdv === null || kdv < 0 || kdv > 100) {
      errors.push('KDV oranı 0 ile 100 arasında olmalıdır.')
    }
  }

  if (form.minSiparisMiktari) {
    const minOrder = toNumber(form.minSiparisMiktari)
    if (minOrder === null || minOrder < 0) {
      errors.push('Minimum sipariş miktarı geçerli olmalıdır.')
    }
  }

  if (form.tedarikSuresiGun) {
    const leadTime = toNumber(form.tedarikSuresiGun)
    if (leadTime === null || leadTime < 0) {
      errors.push('Tedarik süresi geçerli olmalıdır.')
    }
  }
}

function validateDistribution(form: EnvanterUrunForm, errors: string[]) {
  if (form.kullanimOmruGun) {
    const lifetime = toNumber(form.kullanimOmruGun)
    if (lifetime === null || lifetime < 0) {
      errors.push('Kullanım ömrü geçerli olmalıdır.')
    }
  }

  if (
    form.dagitimSekli === 'PERIYODIK' &&
    (!form.periyot || form.periyot.trim() === '')
  ) {
    errors.push('Periyodik dağıtım için periyot seçilmelidir.')
  }

  if (
    form.tahminiDagitim === 'BELIRLI_TARIH' &&
    (!form.sonrakiDagitimTarihi || form.sonrakiDagitimTarihi.trim() === '')
  ) {
    errors.push('Belirli tarih seçildiğinde sonraki dağıtım tarihi girilmelidir.')
  }
}

export function assertValidEnvanterUrunForm(form: EnvanterUrunForm) {
  const result = validateEnvanterUrunForm(form)

  if (!result.valid) {
    throw new Error(result.errors.join('\n'))
  }
}
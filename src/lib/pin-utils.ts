import bcrypt from "bcryptjs"

// Basit/zayıf PIN pattern'leri
const WEAK_PINS = [
  "123456", "654321", "111111", "222222", "333333", "444444", "555555",
  "666666", "777777", "888888", "999999", "000000", "123123", "121212",
  "112233", "102030", "abcdef", "aaaaaa", "qwerty", "abc123",
]

// Ardışık sayı kontrolü (123456, 234567, etc.)
function hasSequentialDigits(pin: string, length: number = 4): boolean {
  const digits = pin.replace(/\D/g, "")
  if (digits.length < length) return false

  for (let i = 0; i <= digits.length - length; i++) {
    let isAscending = true
    let isDescending = true

    for (let j = 1; j < length; j++) {
      const curr = parseInt(digits[i + j])
      const prev = parseInt(digits[i + j - 1])

      if (curr !== prev + 1) isAscending = false
      if (curr !== prev - 1) isDescending = false
    }

    if (isAscending || isDescending) return true
  }

  return false
}

// Tekrarlayan karakter kontrolü (aaaaaa, 111111, etc.)
function hasRepeatingChars(pin: string, count: number = 3): boolean {
  for (let i = 0; i <= pin.length - count; i++) {
    const char = pin[i]
    let repeats = 1

    for (let j = 1; j < count; j++) {
      if (pin[i + j] === char) repeats++
    }

    if (repeats >= count) return true
  }

  return false
}

export interface PinValidationResult {
  isValid: boolean
  error?: string
}

/**
 * PIN güçlülük validasyonu
 * - Minimum 6 karakter
 * - Zayıf pattern'ler reddedilir
 * - Ardışık sayılar reddedilir
 * - Tekrarlayan karakterler reddedilir
 */
export function validatePinStrength(pin: string): PinValidationResult {
  // Minimum uzunluk kontrolü
  if (!pin || pin.length < 6) {
    return {
      isValid: false,
      error: "PIN en az 6 karakter olmalıdır",
    }
  }

  // Maximum uzunluk kontrolü
  if (pin.length > 20) {
    return {
      isValid: false,
      error: "PIN en fazla 20 karakter olabilir",
    }
  }

  // Zayıf PIN kontrolü
  if (WEAK_PINS.includes(pin.toLowerCase())) {
    return {
      isValid: false,
      error: "Bu PIN çok zayıf, daha güçlü bir PIN seçin",
    }
  }

  // Ardışık sayı kontrolü
  if (hasSequentialDigits(pin, 4)) {
    return {
      isValid: false,
      error: "PIN ardışık sayılar içeremez (örn: 1234, 4321)",
    }
  }

  // Tekrarlayan karakter kontrolü
  if (hasRepeatingChars(pin, 4)) {
    return {
      isValid: false,
      error: "PIN aynı karakteri 4+ kez tekrarlayamaz",
    }
  }

  return { isValid: true }
}

/**
 * PIN hash'le (bcrypt)
 */
export async function hashPin(pin: string): Promise<string> {
  const saltRounds = 10
  return bcrypt.hash(pin, saltRounds)
}

/**
 * PIN doğrula (bcrypt hash'e karşı)
 */
export async function verifyPin(pin: string, hashedPin: string): Promise<boolean> {
  return bcrypt.compare(pin, hashedPin)
}

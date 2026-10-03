import { NextResponse } from 'next/server'
import { AtamaDilimHatasi } from './atama-dilim'

// Dilim ekleme/çıkarma uçlarının ORTAK hata → yanıt eşlemesi.
// Onay gerektiren durumlar 409 (istemci uyarı + onayla yeniden gönderir), diğerleri 400.
export function atamaDilimHataYaniti(err: unknown, varsayilan: string) {
  if (err instanceof AtamaDilimHatasi) {
    if (err.kod === 'ASIM_ONAYI_GEREKLI' || err.kod === 'DILIMSIZ_ONAYI_GEREKLI') {
      return NextResponse.json({ ok: false, kod: err.kod, message: err.message, ayrinti: err.ayrinti ?? null }, { status: 409 })
    }
    return NextResponse.json({ ok: false, message: err.message }, { status: 400 })
  }
  console.error('Atama dilim hatası:', err)
  return NextResponse.json({ ok: false, message: varsayilan }, { status: 500 })
}

/** İstek gövdesi JSON değilse veya nesne değilse null. */
export async function govdeOku(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = await request.json()
    return b && typeof b === 'object' && !Array.isArray(b) ? (b as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export const dizi = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

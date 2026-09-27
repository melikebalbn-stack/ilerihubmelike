import { NextResponse } from 'next/server'

export const GUARD = ['depo.terminal.use', 'admin.system.manage']

export const hata = (e: unknown) =>
  NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'IFS işlemi başarısız' }, { status: 502 })

/** Rota parametresindeki sevkiyat no → pozitif tamsayı ya da null. */
export function sevkiyatNo(ham: string): number | null {
  const s = decodeURIComponent(ham).trim()
  if (!/^\d+$/.test(s)) return null
  const n = Number(s)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

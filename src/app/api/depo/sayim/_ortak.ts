import { NextResponse } from 'next/server'

export const GUARD = ['depo.terminal.use', 'admin.system.manage']

export const hata = (e: unknown) =>
  NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'IFS işlemi başarısız' }, { status: 502 })

/** Rota parametresindeki sayım raporu no (InvListNo) → temiz metin ya da null. */
export function raporNo(ham: string): string | null {
  const s = decodeURIComponent(ham).trim()
  return /^[A-Za-z0-9_-]{1,20}$/.test(s) ? s : null
}

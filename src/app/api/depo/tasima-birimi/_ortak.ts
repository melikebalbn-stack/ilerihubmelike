import { NextResponse } from 'next/server'
import { z } from 'zod'

export const GUARD = ['depo.terminal.use', 'admin.system.manage']

export const hata = (e: unknown) =>
  NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'IFS işlemi başarısız' }, { status: 502 })

/** Rota parametresindeki palet no → pozitif tamsayı ya da null. */
export function paletNo(ham: string): number | null {
  const s = decodeURIComponent(ham).trim()
  if (!/^\d+$/.test(s)) return null
  const n = Number(s)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

export const StokSchema = z.object({
  partNo: z.string().min(1),
  locationNo: z.string().min(1),
  lotBatchNo: z.string(),
  serialNo: z.string(),
  engChgLevel: z.string(),
  waivDevRejNo: z.string(),
  configurationId: z.string(),
  activitySeq: z.number(),
  handlingUnitId: z.number(),
})

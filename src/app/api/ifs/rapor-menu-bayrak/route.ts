import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { canIfsRaporView } from '@/lib/ifs/rapor-erisim'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ifs/rapor-menu-bayrak — Sidebar "Raporlar" (/ifs/raporlar) görünürlüğü.
 * Kural DİNAMİK (görev/bölüm) olduğu için client'ta hesaplanamaz; sayfa guard'ıyla
 * BİREBİR aynı fonksiyon (canIfsRaporView). deneme/kadro menu-bayrak deseni.
 */
export async function GET() {
  const { userId, error } = await requireSession()
  if (error) return error
  return NextResponse.json({ gorunur: await canIfsRaporView(userId) })
}

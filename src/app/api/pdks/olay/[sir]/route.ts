import { NextRequest } from 'next/server'
import { pushOlayIsle } from '@/lib/pdks/push-isle'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/pdks/olay/<PDKS_PUSH_SECRET> — sır path'te. Hikvision DS-K2604T httpHosts url alanı
// query string (?t=) kabul etmez (badURLFormat); sır bu yüzden path segmenti olarak taşınır.
export async function POST(req: NextRequest, { params }: { params: Promise<{ sir: string }> }) {
  const { sir } = await params
  return pushOlayIsle(req, sir)
}

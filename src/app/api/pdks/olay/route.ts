import { NextRequest } from 'next/server'
import { pushOlayIsle } from '@/lib/pdks/push-isle'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/pdks/olay?t=<PDKS_PUSH_SECRET> — query ile sır (manuel/test). Panel path uçunu kullanır.
export async function POST(req: NextRequest) {
  return pushOlayIsle(req, req.nextUrl.searchParams.get('t'))
}

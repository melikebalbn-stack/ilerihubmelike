import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { gecislerimAcikMi } from '@/lib/pdks/gecislerim'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/pdks/gecislerim/menu-bayrak — Sidebar "Geçişlerim" görünürlüğü (SUNUCU bayrağı; avans deseni).
export async function GET() {
  const { error } = await requireUser()
  if (error) return NextResponse.json({ gorunur: false }, { status: 401 })
  return NextResponse.json({ gorunur: await gecislerimAcikMi() })
}

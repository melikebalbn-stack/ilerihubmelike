import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/require-user'
import { menuBayragi } from '@/lib/izin/talep-servis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/izin/menu-bayrak — Sidebar "İzin Talebim" / "İzin Onaylarım" görünürlüğü + bekleyen sayısı (SUNUCU bayrağı).
// izin_talep_acik != 'true' iken ikisi de gizli (İV dahil — İV sayfalara doğrudan adresle girer).
export async function GET() {
  const r = await requireUser()
  if (r.error) return NextResponse.json({ talep: false, onay: false, bekleyen: 0 }, { status: 401 })
  return NextResponse.json(await menuBayragi(r.user.id))
}

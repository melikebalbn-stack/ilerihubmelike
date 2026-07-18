import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'
import { oneriPlanlananAlim, oneriTurnoverOrani } from '@/lib/envanter/sezon'

export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error
  if (!session.user.permissions?.includes('envanter.view')) {
    return NextResponse.json({ error: 'Yetkisiz erisim' }, { status: 403 })
  }

  const [planlananAlimOnerisi, turnoverOranOnerisi] = await Promise.all([
    oneriPlanlananAlim(),
    oneriTurnoverOrani(),
  ])

  return NextResponse.json({ ok: true, data: { planlananAlimOnerisi, turnoverOranOnerisi } })
}

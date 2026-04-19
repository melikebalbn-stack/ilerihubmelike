// Backups API - Client Config
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET - Backup module client-side feature flags
// Auth-gated to prevent feature surface enumeration by unauthenticated callers.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    restoreEnabled: process.env.ENABLE_BACKUP_RESTORE === 'true',
  })
}

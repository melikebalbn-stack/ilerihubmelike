// Backups API - Client Config
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth/require-session'

// GET - Backup module client-side feature flags
// Auth-gated to prevent feature surface enumeration by unauthenticated callers.
export async function GET() {
  // PR-Y2.5-backups: requireSession (auth-gated feature flag)
  const { error } = await requireSession()
  if (error) return error

  return NextResponse.json({
    restoreEnabled: process.env.ENABLE_BACKUP_RESTORE === 'true',
  })
}

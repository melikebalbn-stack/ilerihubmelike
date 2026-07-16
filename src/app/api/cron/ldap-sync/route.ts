import { NextRequest, NextResponse } from 'next/server'
import { syncLDAPUsersToDb } from '@/lib/ldap-sync'

/**
 * PR-LDAP-DEBOUNCE: LDAP → DB senkronizasyonu — TEK tetikleyici.
 *
 * Sistem cron'dan çağrılır (in-process node-cron KALDIRILDI):
 *   /etc/cron.d/ilerihub-cron → 0 2,8,14,20 * * * curl -sX POST \
 *     -H "x-cron-secret: <CRON_SECRET>" .../api/cron/ldap-sync
 *
 * Auth: x-cron-secret header (mevcut cron deseni; Bearer değil).
 * Tek-uçuş: syncLDAPUsersToDb içindeki pg_try_advisory_lock — eşzamanlı tetikte
 * yalnız biri çalışır.
 */
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncLDAPUsersToDb()
    return NextResponse.json({
      ok: true,
      created: result.created,
      updated: result.updated,
      deactivated: result.deactivated,
      errors: result.errors,
      duration: result.duration,
      status: result.status,
    })
  } catch (error) {
    console.error('❌ LDAP sync (cron endpoint) failed:', error)
    return NextResponse.json(
      { ok: false, error: 'LDAP sync failed' },
      { status: 500 },
    )
  }
}

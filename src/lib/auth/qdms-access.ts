import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import type { User } from '@/generated/prisma'
import { requireUser } from './require-user'
import { hasPermission } from './has-permission'
import { canAccessKalite } from './kalite-access'

/**
 * QDMS (Kalite Yönetim Sistemi) erişim guard'ı — API route'ları için.
 *
 * Koşul: oturumlu + aktif kullanıcı VE
 *   canAccessKalite(role, department, ou)  (kalite ekibi + admin — bugünkü kitle)
 *   VEYA hasPermission('qdms.view' | 'qdms.manage')  (RBAC'e geçiş yolu)
 *
 * mode:
 *   'view'   → GET (okuma)          → qdms.view
 *   'manage' → POST/PUT/PATCH/DELETE (yazma/onay) → qdms.manage
 *
 * Dönüş `requireUser` süper-set'i: { session, user, userId, error }.
 *   - Oturumsuz/pasif → error = 401 (requireUser).
 *   - Oturumlu ama yetkisiz → error = 403.
 * Kullanım: const { error } = await qdmsAccessResult('view'); if (error) return error
 */
export async function qdmsAccessResult(
  mode: 'view' | 'manage',
): Promise<
  | { session: Session; user: User; userId: string; error: null }
  | { session: null; user: null; userId: null; error: NextResponse }
> {
  const { session, user, error } = await requireUser()
  if (error) return { session: null, user: null, userId: null, error }

  const perm = mode === 'manage' ? 'qdms.manage' : 'qdms.view'
  const izinli =
    canAccessKalite(session.user.role, session.user.department, session.user.ou) ||
    (await hasPermission(perm))

  if (!izinli) {
    return {
      session: null,
      user: null,
      userId: null,
      error: NextResponse.json({ error: 'Yetersiz yetki', required: [perm] }, { status: 403 }),
    }
  }

  return { session, user, userId: user.id, error: null }
}

import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma'

/**
 * PR-AUDIT-LOG-EXPANSION: Ortak audit helper.
 *
 * Mevcut PermissionAuditLog tablosu (Y3'ten beri RBAC için var) — generic
 * action+targetType field'ları sayesinde RBAC dışındaki domain'ler için de
 * yeniden kullanılır. Schema değişikliği yok.
 *
 * Kullanım:
 *   await logAuditEvent({
 *     action: 'BACKUP_CREATED',
 *     actorId: session.user.id,
 *     targetType: 'BACKUP',
 *     targetId: backup.id,
 *     details: { fileName, fileSize, ... },
 *   })
 *
 * KRİTİK: try/catch içinde — audit fail kritik request path'i bozmaz.
 * Audit kaybı, request fail'inden daha az hasarlıdır.
 */

export type AuditTargetType =
  // RBAC (Y3'ten beri)
  | 'USER'
  | 'ROLE'
  | 'PERMISSION'
  | 'ROLE_PERMISSION'
  | 'USER_ROLE'
  | 'LDAP_GROUP_MAP'
  // PR-AUDIT-LOG-EXPANSION
  | 'BACKUP'
  | 'BGYS_DOCUMENT'
  | 'PERSONNEL'

export interface AuditLogParams {
  action: string
  actorId: string
  targetType: AuditTargetType
  targetId?: string
  details?: Record<string, unknown>
  /**
   * Mevcut transaction içinde çalıştırılması gerektiğinde
   * (atomicity: ana yazma + audit aynı tx'te commit/rollback olur).
   */
  tx?: Prisma.TransactionClient
}

export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  const client = params.tx ?? prisma
  try {
    await client.permissionAuditLog.create({
      data: {
        action: params.action,
        actorId: params.actorId,
        targetType: params.targetType,
        targetId: params.targetId ?? '',
        details: (params.details ?? {}) as Prisma.InputJsonValue,
      },
    })
  } catch (error) {
    // Atomicity istenmiyorsa (tx yok) audit fail'i sessize alıyoruz —
    // request başarılı dönsün, audit kaybı sadece konsola yazılsın.
    if (params.tx) {
      throw error
    }
    console.error('[AUDIT-LOG] Failed:', params.action, error)
  }
}

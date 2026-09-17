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
  // Org şeması (kadro omurgası)
  | 'ORG_UNIT'
  // IFS canlı değerlendirme (PR-2)
  | 'IFS_TASK_EVALUATION'
  | 'IFS_COURSE_EVALUATION'
  // Akademi hard-delete
  | 'AKADEMI_COURSE'
  | 'AKADEMI_CONTENT'
  // Mesai hedef adet değişikliği (yalnız Fabrika Müdürü/admin)
  | 'OVERTIME_TARGET'
  // Mesai formu — reddedileni yeniden açma (admin)
  | 'OVERTIME_FORM'
  // İV Excel export'ları (feat/iv-export-import)
  | 'BLUECOLLAR_USER'
  | 'SUCCESSION_PLAN'
  | 'PERFORMANCE_REVIEW'
  | 'PERSONNEL_REQUEST'
  | 'IS_ANALIZI'
  | 'JOB_CANDIDATE'
  // İş başvurusu — İK'nın aday verisinde yaptığı düzeltmeler (beyaz liste alanları).
  // action: JOB_APPLICATION_UPDATED, details.degisiklikler = [{alan,etiket,eski,yeni}]
  | 'JOB_APPLICATION'
  // IT talebi kalıcı silme (helpdesk.ticket.delete). action: TICKET_DELETED,
  // details = ticket no/konu/durum + silinen yorum-timeline-worklog sayıları.
  // Kayıt silinmeden ÖNCE ve aynı transaction'da yazılır.
  | 'TICKET'
  | 'PERSONNEL_WEEKLY_REPORT'
  | 'IFS_PERSONEL_SYNC'

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

export type AuditSonucu = { ok: true } | { ok: false; hata: string }

/**
 * Denetim satırı yazar. tx verilmişse hata FIRLATILIR (atomiklik); tx yoksa istek düşmez
 * ama sonuç DÖNER ve belirgin uyarı basılır — çağıran isterse yanıta taşır.
 *
 * 16.09.2026 dersi: actorId `User.id` FK'sıdır. 'cron:…' / 'pilot:…' gibi sahte aktörlerle
 * yazılan satırlar FK'ya takılıp SESSİZCE düşüyordu (IFS senkronu + haftalık personel maili
 * denetimi hiç yazılmadı). Sistem işleri için `User.id='sistem'` hesabı kullanılır.
 */
export async function logAuditEvent(params: AuditLogParams): Promise<AuditSonucu> {
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
    return { ok: true }
  } catch (error) {
    if (params.tx) throw error
    const kod = (error as { code?: string })?.code
    const hata = kod === 'P2003'
      ? `denetim aktörü '${params.actorId}' User tablosunda yok (FK) — satır YAZILAMADI`
      : `denetim yazılamadı: ${(error as Error)?.message ?? String(error)}`
    console.warn(`[AUDIT-LOG] UYARI ${params.action} → ${hata}`)
    return { ok: false, hata }
  }
}

/** Sistem/cron işleri için denetim aktörü (User.id — ldap-sync 'ad_' dışını ellemez). */
export const SISTEM_AKTOR_ID = process.env.SISTEM_AKTOR_ID ?? 'sistem'

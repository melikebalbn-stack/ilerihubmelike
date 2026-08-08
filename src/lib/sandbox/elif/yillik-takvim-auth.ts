import type { Session } from 'next-auth'
import { PERMISSION_KEYS, type PermissionKey } from '@/lib/auth/permissions'

export type YillikTakvimAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'cancel'
  | 'complete'
  | 'approve'
  | 'attachment.manage'
  | 'notification.manage'

const ACTION_PERMISSION: Record<YillikTakvimAction, PermissionKey> = {
  view: PERMISSION_KEYS.YILLIK_TAKVIM_VIEW,
  create: PERMISSION_KEYS.YILLIK_TAKVIM_CREATE,
  edit: PERMISSION_KEYS.YILLIK_TAKVIM_EDIT,
  cancel: PERMISSION_KEYS.YILLIK_TAKVIM_CANCEL,
  complete: PERMISSION_KEYS.YILLIK_TAKVIM_COMPLETE,
  approve: PERMISSION_KEYS.YILLIK_TAKVIM_APPROVE,
  'attachment.manage': PERMISSION_KEYS.YILLIK_TAKVIM_ATTACHMENT_MANAGE,
  'notification.manage': PERMISSION_KEYS.YILLIK_TAKVIM_NOTIFICATION_MANAGE,
}

function sessionPermissions(session: Session | null | undefined): ReadonlySet<string> {
  return new Set(session?.user?.permissions ?? [])
}

/**
 * Saf RBAC kontrolü. `view` yalnız görüntüleme içindir ve hiçbir yazma
 * aksiyonuna yetki vermez. `yilliktakvim.admin` modül içindeki tüm aksiyonları
 * kapsar; diğer anahtarlar birbirinden bağımsızdır.
 */
export function canPerformYillikTakvimAction(
  session: Session | null | undefined,
  action: YillikTakvimAction,
): boolean {
  const permissions = sessionPermissions(session)
  return (
    permissions.has(PERMISSION_KEYS.YILLIK_TAKVIM_ADMIN) ||
    permissions.has(ACTION_PERMISSION[action])
  )
}

export function canViewYillikTakvim(session: Session | null | undefined): boolean {
  return canPerformYillikTakvimAction(session, 'view')
}

export function requiredYillikTakvimPermission(action: YillikTakvimAction): PermissionKey {
  return ACTION_PERMISSION[action]
}

import { PERMISSION_KEYS } from '@/lib/auth/permissions'

/** Salt-okunur production sayfası ve GET API için kabul edilen izinler. */
export const YILLIK_TAKVIM_VIEW_PERMISSIONS = [
  PERMISSION_KEYS.YILLIK_TAKVIM_VIEW,
  PERMISSION_KEYS.YILLIK_TAKVIM_ADMIN,
] as const

// Medeni durum allow-list: başvuru formu yalnız "Bekar" (SINGLE) ve "Evli" (MARRIED)
// sunuyor. Alan nullable/opsiyonel olduğundan, listede olmayan/boş değerler sessizce
// null'a düşürülür (400 verilmez).
export const ALLOWED_MARITAL_STATUS = ['SINGLE', 'MARRIED'] as const
export type MaritalStatusValue = (typeof ALLOWED_MARITAL_STATUS)[number]

export function normalizeMaritalStatus(value: unknown): MaritalStatusValue | null {
  return typeof value === 'string' && (ALLOWED_MARITAL_STATUS as readonly string[]).includes(value)
    ? (value as MaritalStatusValue)
    : null
}

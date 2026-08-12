export type MicrosoftErrorCategory = 'AUTH_PERMISSION' | 'REMOTE_MISSING' | 'RATE_LIMIT' | 'SERVER' | 'NETWORK' | 'REQUEST'
export interface MicrosoftErrorClassification { category: MicrosoftErrorCategory; retryable: boolean; retryAfterMs: number | null }
export const MICROSOFT_MAX_ATTEMPTS = 5
export const MICROSOFT_MAX_BACKOFF_MS = 5 * 60_000

export function parseRetryAfter(value: string | null | undefined, nowMs = Date.now()): number | null {
  if (!value) return null
  if (/^\d+$/.test(value.trim())) return Math.min(Number(value.trim()) * 1000, MICROSOFT_MAX_BACKOFF_MS)
  const time = Date.parse(value); return Number.isNaN(time) ? null : Math.min(Math.max(0, time - nowMs), MICROSOFT_MAX_BACKOFF_MS)
}
export function classifyMicrosoftError(input: { status?: number; retryAfter?: string | null; networkError?: boolean }, nowMs = Date.now()): MicrosoftErrorClassification {
  if (input.networkError || input.status === undefined) return { category: 'NETWORK', retryable: true, retryAfterMs: null }
  if (input.status === 401 || input.status === 403) return { category: 'AUTH_PERMISSION', retryable: false, retryAfterMs: null }
  if (input.status === 404) return { category: 'REMOTE_MISSING', retryable: false, retryAfterMs: null }
  if (input.status === 429) return { category: 'RATE_LIMIT', retryable: true, retryAfterMs: parseRetryAfter(input.retryAfter, nowMs) }
  if (input.status >= 500) return { category: 'SERVER', retryable: true, retryAfterMs: parseRetryAfter(input.retryAfter, nowMs) }
  return { category: 'REQUEST', retryable: false, retryAfterMs: null }
}
export function microsoftBackoffMs(attempt: number, retryAfterMs?: number | null): number | null {
  if (!Number.isInteger(attempt) || attempt < 1 || attempt >= MICROSOFT_MAX_ATTEMPTS) return null
  if (retryAfterMs !== undefined && retryAfterMs !== null) return Math.min(Math.max(0, retryAfterMs), MICROSOFT_MAX_BACKOFF_MS)
  return Math.min(1000 * 2 ** (attempt - 1), MICROSOFT_MAX_BACKOFF_MS)
}

/** Loglara taşınabilecek PII/secret içermeyen sınırlı bağlam. */
export function safeMicrosoftLogContext(operation: 'create' | 'update' | 'get' | 'cancel', classification?: MicrosoftErrorClassification) {
  return { operation, ...(classification && { category: classification.category, retryable: classification.retryable }) }
}

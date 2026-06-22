/**
 * FIX #28: API response utility
 * Standart response format ve error handling
 * Implementation detail sızıntısını önler
 */

import { NextResponse } from 'next/server'
import { logger } from './logger'

interface ApiErrorContext {
  endpoint: string
  error: unknown
  userId?: string
}

/**
 * API error response oluştur
 * Kullanıcıya generic mesaj döner, detayları loglar
 */
export function apiError(
  message: string,
  status: number = 500,
  logContext?: ApiErrorContext
): NextResponse {
  // Detaylı log (sunucu tarafında kalır)
  if (logContext) {
    logger.error('API', `${logContext.endpoint} failed`, {
      message: logContext.error instanceof Error
        ? logContext.error.message
        : 'Unknown error',
      userId: logContext.userId
    })
  }

  // Kullanıcıya generic mesaj
  return NextResponse.json({ error: message }, { status })
}

/**
 * API success response oluştur
 */
export function apiSuccess<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, { status })
}

/**
 * API created response (201)
 */
export function apiCreated<T>(data: T): NextResponse {
  return NextResponse.json(data, { status: 201 })
}

/**
 * API no content response (204)
 */
export function apiNoContent(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

/**
 * Standart error mesajları
 */
export const API_ERRORS = {
  UNAUTHORIZED: 'Yetkisiz erişim',
  FORBIDDEN: 'Bu işlem için yetkiniz yok',
  NOT_FOUND: 'Kayıt bulunamadı',
  BAD_REQUEST: 'Geçersiz istek',
  INTERNAL_ERROR: 'Bir hata oluştu',
  VALIDATION_ERROR: 'Doğrulama hatası',
} as const

/**
 * Hızlı error response'lar
 */
export const apiUnauthorized = () => apiError(API_ERRORS.UNAUTHORIZED, 401)
export const apiForbidden = () => apiError(API_ERRORS.FORBIDDEN, 403)
export const apiNotFound = (message?: string) => apiError(message || API_ERRORS.NOT_FOUND, 404)
export const apiBadRequest = (message?: string) => apiError(message || API_ERRORS.BAD_REQUEST, 400)

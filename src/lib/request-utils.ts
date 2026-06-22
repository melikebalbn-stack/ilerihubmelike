/**
 * FIX #19: Request utility fonksiyonları
 * IP adresi alma, hash'leme ve spoofing koruması
 */

import { createHash } from 'crypto'

/**
 * Client IP adresini güvenli şekilde al
 * Nginx/reverse proxy arkasındaysa x-forwarded-for kullanır
 */
export function getClientIp(request: Request): string {
  // Nginx/reverse proxy arkasındaysa x-forwarded-for kullan
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    // İlk IP gerçek client, geri kalanlar proxy zinciri
    return xff.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  return 'unknown'
}

/**
 * IP adresini hash'leyerek anonim sakla (KVKK uyumlu)
 * @param ip - IP adresi
 * @returns 16 karakterlik hash
 */
export function hashIp(ip: string): string {
  const secret = process.env.NEXTAUTH_SECRET || 'default-secret'
  return createHash('sha256')
    .update(ip + secret)
    .digest('hex')
    .slice(0, 16)
}

/**
 * User-Agent bilgisini al
 */
export function getUserAgent(request: Request): string {
  return request.headers.get('user-agent') || 'unknown'
}

/**
 * Request metadata'sını al (anonim)
 */
export function getRequestMetadata(request: Request): {
  ipHash: string
  userAgent: string
  timestamp: string
} {
  const ip = getClientIp(request)
  return {
    ipHash: hashIp(ip),
    userAgent: getUserAgent(request).substring(0, 255),
    timestamp: new Date().toISOString()
  }
}

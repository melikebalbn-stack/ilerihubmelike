/**
 * ACME Cert Expire Monitor (PR-ACME-MONITOR)
 *
 * TLS handshake ile uzak sunucudaki sertifika notAfter'ını okur,
 * threshold'ları geçmiş cert'ler için alert tetikler.
 *
 * Pure Node — tls.connect() + getPeerCertificate() (openssl child_process YOK).
 *
 * Threshold dedup AcmeAlertLog tablosunda (cycleId yerine certExpiryDate ile):
 * Cert renewed → yeni notAfter → yeni log entry'ler (eski log'lar kalır,
 * audit history). Aynı (domain, threshold, certExpiryDate) kombinasyonu
 * için maks 1 alert.
 */

import * as tls from 'node:tls'

export type CertInfo = {
  domain: string
  validFrom: Date
  validTo: Date
  daysRemaining: number
  issuer: string
  subject: string
}

export type AcmeMonitorError = {
  domain: string
  error: string
}

/**
 * TLS bağlantısı kurar, peer cert'ten notAfter okur.
 * Default port 443.
 */
export async function readCertExpiry(
  domain: string,
  port = 443,
  timeoutMs = 5000,
): Promise<CertInfo> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host: domain,
        port,
        servername: domain, // SNI
        rejectUnauthorized: false, // Expire olmuş cert'i bile okuyabilelim
      },
      () => {
        try {
          const peerCert = socket.getPeerCertificate(false)
          socket.end()

          if (!peerCert || !peerCert.valid_from || !peerCert.valid_to) {
            return reject(new Error(`${domain}: peer cert bilgisi alınamadı`))
          }

          const validFrom = new Date(peerCert.valid_from)
          const validTo = new Date(peerCert.valid_to)
          const now = new Date()
          const daysRemaining = Math.floor(
            (validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          )

          const subject =
            peerCert.subject && typeof peerCert.subject === 'object'
              ? peerCert.subject.CN ?? JSON.stringify(peerCert.subject)
              : 'unknown'

          const issuer =
            peerCert.issuer && typeof peerCert.issuer === 'object'
              ? (peerCert.issuer.O ?? peerCert.issuer.CN ?? JSON.stringify(peerCert.issuer))
              : 'unknown'

          resolve({
            domain,
            validFrom,
            validTo,
            daysRemaining,
            issuer,
            subject,
          })
        } catch (err) {
          reject(err)
        }
      },
    )

    socket.setTimeout(timeoutMs, () => {
      socket.destroy()
      reject(new Error(`${domain}: TLS handshake timeout (${timeoutMs}ms)`))
    })

    socket.on('error', (err) => {
      reject(new Error(`${domain}: ${err.message}`))
    })
  })
}

/**
 * Threshold listesini env'den parse eder.
 * Default: [30, 14, 7, 1]
 */
export function parseThresholds(raw: string | undefined): number[] {
  if (!raw) return [30, 14, 7, 1]
  const list = raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0)
  return list.length > 0 ? list.sort((a, b) => b - a) : [30, 14, 7, 1]
}

/**
 * Hangi threshold'u geçtik?
 * daysRemaining=10 ve thresholds=[30,14,7,1] → 14 (en yakın aşılan)
 * daysRemaining=35 → null (henüz hiçbir threshold tetiklenmedi)
 * daysRemaining=-2 → 1 (expired, en kritik threshold)
 */
export function pickTriggeredThreshold(
  daysRemaining: number,
  thresholds: number[],
): number | null {
  const sorted = [...thresholds].sort((a, b) => b - a) // descending
  for (const t of sorted) {
    if (daysRemaining <= t) return t
  }
  return null
}

/**
 * Email recipient listesi env'den parse.
 */
export function parseEmailRecipients(
  raw: string | undefined,
): Array<{ email: string; name: string }> {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.includes('@'))
    .map((email) => ({ email, name: email.split('@')[0] }))
}

/**
 * Monitor edilecek domain listesi.
 */
export function parseMonitorDomains(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * Severity label — UI ve email subject için.
 */
export function severityLabel(daysRemaining: number): {
  level: 'expired' | 'critical' | 'warning' | 'info' | 'ok'
  label: string
} {
  if (daysRemaining < 0) return { level: 'expired', label: 'SÜRESİ DOLDU' }
  if (daysRemaining <= 1) return { level: 'critical', label: 'KRİTİK' }
  if (daysRemaining <= 7) return { level: 'warning', label: 'UYARI' }
  if (daysRemaining <= 30) return { level: 'info', label: 'BİLGİ' }
  return { level: 'ok', label: 'NORMAL' }
}

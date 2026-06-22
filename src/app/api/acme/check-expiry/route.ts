import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/require-permission'
import { sendAcmeAlert } from '@/lib/email'
import {
  readCertExpiry,
  parseThresholds,
  pickTriggeredThreshold,
  parseEmailRecipients,
  parseMonitorDomains,
  severityLabel,
  type CertInfo,
} from '@/lib/acme-monitor'

export const dynamic = 'force-dynamic'

/**
 * GET /api/acme/check-expiry
 *
 * Cert durumu okur, alert gönderme. Dashboard widget bunu çağırır.
 * Auth: admin.system.manage (super-admin + admin + it-admin)
 *
 * Response: { results: [{ domain, daysRemaining, validTo, issuer, severity, lastAlert?: {...} }], errors: [...] }
 */
export async function GET() {
  const { error } = await requirePermission('admin.system.manage')
  if (error) return error

  const domains = parseMonitorDomains(process.env.ACME_MONITOR_DOMAINS)
  if (domains.length === 0) {
    return NextResponse.json({
      results: [],
      errors: [{ domain: '*', error: 'ACME_MONITOR_DOMAINS env tanımlı değil' }],
    })
  }

  const results = await Promise.all(
    domains.map(async (domain) => {
      try {
        const cert = await readCertExpiry(domain)
        // Son alert (en yeni)
        const lastAlert = await prisma.acmeAlertLog.findFirst({
          where: { domain, certExpiryDate: cert.validTo },
          orderBy: { sentAt: 'desc' },
          select: { threshold: true, daysRemaining: true, sentAt: true, status: true },
        })
        const sev = severityLabel(cert.daysRemaining)
        return {
          domain,
          daysRemaining: cert.daysRemaining,
          validFrom: cert.validFrom.toISOString(),
          validTo: cert.validTo.toISOString(),
          issuer: cert.issuer,
          subject: cert.subject,
          severity: sev.level,
          severityLabel: sev.label,
          lastAlert,
          error: null as string | null,
        }
      } catch (err) {
        return {
          domain,
          daysRemaining: null,
          validFrom: null,
          validTo: null,
          issuer: null,
          subject: null,
          severity: 'expired' as const,
          severityLabel: 'HATA',
          lastAlert: null,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    }),
  )

  return NextResponse.json({
    results,
    thresholds: parseThresholds(process.env.ACME_ALERT_THRESHOLDS),
    checkedAt: new Date().toISOString(),
  })
}

/**
 * POST /api/acme/check-expiry
 *
 * Cron endpoint — cert oku, threshold geçilmişse alert gönder + log.
 * Auth:
 *   - Sistem cron: x-cron-secret header
 *   - Manuel test: admin.system.manage permission
 */
async function checkAuth(request: NextRequest): Promise<NextResponse | null> {
  const cronSecret = request.headers.get('x-cron-secret')
  const isCron = !!cronSecret && cronSecret === process.env.CRON_SECRET
  if (isCron) return null

  const { error } = await requirePermission('admin.system.manage')
  if (error) return error
  return null
}

export async function POST(request: NextRequest) {
  const authError = await checkAuth(request)
  if (authError) return authError

  const domains = parseMonitorDomains(process.env.ACME_MONITOR_DOMAINS)
  const thresholds = parseThresholds(process.env.ACME_ALERT_THRESHOLDS)
  const recipients = parseEmailRecipients(process.env.ACME_ALERT_EMAILS)

  if (domains.length === 0) {
    return NextResponse.json(
      { success: false, error: 'ACME_MONITOR_DOMAINS env tanımlı değil' },
      { status: 400 },
    )
  }
  if (recipients.length === 0) {
    return NextResponse.json(
      { success: false, error: 'ACME_ALERT_EMAILS env tanımlı değil' },
      { status: 400 },
    )
  }

  const checked: Array<{
    domain: string
    daysRemaining: number | null
    threshold: number | null
    alerted: boolean
    skipped: boolean
    skipReason?: string
    error?: string
  }> = []

  for (const domain of domains) {
    let cert: CertInfo
    try {
      cert = await readCertExpiry(domain)
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      checked.push({
        domain,
        daysRemaining: null,
        threshold: null,
        alerted: false,
        skipped: false,
        error,
      })
      continue
    }

    const triggered = pickTriggeredThreshold(cert.daysRemaining, thresholds)
    if (triggered === null) {
      checked.push({
        domain,
        daysRemaining: cert.daysRemaining,
        threshold: null,
        alerted: false,
        skipped: true,
        skipReason: `Hiçbir eşik geçilmedi (kalan: ${cert.daysRemaining} gün)`,
      })
      continue
    }

    // İdempotency: aynı (domain, threshold, certExpiryDate) için zaten alert gönderildi mi?
    const existing = await prisma.acmeAlertLog.findFirst({
      where: {
        domain,
        threshold: triggered,
        certExpiryDate: cert.validTo,
      },
      select: { id: true, status: true },
    })

    if (existing && existing.status === 'sent') {
      checked.push({
        domain,
        daysRemaining: cert.daysRemaining,
        threshold: triggered,
        alerted: false,
        skipped: true,
        skipReason: `Bu eşik (${triggered}g) için zaten alert gönderildi`,
      })
      continue
    }

    // Send alert
    const emailRes = await sendAcmeAlert(
      {
        domain,
        daysRemaining: cert.daysRemaining,
        threshold: triggered,
        validTo: cert.validTo,
        issuer: cert.issuer,
      },
      recipients,
    )

    const status = emailRes.success ? 'sent' : 'failed'
    const errorMsg = emailRes.success ? null : emailRes.error ?? 'Email failed'

    // Upsert log (existing.status='failed' ise retry'da update)
    if (existing) {
      await prisma.acmeAlertLog.update({
        where: { id: existing.id },
        data: {
          daysRemaining: cert.daysRemaining,
          recipientEmails: recipients.map((r) => r.email).join(','),
          sentAt: new Date(),
          status,
          error: errorMsg,
        },
      })
    } else {
      await prisma.acmeAlertLog.create({
        data: {
          domain,
          threshold: triggered,
          daysRemaining: cert.daysRemaining,
          certExpiryDate: cert.validTo,
          recipientEmails: recipients.map((r) => r.email).join(','),
          status,
          error: errorMsg,
        },
      })
    }

    checked.push({
      domain,
      daysRemaining: cert.daysRemaining,
      threshold: triggered,
      alerted: emailRes.success,
      skipped: false,
      error: errorMsg ?? undefined,
    })
  }

  return NextResponse.json({
    success: true,
    checked,
    completedAt: new Date().toISOString(),
  })
}

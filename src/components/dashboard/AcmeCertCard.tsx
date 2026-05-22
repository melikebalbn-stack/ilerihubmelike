'use client'

/**
 * AcmeCertCard — ACME cert expire monitor widget (PR-ACME-MONITOR)
 *
 * Sadece admin.system.manage permission'a sahip kullanıcılar için render edilir.
 * Parent (dashboard) bu permission check'ini yapar; widget kendisi sadece data fetch eder.
 *
 * Renk kuralı:
 *   >30g  → yeşil (ok)
 *   30-7g → amber (info/warning)
 *   <7g   → kırmızı (warning/critical)
 *   <0g   → siyah (expired)
 */

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck, AlertCircle, Loader2 } from 'lucide-react'

interface CertResult {
  domain: string
  daysRemaining: number | null
  validFrom: string | null
  validTo: string | null
  issuer: string | null
  subject: string | null
  severity: 'expired' | 'critical' | 'warning' | 'info' | 'ok'
  severityLabel: string
  lastAlert: {
    threshold: number
    daysRemaining: number
    sentAt: string
    status: string
  } | null
  error: string | null
}

interface ApiResponse {
  results: CertResult[]
  thresholds: number[]
  checkedAt: string
}

function severityColor(severity: CertResult['severity']): { bg: string; text: string; border: string } {
  switch (severity) {
    case 'ok':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' }
    case 'info':
      return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' }
    case 'warning':
      return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' }
    case 'critical':
      return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-400' }
    case 'expired':
      return { bg: 'bg-gray-900', text: 'text-white', border: 'border-gray-900' }
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Istanbul',
    })
  } catch {
    return iso
  }
}

export function AcmeCertCard() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/acme/check-expiry')
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            // Permission yok — widget'ı sessizce gizle
            if (!cancelled) setError('forbidden')
            return
          }
          throw new Error(`HTTP ${res.status}`)
        }
        const json = (await res.json()) as ApiResponse
        if (!cancelled) {
          setData(json)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    // Her 15dk yenile (cert durumu nadir değişir)
    const id = window.setInterval(load, 15 * 60 * 1000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  // Permission yoksa hiç render etme
  if (error === 'forbidden') return null

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            TLS Sertifika Durumu
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Yükleniyor...
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card className="border-red-300">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-700">
            <AlertCircle className="h-4 w-4" />
            TLS Sertifika Durumu — Hata
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-red-600">{error ?? 'Veri alınamadı'}</CardContent>
      </Card>
    )
  }

  const hasCritical = data.results.some((r) => r.severity === 'expired' || r.severity === 'critical')
  const hasWarning = data.results.some((r) => r.severity === 'warning')

  const cardBorder = hasCritical
    ? 'border-red-400'
    : hasWarning
      ? 'border-amber-300'
      : 'border-emerald-200'

  return (
    <Card className={cardBorder}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            TLS Sertifika Durumu
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {data.results.length} domain · eşikler {data.thresholds.join(',')}g
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.results.map((r) => {
          const c = severityColor(r.severity)
          return (
            <div
              key={r.domain}
              className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${c.bg} ${c.border}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-xs font-semibold truncate ${c.text}`}>
                    {r.domain}
                  </span>
                  <Badge
                    variant="outline"
                    className={`${c.text} ${c.border} bg-transparent text-[10px] h-5 px-1.5`}
                  >
                    {r.severityLabel}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {r.error
                    ? r.error
                    : `${r.issuer ?? '—'} · bitiş ${formatDate(r.validTo)}`}
                </div>
              </div>
              <div className={`text-right tabular-nums ${c.text}`}>
                <div className="text-lg font-bold leading-none">
                  {r.daysRemaining === null
                    ? '—'
                    : r.daysRemaining < 0
                      ? `−${Math.abs(r.daysRemaining)}`
                      : r.daysRemaining}
                </div>
                <div className="text-[10px] uppercase tracking-wide opacity-70">
                  {r.daysRemaining === null ? 'hata' : r.daysRemaining < 0 ? 'gün geçti' : 'gün'}
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

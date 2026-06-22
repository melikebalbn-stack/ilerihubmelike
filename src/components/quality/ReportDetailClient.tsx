'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
  Mail,
  Save,
  Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { computeReportResult } from '@/lib/quality/quality-result'
import { type ReportResult } from './ReportResultBadge'
import { MeasurementGrid, type CharRow } from './MeasurementGrid'
import { FormTopBar } from './FormTopBar'
import { CardNumbered } from './CardNumbered'
import { SamplingRuleStrip } from './SamplingRuleStrip'
import { EscalationCallout } from './EscalationCallout'
import { DecisionToggle, type Decision } from './DecisionToggle'
import { StatGroup, type StatEntry } from './StatGroup'
import { StickyFormFooter } from './StickyFormFooter'

export interface ReportSummary {
  id: string
  reportNo: string
  formNo: string
  partName: string
  drawingNo: string
  revision: string
  templateDepartment: string | null
  lotNo: string | null
  operatorNo: string | null
  orderQty: number | null
  machine: string | null
  gaugeNo: string | null
  escalationContact: string | null
  measurementDate: string // ISO
  notes: string | null
  controllerOpNo: string | null
  qrKey: string
  result: ReportResult
  finalizedAt: string | null // ISO
}

interface Props {
  report: ReportSummary
  initialCharacteristics: ReadonlyArray<CharRow>
  /** quality.report.fill permission var mı (page server'da check edilip pass edilir) */
  canFinalize?: boolean
  /** QR + verify URL — yalnızca finalize sonrası dolu, page server'da üretilir */
  verifyUrl?: string | null
  qrDataUrl?: string | null
}

const RESULT_TO_DECISION: Record<ReportResult, Decision> = {
  PENDING: null,
  OK: 'ok',
  RED: 'red',
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
  })
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('tr-TR', {
    timeZone: 'Europe/Istanbul',
  })
}

export function ReportDetailClient({
  report,
  initialCharacteristics,
  canFinalize = false,
  verifyUrl = null,
  qrDataUrl = null,
}: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<CharRow[]>(() => [...initialCharacteristics])
  const [finalizedAt, setFinalizedAt] = useState<string | null>(report.finalizedAt)
  const [serverResult, setServerResult] = useState<ReportResult>(report.result)
  const [finalizing, setFinalizing] = useState(false)

  const isLocked = finalizedAt !== null

  const aggregatedResult: ReportResult = computeReportResult(
    rows.map((r) => r.result),
  )

  // Finalize edilmişse server-side persist edilmiş result kanonik.
  // Aksi halde client aggregator (canlı).
  const displayResult: ReportResult = isLocked ? serverResult : aggregatedResult

  const handleCharsChange = useCallback((next: CharRow[]) => {
    setRows(next)
  }, [])

  const counts = useMemo(() => {
    let ok = 0
    let red = 0
    let pending = 0
    rows.forEach((r) => {
      if (r.result === 'OK') ok++
      else if (r.result === 'RED') red++
      else pending++
    })
    return { total: rows.length, ok, red, pending }
  }, [rows])

  const allFilled = rows.every((r) => {
    if (!r.hasNumericRange) return true
    return r.measurements.every((m) => m !== null && m !== '')
  })

  const hasPending = counts.pending > 0

  // Auto-suggest hint (Card 3 başlık altı — mockup'taki #auto-suggest-hint)
  const autoSuggest: React.ReactNode = (() => {
    if (counts.total === 0) return null
    if (counts.pending === counts.total) return null
    if (counts.red > 0) {
      return (
        <span>
          <span className="text-red-700 font-semibold">RED önerilir</span>
          {` · ${counts.red} karakter tolerans dışı`}
        </span>
      )
    }
    if (counts.pending === 0) {
      return (
        <span>
          <span className="text-emerald-700 font-semibold">OK önerilir</span>
          {` · tüm karakterler aralıkta`}
        </span>
      )
    }
    return <span>{counts.pending} karakter bekliyor</span>
  })()

  // Footer status (auto-save göstergesi)
  const footerStatus: React.ReactNode = isLocked
    ? `Rapor finalize edildi — ${fmtDateTime(finalizedAt)}`
    : 'Otomatik kayıt aktif · değişiklikler hücre başına 600 ms gecikme ile kaydedilir'

  const statEntries: StatEntry[] = [
    { label: 'Karakter', value: counts.total, tone: 'neutral' },
    { label: 'OK', value: counts.ok, tone: 'ok' },
    { label: 'RED', value: counts.red, tone: 'red' },
    { label: 'Bekleyen', value: counts.pending, tone: 'pending' },
  ]

  async function handleFinalize() {
    setFinalizing(true)
    try {
      const res = await fetch(`/api/quality/reports/${report.id}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Finalize başarısız')

      const finalized = json.report
      if (finalized) {
        setServerResult(finalized.result as ReportResult)
        setFinalizedAt(finalized.finalizedAt)
      }
      toast.success('Rapor finalize edildi')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Finalize başarısız')
    } finally {
      setFinalizing(false)
    }
  }

  // Footer actions
  const footerActions = (
    <>
      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={() => toast.info('Otomatik kayıt aktif — manuel kaydetmeye gerek yok.')}
        className="h-9"
      >
        <Save className="h-3.5 w-3.5 mr-1.5" /> Taslak Sakla
      </Button>
      <Button
        asChild={isLocked}
        variant="outline"
        size="sm"
        disabled={!isLocked}
        type="button"
        title={!isLocked ? 'PDF yalnızca finalize edilmiş raporlar için üretilir' : undefined}
        className="h-9"
      >
        {isLocked ? (
          <a
            href={`/api/quality/reports/${report.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" /> PDF Önizle
          </a>
        ) : (
          <span>
            <Download className="h-3.5 w-3.5 mr-1.5" /> PDF Önizle
          </span>
        )}
      </Button>
      {canFinalize && !isLocked ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              disabled={finalizing}
              className="bg-[#1B4F72] hover:bg-[#1B4F72]/90 h-9"
              size="sm"
            >
              {finalizing ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Kayıt &amp; Onaya Gönder
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Raporu finalize et?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <p>
                    Finalize sonrası ölçüm hücreleri ve metadata{' '}
                    <strong>değiştirilemez</strong>. Rapor sonucu kanonik olarak
                    DB&apos;ye yazılır.
                  </p>
                  {!allFilled && (
                    <p className="text-amber-700">
                      ⚠ Bazı satırlarda tüm 10 ölçüm dolu değil — finalize sonrası
                      boş kalan slotlar düzeltilemez.
                    </p>
                  )}
                  {hasPending && (
                    <p className="text-amber-700">
                      ⚠ Bazı karakterler{' '}
                      <span className="font-semibold">Bekliyor</span> durumunda
                      — rapor sonucu <strong>Bekliyor</strong> olarak finalize
                      edilebilir.
                    </p>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>İptal</AlertDialogCancel>
              <AlertDialogAction onClick={handleFinalize}>
                Evet, finalize et
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Button
          disabled
          size="sm"
          className="bg-[#1B4F72]/60 cursor-not-allowed h-9"
          title={
            !canFinalize
              ? 'Yetki yok (quality.report.fill)'
              : 'Rapor zaten finalize edildi'
          }
        >
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Kayıt &amp; Onaya Gönder
        </Button>
      )}
    </>
  )

  return (
    <div className="min-h-screen bg-slate-100 pb-20">
      <FormTopBar
        formNo={report.formNo}
        title="Ölçüm Kontrol Raporu"
        subtitle="Measurement Control Report"
        meta={[
          { label: 'Rapor No', value: report.reportNo },
          { label: 'Revizyon', value: report.revision },
          { label: 'Ölçüm Tarihi', value: fmtDate(report.measurementDate) },
        ]}
        actions={
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-white/90 hover:bg-white/10 hover:text-white border border-white/25"
          >
            <Link href="/kalite/raporlar">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Geçmiş Ölçümler
            </Link>
          </Button>
        }
      />

      <div className="mx-auto max-w-[1500px] px-6 pt-7 flex flex-col gap-4">
        {/* ═══ Card 1 — Parça Kimliği ═══ */}
        <CardNumbered
          number={1}
          title="Parça Kimliği"
          hint="Lot başında bir kez doldurulur"
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-4">
            <MetaField label="Parça Adı" value={report.partName} />
            <MetaField label="Resim No" value={report.drawingNo} mono />
            <MetaField label="Bölüm" value={report.templateDepartment ?? '—'} />
            <MetaField label="Revizyon" value={report.revision} mono />
            <MetaField label="Operatör No" value={report.operatorNo ?? '—'} mono />
            <MetaField
              label="İş Emri / Lot No"
              value={report.lotNo ?? '—'}
              mono
            />
            <MetaField
              label="İş Emri Miktarı"
              value={report.orderQty != null ? String(report.orderQty) : '—'}
              mono
            />
            <MetaField label="Makina / Ekipman" value={report.machine ?? '—'} />
            <MetaField label="Mastar Numarası" value={report.gaugeNo ?? '—'} mono />
            <MetaField
              label="Hata / Ret Durumunda Bildirilecek Kişi"
              value={report.escalationContact ?? '—'}
              spanCols
            />
          </div>

          <div className="mt-4">
            <EscalationCallout>
              {report.escalationContact ? (
                <>
                  Hata / ret durumunda eskalasyon prosedürü uygulanacaktır.
                  Bildirilecek kişi:{' '}
                  <strong className="font-bold">{report.escalationContact}</strong>
                </>
              ) : (
                'Hata / ret durumunda eskalasyon prosedürü uygulanacaktır.'
              )}
            </EscalationCallout>
          </div>
        </CardNumbered>

        {/* ═══ Card 2 — Ölçüm Karakteri ve Numune Sonuçları ═══ */}
        <CardNumbered
          number={2}
          title="Ölçüm Karakteri ve Numune Sonuçları"
          hint={
            <span>
              Sol kutu kritik (<span className="text-amber-700 font-bold">*</span>) işareti ·
              karakter şablon snapshot&apos;ından gelir
            </span>
          }
          bodyClassName="p-0"
        >
          <MeasurementGrid
            reportId={report.id}
            initialCharacteristics={rows}
            locked={isLocked}
            onCharsChange={handleCharsChange}
          />
          <SamplingRuleStrip>
            Numune Adet: 0–500 → N = %2 · 500+ → N = 10 · Hata tespit → N × 2 ·
            Seri başı
          </SamplingRuleStrip>
        </CardNumbered>

        {/* ═══ Card 3 — Genel Kontrol Sonucu ═══ */}
        <CardNumbered
          number={3}
          title="Genel Kontrol Sonucu"
          hint={autoSuggest}
          bodyClassName="p-0"
        >
          <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr]">
            <div className="p-6 border-b md:border-b-0 md:border-r border-slate-200">
              <div className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-[0.06em] mb-3.5">
                Karar
              </div>
              <DecisionToggle
                value={RESULT_TO_DECISION[displayResult]}
                onChange={() => {
                  /* reflect-only — manuel override ayrı PR */
                }}
                disabled
              />
              <div className="mt-4">
                <StatGroup stats={statEntries} />
              </div>
              {!isLocked && (
                <p className="mt-3 text-[11px] text-slate-500 leading-snug">
                  Sonuç otomatik olarak ölçüm hücrelerinden hesaplanır.
                  Finalize edildiğinde DB&apos;ye kalıcı yazılır.
                </p>
              )}
            </div>

            <div className="p-6">
              <div className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-[0.06em] mb-3.5">
                Açıklama
              </div>
              <Textarea
                value={report.notes ?? ''}
                readOnly
                placeholder="Sapma, RED gerekçesi, ek not..."
                className="min-h-[100px] text-[13px] font-quality"
              />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <MetaField
                  label="Kontrol Eden Op. No"
                  value={report.controllerOpNo ?? '—'}
                  mono
                  compact
                />
                <MetaField
                  label="İmza Tarihi"
                  value={fmtDate(finalizedAt)}
                  mono
                  compact
                />
              </div>
            </div>
          </div>
        </CardNumbered>

        {/* ═══ Belge & Doğrulama (finalize sonrası, KALITE-5 c2) ═══ */}
        {isLocked && verifyUrl && (
          <CardNumbered number={4} title="Belge & Doğrulama">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              {qrDataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={qrDataUrl}
                  alt="Rapor doğrulama QR kodu"
                  className="h-32 w-32 rounded border border-slate-200 bg-white p-1"
                />
              ) : (
                <div className="h-32 w-32 rounded border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-xs text-slate-400">
                  QR oluşturulamadı
                </div>
              )}
              <div className="flex-1 space-y-3">
                <p className="text-sm text-slate-600">
                  Bu rapor finalize edilmiştir. PDF&apos;i indirip basabilir veya
                  QR kodu paylaşabilirsiniz. Doğrulama sayfası raporun
                  gerçekliğini ve sonucunu kamuya açık olarak gösterir.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild className="bg-[#1B4F72] hover:bg-[#1B4F72]/90">
                    <a
                      href={`/api/quality/reports/${report.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="h-4 w-4 mr-2" /> PDF İndir
                    </a>
                  </Button>
                  <Button asChild variant="outline">
                    <Link
                      href={`/kalite/verify/${report.qrKey}`}
                      target="_blank"
                      prefetch={false}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" /> Doğrulama Sayfası
                    </Link>
                  </Button>
                  <EmailSendButton reportId={report.id} reportNo={report.reportNo} />
                </div>
                <div className="text-xs text-slate-500 font-quality-mono break-all">
                  {verifyUrl}
                </div>
              </div>
            </div>
          </CardNumbered>
        )}
      </div>

      <StickyFormFooter
        status={footerStatus}
        statusTone={isLocked ? 'saved' : 'saving'}
        actions={footerActions}
      />
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// META FIELD — Card 1 meta-grid satırı
// ════════════════════════════════════════════════════════════

function MetaField({
  label,
  value,
  mono,
  spanCols,
  compact,
}: {
  label: string
  value: string
  mono?: boolean
  spanCols?: boolean
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1',
        spanCols && 'md:col-span-3 lg:col-span-3',
      )}
    >
      <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-[0.06em]">
        {label}
      </span>
      <div
        className={cn(
          'h-9 border border-slate-200 rounded-md bg-slate-50 px-2.5 flex items-center text-slate-700',
          mono ? 'font-quality-mono text-[12.5px]' : 'font-quality text-[13px]',
          compact && 'h-8',
        )}
      >
        {value || '—'}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// EMAIL SEND DIALOG — Card 4 buton + Dialog (KALITE-8 c3)
// ════════════════════════════════════════════════════════════

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function parseRecipients(raw: string): {
  valid: string[]
  invalid: string[]
} {
  const tokens = raw
    .split(/[,;\n]/)
    .map((t) => t.trim())
    .filter(Boolean)
  const valid: string[] = []
  const invalid: string[] = []
  for (const t of tokens) {
    if (EMAIL_REGEX.test(t)) valid.push(t)
    else invalid.push(t)
  }
  return { valid, invalid }
}

function EmailSendButton({
  reportId,
  reportNo,
}: {
  reportId: string
  reportNo: string
}) {
  const [open, setOpen] = useState(false)
  const [recipientsInput, setRecipientsInput] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)

  const { valid, invalid } = parseRecipients(recipientsInput)
  const canSend = valid.length > 0 && invalid.length === 0 && !sending

  async function handleSend() {
    if (valid.length === 0) {
      toast.error('En az 1 geçerli e-posta gerekli')
      return
    }
    if (valid.length > 20) {
      toast.error('En fazla 20 alıcı')
      return
    }
    setSending(true)
    try {
      const res = await fetch(`/api/quality/reports/${reportId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: valid,
          note: note.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Mail gönderilemedi')
      toast.success(`Mail gönderildi (${valid.length} alıcı)`)
      setOpen(false)
      setRecipientsInput('')
      setNote('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Mail gönderilemedi')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-[#1B4F72]/30 text-[#1B4F72] hover:bg-[#1B4F72]/[0.06]"
      >
        <Mail className="h-4 w-4 mr-2" /> Mail Gönder
      </Button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Raporu Mail ile Gönder</DialogTitle>
          <DialogDescription>
            {reportNo} numaralı rapor PDF eki ile aşağıdaki alıcılara
            gönderilecek.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email-recipients" className="text-xs font-semibold">
              Alıcı(lar) <span className="text-slate-400 font-normal">(virgül veya satırbaşı ile ayır)</span>
            </Label>
            <Textarea
              id="email-recipients"
              value={recipientsInput}
              onChange={(e) => setRecipientsInput(e.target.value)}
              placeholder="ornek@ilerigroup.com, baska@ilerigroup.com"
              rows={3}
              className="font-quality-mono text-[12.5px]"
              disabled={sending}
            />
            <div className="flex items-center gap-2 text-[11px]">
              {valid.length > 0 && (
                <span className="text-emerald-700">
                  {valid.length} geçerli
                </span>
              )}
              {invalid.length > 0 && (
                <span className="text-red-700">
                  {invalid.length} geçersiz: {invalid.slice(0, 2).join(', ')}
                  {invalid.length > 2 ? '...' : ''}
                </span>
              )}
              {recipientsInput.trim() === '' && (
                <span className="text-slate-400">En az 1 alıcı zorunlu</span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email-note" className="text-xs font-semibold">
              Not <span className="text-slate-400 font-normal">(opsiyonel, mail gövdesine eklenir)</span>
            </Label>
            <Textarea
              id="email-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Sapma açıklaması, ek bilgi..."
              rows={3}
              maxLength={2000}
              disabled={sending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={sending}
          >
            İptal
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="bg-[#1B4F72] hover:bg-[#1B4F72]/90"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Gönder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState } from 'react'
import { CheckCircle2, Clock, Eye, PenLine, Printer } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { ZimmetFormuPreviewStatus, ZimmetFormuSubmitStatus } from './useZimmetFormu'

interface Props {
  onSubmit: () => void
  submitStatus: ZimmetFormuSubmitStatus
  submitError: string | null
  onPreviewPdf: () => void
  previewStatus: ZimmetFormuPreviewStatus
  previewError: string | null
  teslimEdenImzalandi: boolean
  teslimEdenImzaTarihi: string
  teslimEdenAdi: string
  onImzala: () => void
  createdZimmetId: string | null
}

function DisabledActionCard({
  icon,
  label,
}: {
  icon: React.ReactNode
  label: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card
          className="opacity-50 cursor-not-allowed select-none"
          title="Melih Dilben onayı bekleniyor"
        >
          <CardContent className="pt-6 flex flex-col items-center gap-2 text-center">
            {icon}
            <span className="text-sm font-medium text-slate-500">{label}</span>
          </CardContent>
        </Card>
      </TooltipTrigger>
      <TooltipContent>Melih Dilben onayı bekleniyor</TooltipContent>
    </Tooltip>
  )
}

export function ZimmetFormuStep4({
  onSubmit,
  submitStatus,
  submitError,
  onPreviewPdf,
  previewStatus,
  previewError,
  teslimEdenImzalandi,
  teslimEdenImzaTarihi,
  teslimEdenAdi,
  onImzala,
  createdZimmetId,
}: Props) {
  const [dijitalStatus, setDijitalStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [dijitalHata, setDijitalHata] = useState<string | null>(null)
  const [islakStatus, setIslakStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [islakHata, setIslakHata] = useState<string | null>(null)

  async function indirlePdf(mod: 'dijital' | 'islak') {
    const setStatus = mod === 'dijital' ? setDijitalStatus : setIslakStatus
    const setHata = mod === 'dijital' ? setDijitalHata : setIslakHata
    setStatus('loading')
    setHata(null)
    try {
      const res = await fetch(
        `/api/zimmet-formu/${createdZimmetId}/pdf?mod=${mod}`,
      )
      if (res.status === 403) {
        throw new Error('Melih Dilben onayı bekleniyor, PDF henüz indirilemez')
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string })
        throw new Error(data.error || 'PDF indirilemedi')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `zimmet-${String(createdZimmetId).slice(0, 8)}-${mod}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setStatus('idle')
    } catch (err) {
      setStatus('error')
      setHata(err instanceof Error ? err.message : 'PDF indirilemedi')
    }
  }

  if (submitStatus === 'success') {
    return (
      <div className="space-y-5">
        <Card>
          <CardContent className="pt-6 flex flex-col items-center gap-2 text-center py-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            <p className="text-sm font-medium text-slate-900">Onaya gönderildi</p>
            <p className="text-sm text-slate-500">
              Zimmet tutanağınız kaydedildi ve Melih Dilben onayına iletildi.
            </p>
          </CardContent>
        </Card>

        <div>
          <Button
            type="button"
            variant="outline"
            onClick={onPreviewPdf}
            disabled={previewStatus === 'loading'}
            className="w-full border-[#1B4F72] text-[#1B4F72] hover:bg-[#1B4F72]/5"
          >
            <Eye className="w-4 h-4 mr-1.5" />
            {previewStatus === 'loading' ? 'Önizleme hazırlanıyor...' : "Taslak PDF'i Önizle"}
          </Button>
          {previewStatus === 'error' && (
            <p className="mt-1.5 text-sm text-rose-600">{previewError ?? 'Önizleme oluşturulamadı'}</p>
          )}
        </div>

        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            disabled={dijitalStatus === 'loading'}
            onClick={() => indirlePdf('dijital')}
            className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          >
            <PenLine className="w-4 h-4 mr-1.5" />
            {dijitalStatus === 'loading' ? 'İndiriliyor...' : 'Dijital imza ile indir'}
          </Button>
          {dijitalHata && <p className="text-sm text-rose-600">{dijitalHata}</p>}

          <Button
            type="button"
            variant="outline"
            disabled={islakStatus === 'loading'}
            onClick={() => indirlePdf('islak')}
            className="w-full"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            {islakStatus === 'loading' ? 'İndiriliyor...' : 'Islak imza için yazdır'}
          </Button>
          {islakHata && <p className="text-sm text-rose-600">{islakHata}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="pt-6 space-y-3">
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
            <Clock className="w-3.5 h-3.5 mr-1" />
            Onay bekleniyor
          </Badge>
          <p className="text-sm text-slate-600 leading-relaxed">
            Bu zimmet tutanağı Melih Dilben onayına gönderilecek. Onaylandıktan sonra çıktı
            alabilirsiniz.
          </p>
        </CardContent>
      </Card>

      <div>
        <Button
          type="button"
          variant="outline"
          onClick={onPreviewPdf}
          disabled={previewStatus === 'loading'}
          className="w-full border-[#1B4F72] text-[#1B4F72] hover:bg-[#1B4F72]/5"
        >
          <Eye className="w-4 h-4 mr-1.5" />
          {previewStatus === 'loading' ? 'Önizleme hazırlanıyor...' : 'Taslak PDF\'i Önizle'}
        </Button>
        <p className="mt-1.5 text-xs text-slate-400">
          Bu bir taslak önizlemedir, resmi çıktı için onay gereklidir.
        </p>
        {previewStatus === 'error' && (
          <p className="mt-1.5 text-sm text-rose-600">{previewError ?? 'Önizleme oluşturulamadı'}</p>
        )}
      </div>

      <TooltipProvider>
        <div className="grid grid-cols-2 gap-4">
          <DisabledActionCard icon={<PenLine className="w-6 h-6 text-slate-400" />} label="Dijital imza" />
          <DisabledActionCard icon={<Printer className="w-6 h-6 text-slate-400" />} label="Yazdır / Islak imza" />
        </div>
      </TooltipProvider>

      {submitStatus === 'error' && (
        <p className="text-sm text-rose-600">{submitError ?? 'Form kaydedilemedi'}</p>
      )}

      <Card>
        <CardContent className="pt-6 space-y-3">
          <p className="text-sm font-semibold text-slate-700">Zimmeti Veren İmzası</p>
          {teslimEdenImzalandi ? (
            <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              İmzalandı: {teslimEdenAdi} —{' '}
              {new Date(teslimEdenImzaTarihi).toLocaleString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Badge>
          ) : (
            <Button type="button" variant="outline" onClick={onImzala} className="border-slate-300">
              <PenLine className="w-4 h-4 mr-1.5" />
              İmzala
            </Button>
          )}
        </CardContent>
      </Card>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={!teslimEdenImzalandi ? 'cursor-not-allowed' : ''}>
              <Button
                type="button"
                onClick={onSubmit}
                disabled={submitStatus === 'submitting' || !teslimEdenImzalandi}
                className="w-full bg-[#1B4F72] hover:bg-[#1B4F72]/90"
              >
                {submitStatus === 'submitting' ? 'Gönderiliyor...' : 'Onayla gönder'}
              </Button>
            </span>
          </TooltipTrigger>
          {!teslimEdenImzalandi && (
            <TooltipContent>Önce imzalamanız gerekiyor</TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

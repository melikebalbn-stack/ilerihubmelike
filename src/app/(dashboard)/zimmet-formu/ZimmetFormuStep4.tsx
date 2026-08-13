'use client'

import { CheckCircle2, Clock, Eye, PenLine } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  zimmetZorunluAlanlarDolu,
  type ZimmetFormuPreviewStatus,
  type ZimmetFormuStep1Data,
  type ZimmetFormuSubmitStatus,
} from './useZimmetFormu'

interface Props {
  step1: ZimmetFormuStep1Data
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

export function ZimmetFormuStep4({
  step1,
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
  // Önizleme, henüz kaydedilmemiş taslak veriyle PDF üretiyor (bkz. previewPdf/
  // buildSubmitPayload) - zorunlu alanlar boşken tetiklenirse boş/anlamsız bir
  // PDF çıkar. Aynı kontrol imzalama butonuna da uygulanıyor - normalde Adım
  // 1→2 geçişi zaten bunu garanti eder, ama buraya bir şekilde eksik veriyle
  // ulaşılırsa (örn. geri gidip alanı boşaltıp tekrar ileri gitmeden Adım 4'e
  // dönmek gibi bir kenar durum) ikinci bir güvenlik katmanı olsun diye.
  const zorunluAlanlarDolu = zimmetZorunluAlanlarDolu(step1)
  const onizlemeDisabled = previewStatus === 'loading' || !zorunluAlanlarDolu

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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={!zorunluAlanlarDolu ? 'cursor-not-allowed' : ''}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onPreviewPdf}
                    disabled={onizlemeDisabled}
                    className="w-full border-[#1B4F72] text-[#1B4F72] hover:bg-[#1B4F72]/5"
                  >
                    <Eye className="w-4 h-4 mr-1.5" />
                    {previewStatus === 'loading' ? 'Önizleme hazırlanıyor...' : "Taslak PDF'i Önizle"}
                  </Button>
                </span>
              </TooltipTrigger>
              {!zorunluAlanlarDolu && (
                <TooltipContent>Önizlemek için önce zorunlu alanları doldurun.</TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          {previewStatus === 'error' && (
            <p className="mt-1.5 text-sm text-rose-600">{previewError ?? 'Önizleme oluşturulamadı'}</p>
          )}
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
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={!zorunluAlanlarDolu ? 'cursor-not-allowed' : ''}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onPreviewPdf}
                  disabled={onizlemeDisabled}
                  className="w-full border-[#1B4F72] text-[#1B4F72] hover:bg-[#1B4F72]/5"
                >
                  <Eye className="w-4 h-4 mr-1.5" />
                  {previewStatus === 'loading' ? 'Önizleme hazırlanıyor...' : 'Taslak PDF\'i Önizle'}
                </Button>
              </span>
            </TooltipTrigger>
            {!zorunluAlanlarDolu && (
              <TooltipContent>Önizlemek için önce zorunlu alanları doldurun.</TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <p className="mt-1.5 text-xs text-slate-400">
          Bu bir taslak önizlemedir, resmi çıktı için onay gereklidir.
        </p>
        {previewStatus === 'error' && (
          <p className="mt-1.5 text-sm text-rose-600">{previewError ?? 'Önizleme oluşturulamadı'}</p>
        )}
      </div>

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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={!zorunluAlanlarDolu ? 'cursor-not-allowed' : ''}>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onImzala}
                      disabled={!zorunluAlanlarDolu}
                      className="border-slate-300"
                    >
                      <PenLine className="w-4 h-4 mr-1.5" />
                      İmzala
                    </Button>
                  </span>
                </TooltipTrigger>
                {!zorunluAlanlarDolu && (
                  <TooltipContent>Önce zorunlu alanları doldurun.</TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
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

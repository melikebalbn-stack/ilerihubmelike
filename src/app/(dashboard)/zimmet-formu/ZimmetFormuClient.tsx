'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useZimmetFormu } from './useZimmetFormu'
import { ZimmetFormuStep1 } from './ZimmetFormuStep1'
import { ZimmetFormuStep2 } from './ZimmetFormuStep2'
import { ZimmetFormuStep3 } from './ZimmetFormuStep3'
import { ZimmetFormuStep4 } from './ZimmetFormuStep4'

interface Props {
  teslimEdenAdi: string
}

export function ZimmetFormuClient({ teslimEdenAdi }: Props) {
  const {
    step,
    totalSteps,
    stepTitle,
    step1,
    setStep1Field,
    selectZimmetSahibi,
    step2,
    setStep2Field,
    personelListesi,
    personelYukleniyor,
    goToStep,
    nextStep,
    prevStep,
    handleSubmit,
    submitStatus,
    submitError,
    previewPdf,
    previewStatus,
    previewError,
    imzala,
    teslimEdenImzalandi,
    teslimEdenImzaTarihi,
    createdZimmetId,
  } = useZimmetFormu()

  const progressPct = Math.round(((step + 1) / totalSteps) * 100)
  const isLastStep = step === totalSteps - 1

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-slate-500">
              Adım <span className="font-medium text-slate-900">{step + 1}</span>
              <span className="text-slate-400"> / {totalSteps}</span>
            </span>
            <span className="font-medium text-[#1B4F72]">{stepTitle}</span>
          </div>
          <Progress value={progressPct} className="h-1.5 [&>div]:bg-[#1B4F72]" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24">
        <div className="mb-6">
          <h1 className="text-2xl font-medium text-slate-900">Zimmet Formu</h1>
          <p className="mt-1 text-sm text-slate-500">{stepTitle}</p>
        </div>

        {step === 0 && (
          <ZimmetFormuStep1
            data={step1}
            setField={setStep1Field}
            onSelectZimmetSahibi={selectZimmetSahibi}
            teslimEdenAdi={teslimEdenAdi}
            personelListesi={personelListesi}
            personelYukleniyor={personelYukleniyor}
          />
        )}
        {step === 1 && <ZimmetFormuStep2 data={step2} setField={setStep2Field} />}
        {step === 2 && (
          <ZimmetFormuStep3
            step1={step1}
            step2={step2}
            teslimEdenAdi={teslimEdenAdi}
            onEditStep={goToStep}
            personelListesi={personelListesi}
            teslimEdenImzalandi={teslimEdenImzalandi}
          />
        )}
        {step === 3 && (
          <ZimmetFormuStep4
            onSubmit={handleSubmit}
            submitStatus={submitStatus}
            submitError={submitError}
            onPreviewPdf={previewPdf}
            previewStatus={previewStatus}
            previewError={previewError}
            teslimEdenImzalandi={teslimEdenImzalandi}
            teslimEdenImzaTarihi={teslimEdenImzaTarihi}
            teslimEdenAdi={teslimEdenAdi}
            onImzala={imzala}
            createdZimmetId={createdZimmetId}
          />
        )}

        <div className="mt-8 flex items-center justify-between">
          <Button type="button" variant="outline" onClick={prevStep} disabled={step === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            Geri
          </Button>
          <Button
            type="button"
            onClick={nextStep}
            disabled={isLastStep}
            className="bg-[#1B4F72] hover:bg-[#1B4F72]/90"
          >
            İleri
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}

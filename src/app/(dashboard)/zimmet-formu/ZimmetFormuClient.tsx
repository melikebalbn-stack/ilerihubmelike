'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useHasPermission } from '@/components/auth/can'
import { useZimmetFormu, zimmetEksikZorunluAlanlar, type ZimmetFormuStep1Data } from './useZimmetFormu'
import { ZimmetFormuStep1 } from './ZimmetFormuStep1'
import { ZimmetFormuStep2 } from './ZimmetFormuStep2'
import { ZimmetFormuStep3 } from './ZimmetFormuStep3'
import { ZimmetFormuStep4 } from './ZimmetFormuStep4'

// Adım 1'de "Geri"ye basınca çıkmadan önce veri kaybı uyarısı gösterilsin mi
// diye - kullanıcı herhangi bir ana alanı doldurduysa (tür seçmek dahil)
// "dolu" sayılır. Tüm ZimmetFormuStep1Data alanları string - INITIAL_STEP1
// hepsi boş string olduğu için "herhangi biri boş değilse doldurulmuş" testi
// hem basit hem eksiksiz (departman/unvan gibi zimmetSahibiId seçilince
// otomatik dolan alanlar da zaten zimmetSahibiId dolu olduğu için ayrıca
// kontrol gerektirmiyor).
function step1DoldurulduMu(step1: ZimmetFormuStep1Data): boolean {
  return Object.values(step1).some((deger) => deger.trim() !== '')
}

interface Props {
  teslimEdenAdi: string
}

export function ZimmetFormuClient({ teslimEdenAdi }: Props) {
  const router = useRouter()
  // Liste ekranı da zimmet-formu.view arkasında (bkz. liste/page.tsx) - o
  // yetkisi olmayan kullanıcı zaten oraya redirect'lenirdi, "Geri" ile
  // yönlendirmeden ÖNCE aynı kontrolü client'ta da yaparak gereksiz bir
  // redirect zincirinden kaçınıyoruz.
  const listeyeDonebilir = useHasPermission('zimmet-formu.view')
  const geriDonusHedefi = listeyeDonebilir ? '/zimmet-formu/liste' : '/dashboard'
  const [cikisOnayAcik, setCikisOnayAcik] = useState(false)

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

  // Adım 1 (Zimmet bilgileri) zorunlu alanları dolmadan Adım 2'ye geçilemez -
  // sunucu tarafı (route.ts, preview-pdf/route.ts) zaten aynı dört alanı
  // kontrol ediyor; bu adım-bazlı kontrol o kontrolün YERİNE değil, ÖNÜNE geçer
  // (kullanıcı boş formla ilerleyip Adım 4'te imzalayamasın diye).
  const step1EksikAlanlar = zimmetEksikZorunluAlanlar(step1)
  const step1IlerlemeEngelli = step === 0 && step1EksikAlanlar.length > 0
  const ileriDisabled = isLastStep || step1IlerlemeEngelli

  // Adım 1'de "Geri" artık disabled değil - formdan tamamen çıkıp listeye
  // (yetkisi yoksa dashboard'a) döner. Form doldurulmuşsa veri kaybı uyarısı
  // gösterilir, boşsa direkt çıkılır (gereksiz onay dialogu istenmiyordu).
  const formDoluMu = useMemo(() => step1DoldurulduMu(step1), [step1])

  function handleGeri() {
    if (step > 0) {
      prevStep()
      return
    }
    if (formDoluMu) {
      setCikisOnayAcik(true)
      return
    }
    router.push(geriDonusHedefi)
  }

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
            step1={step1}
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
          <Button type="button" variant="outline" onClick={handleGeri}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            Geri
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={step1IlerlemeEngelli ? 'cursor-not-allowed' : ''}>
                  <Button
                    type="button"
                    onClick={nextStep}
                    disabled={ileriDisabled}
                    className="bg-[#1B4F72] hover:bg-[#1B4F72]/90"
                  >
                    İleri
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </span>
              </TooltipTrigger>
              {step1IlerlemeEngelli && (
                <TooltipContent>Eksik: {step1EksikAlanlar.join(', ')}</TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <AlertDialog open={cikisOnayAcik} onOpenChange={setCikisOnayAcik}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Formdan çıkılsın mı?</AlertDialogTitle>
            <AlertDialogDescription>
              Girdiğiniz bilgiler kaybolacak, çıkmak istediğinize emin misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push(geriDonusHedefi)}>
              Çık
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

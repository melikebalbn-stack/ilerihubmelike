'use client'

import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  type PersonelHit,
  type ZimmetFormuStep1Data,
  type ZimmetFormuStep2Data,
} from './useZimmetFormu'

interface Props {
  step1: ZimmetFormuStep1Data
  step2: ZimmetFormuStep2Data
  teslimEdenAdi: string
  onEditStep: (step: number) => void
  personelListesi: PersonelHit[]
  teslimEdenImzalandi?: boolean
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value || '—'}</span>
    </div>
  )
}

export function ZimmetFormuStep3({ step1, step2, teslimEdenAdi, onEditStep, personelListesi, teslimEdenImzalandi = false }: Props) {
  const zimmetSahibi = personelListesi.find((p) => p.id === step1.zimmetSahibiId)
  const turGosterim = step1.tur === 'Diğer' ? step1.turDiger : step1.tur

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-center gap-x-8 gap-y-1">
          <p className="text-sm">
            <span className="text-slate-500">Teslim eden: </span>
            <span className="font-semibold text-[#1B4F72]">{teslimEdenAdi}</span>
          </p>
          <p className="text-sm">
            <span className="text-slate-500">Zimmet sahibi: </span>
            <span className="font-semibold text-[#1B4F72]">
              {zimmetSahibi?.name ?? '—'}
              {step1.unvan && ` — ${step1.unvan}`}
            </span>
          </p>
          <p className="text-sm">
            <span className="text-slate-500">İmza: </span>
            <span className={teslimEdenImzalandi ? 'font-semibold text-emerald-600' : 'font-semibold text-amber-600'}>
              {teslimEdenImzalandi ? '✓ İmzalandı' : 'Henüz imzalanmadı'}
            </span>
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base text-[#1B4F72]">Zimmet bilgileri</CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={() => onEditStep(0)}>
              <Pencil className="w-3.5 h-3.5 mr-1" />
              Düzenle
            </Button>
          </CardHeader>
          <CardContent className="pt-0 divide-y divide-slate-100">
            <SummaryRow label="Departman" value={step1.departman} />
            <SummaryRow label="Alt zimmet sahibi" value={step1.altZimmetSahibi} />
            <SummaryRow label="Tür" value={turGosterim} />
            {step1.marka && <SummaryRow label="Marka" value={step1.marka} />}
            {step1.model && <SummaryRow label="Model" value={step1.model} />}
            <SummaryRow label="Seri numarası" value={step1.seriNumarasi} />
            <SummaryRow label="Açıklama" value={step1.aciklama} />
            <SummaryRow label="Özellik" value={step1.ozellik} />
            {step1.ram && <SummaryRow label="RAM" value={step1.ram} />}
            {step1.ipAdresi && <SummaryRow label="IP adresi" value={step1.ipAdresi} />}
            {step1.parcaNo && <SummaryRow label="P/N" value={step1.parcaNo} />}
            {step1.lisansBaslangic && (
              <SummaryRow
                label="Lisans başlangıç"
                value={new Date(step1.lisansBaslangic).toLocaleDateString('tr-TR')}
              />
            )}
            {step1.lisansBitis && (
              <SummaryRow
                label="Lisans bitiş"
                value={new Date(step1.lisansBitis).toLocaleDateString('tr-TR')}
              />
            )}
            <SummaryRow label="MAC adresi" value={step1.macAdresi} />
            <SummaryRow label="PC adı" value={step1.pcAdi} />
            <SummaryRow label="IMEI numarası" value={step1.imeiNumarasi} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base text-[#1B4F72]">Teslim koşulları</CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={() => onEditStep(1)}>
              <Pencil className="w-3.5 h-3.5 mr-1" />
              Düzenle
            </Button>
          </CardHeader>
          <CardContent className="pt-0 divide-y divide-slate-100">
            <SummaryRow label="Veriliş tarihi" value={step2.verilisTarihi} />
            <SummaryRow label="Durum" value={step2.durum} />
            <SummaryRow label="Teslim notu" value={step2.teslimNotu} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

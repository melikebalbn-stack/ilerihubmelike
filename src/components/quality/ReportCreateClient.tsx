'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TemplateSelector, type TemplateChoice } from './TemplateSelector'

interface Props {
  templates: TemplateChoice[]
}

function localDatetimeNow(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ReportCreateClient({ templates }: Props) {
  const router = useRouter()
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [lotNo, setLotNo] = useState('')
  const [operatorNo, setOperatorNo] = useState('')
  const [orderQty, setOrderQty] = useState('')
  const [machine, setMachine] = useState('')
  const [gaugeNo, setGaugeNo] = useState('')
  const [escalationContact, setEscalationContact] = useState('')
  const [measurementDate, setMeasurementDate] = useState(localDatetimeNow())
  const [saving, setSaving] = useState(false)

  const selectedTemplate = templateId
    ? templates.find((t) => t.id === templateId) ?? null
    : null

  async function handleSubmit() {
    if (!templateId) {
      toast.error('Önce şablon seçilmeli')
      return
    }
    setSaving(true)
    try {
      const qtyNum = orderQty.trim() ? parseInt(orderQty, 10) : null
      if (orderQty.trim() && (!Number.isFinite(qtyNum) || (qtyNum as number) <= 0)) {
        toast.error('İş emri miktarı geçersiz')
        setSaving(false)
        return
      }

      const body = {
        templateId,
        lotNo: lotNo.trim() || null,
        operatorNo: operatorNo.trim() || null,
        orderQty: qtyNum,
        machine: machine.trim() || null,
        gaugeNo: gaugeNo.trim() || null,
        escalationContact: escalationContact.trim() || null,
        measurementDate: measurementDate
          ? new Date(measurementDate).toISOString()
          : null,
      }

      const res = await fetch('/api/quality/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Rapor oluşturulamadı')

      toast.success(`Rapor oluşturuldu: ${json.report?.reportNo ?? ''}`)
      const id = json.report?.id
      if (id) router.push(`/kalite/raporlar/${id}`)
      else router.push('/kalite/raporlar')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 pb-24">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 text-slate-500">
          <Link href="/kalite/raporlar">
            <ArrowLeft className="h-4 w-4 mr-1" /> Raporlar
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-[#1B4F72] mt-1">Yeni Ölçüm Raporu</h1>
        <p className="text-sm text-slate-500 mt-1">
          Şablon seç → metadata gir → ölçüm doldurma sayfasına geç
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">1. Şablon Seçimi</CardTitle>
        </CardHeader>
        <CardContent>
          <TemplateSelector
            templates={templates}
            value={templateId}
            onChange={setTemplateId}
          />
        </CardContent>
      </Card>

      {selectedTemplate && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>2. Rapor Bilgileri</span>
              <span className="text-xs font-normal text-slate-500">
                Seçilen şablon:{' '}
                <span className="font-mono">
                  {selectedTemplate.partName} ({selectedTemplate.drawingNo}-
                  {selectedTemplate.revision})
                </span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="lotNo">Lot No</Label>
                <Input
                  id="lotNo"
                  value={lotNo}
                  onChange={(e) => setLotNo(e.target.value)}
                  placeholder="LOT-001"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="operatorNo">Operatör No</Label>
                <Input
                  id="operatorNo"
                  value={operatorNo}
                  onChange={(e) => setOperatorNo(e.target.value)}
                  placeholder="423"
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label htmlFor="orderQty">İş Emri Miktarı</Label>
                <Input
                  id="orderQty"
                  value={orderQty}
                  onChange={(e) => setOrderQty(e.target.value)}
                  placeholder="100"
                  type="number"
                  min={1}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="machine">Makina / Ekipman</Label>
                <Input
                  id="machine"
                  value={machine}
                  onChange={(e) => setMachine(e.target.value)}
                  placeholder="MK-12"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="gaugeNo">Mastar Numarası</Label>
                <Input
                  id="gaugeNo"
                  value={gaugeNo}
                  onChange={(e) => setGaugeNo(e.target.value)}
                  placeholder="MS-001"
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label htmlFor="escalationContact">Eskalasyon İletişim</Label>
                <Input
                  id="escalationContact"
                  value={escalationContact}
                  onChange={(e) => setEscalationContact(e.target.value)}
                  placeholder="Vardiya amiri / dahili"
                  className="mt-1"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="measurementDate">Ölçüm Tarihi</Label>
                <Input
                  id="measurementDate"
                  type="datetime-local"
                  value={measurementDate}
                  onChange={(e) => setMeasurementDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="fixed bottom-0 inset-x-0 bg-white border-t shadow-lg z-20">
        <div className="container mx-auto px-6 py-3 flex items-center justify-end gap-3 max-w-7xl">
          <Button asChild variant="outline" disabled={saving}>
            <Link href="/kalite/raporlar">Vazgeç</Link>
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !templateId}
            className="bg-[#1B4F72] hover:bg-[#1B4F72]/90"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Raporu Oluştur
          </Button>
        </div>
      </div>
    </div>
  )
}

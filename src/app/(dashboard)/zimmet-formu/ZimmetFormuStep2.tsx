'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ZIMMET_DURUM_OPTIONS, type ZimmetFormuStep2Data } from './useZimmetFormu'

interface Props {
  data: ZimmetFormuStep2Data
  setField: <K extends keyof ZimmetFormuStep2Data>(field: K, value: ZimmetFormuStep2Data[K]) => void
}

function RequiredMark() {
  return <span className="text-rose-500">*</span>
}

function OptionalMark() {
  return <span className="text-xs text-slate-400">(opsiyonel)</span>
}

export function ZimmetFormuStep2({ data, setField }: Props) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="verilisTarihi">
            Zimmet veriliş tarihi <RequiredMark />
          </Label>
          <Input
            id="verilisTarihi"
            type="date"
            value={data.verilisTarihi}
            onChange={(e) => setField('verilisTarihi', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="durum">
            Zimmet durumu <RequiredMark />
          </Label>
          <Select value={data.durum} onValueChange={(v) => setField('durum', v as ZimmetFormuStep2Data['durum'])}>
            <SelectTrigger id="durum">
              <SelectValue placeholder="Durum seçin" />
            </SelectTrigger>
            <SelectContent>
              {ZIMMET_DURUM_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="teslimNotu">
            Teslim notu / şartlar <OptionalMark />
          </Label>
          <Textarea
            id="teslimNotu"
            value={data.teslimNotu}
            onChange={(e) => setField('teslimNotu', e.target.value)}
            rows={4}
          />
        </div>
      </CardContent>
    </Card>
  )
}

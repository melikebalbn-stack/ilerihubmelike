'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export interface TemplateMetaValue {
  formNo: string
  partName: string
  drawingNo: string
  revision: string
  department: string | null
  notes: string | null
}

interface MetaFormProps {
  value: TemplateMetaValue
  onChange: (next: TemplateMetaValue) => void
  errors?: Partial<Record<keyof TemplateMetaValue, string>>
}

export function TemplateMetaForm({ value, onChange, errors }: MetaFormProps) {
  function set<K extends keyof TemplateMetaValue>(k: K, v: TemplateMetaValue[K]) {
    onChange({ ...value, [k]: v })
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="md:col-span-1">
        <Label htmlFor="formNo">Form No *</Label>
        <Input
          id="formNo"
          value={value.formNo}
          onChange={(e) => set('formNo', e.target.value)}
          placeholder="F18.8511"
          className="mt-1"
        />
        {errors?.formNo && <p className="text-xs text-destructive mt-1">{errors.formNo}</p>}
      </div>

      <div className="md:col-span-1">
        <Label htmlFor="partName">Parça Adı *</Label>
        <Input
          id="partName"
          value={value.partName}
          onChange={(e) => set('partName', e.target.value)}
          placeholder="Kilit Karşılığı Sol"
          className="mt-1"
        />
        {errors?.partName && <p className="text-xs text-destructive mt-1">{errors.partName}</p>}
      </div>

      <div>
        <Label htmlFor="drawingNo">Resim No *</Label>
        <Input
          id="drawingNo"
          value={value.drawingNo}
          onChange={(e) => set('drawingNo', e.target.value)}
          placeholder="1024"
          className="mt-1"
        />
        {errors?.drawingNo && <p className="text-xs text-destructive mt-1">{errors.drawingNo}</p>}
      </div>

      <div>
        <Label htmlFor="revision">Revizyon *</Label>
        <Input
          id="revision"
          value={value.revision}
          onChange={(e) => set('revision', e.target.value)}
          placeholder="C"
          className="mt-1"
        />
        {errors?.revision && <p className="text-xs text-destructive mt-1">{errors.revision}</p>}
      </div>

      <div>
        <Label htmlFor="department">Departman</Label>
        <Input
          id="department"
          value={value.department ?? ''}
          onChange={(e) => set('department', e.target.value || null)}
          placeholder="Paketleme"
          className="mt-1"
        />
      </div>

      <div className="md:col-span-2">
        <Label htmlFor="notes">Notlar</Label>
        <Textarea
          id="notes"
          value={value.notes ?? ''}
          onChange={(e) => set('notes', e.target.value || null)}
          placeholder="Şablonla ilgili açıklamalar (opsiyonel)"
          rows={2}
          className="mt-1 resize-none"
        />
      </div>
    </div>
  )
}

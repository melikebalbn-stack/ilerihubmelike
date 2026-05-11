'use client'

// PR-JOBAPP-RENDERER: Sabit anahtar setine sahip Record<key, Entry>.
// educationHistory için: { primarySchool: {institution,...}, highSchool: {...}, ... }
// Her satır aynı sub-field setine sahip, sadece label farklı.

import { ReactNode } from 'react'

interface KeyConfig {
  id: string
  label: string
}

interface FieldConfig<TField extends string = string> {
  key: TField
  label: string
  placeholder?: string
}

interface Props<TField extends string = string> {
  keys: ReadonlyArray<KeyConfig>
  fields: ReadonlyArray<FieldConfig<TField>>
  value: Record<string, Record<TField, string>>
  onChange: (next: Record<string, Record<TField, string>>) => void
  disabled?: boolean
  /** Her bir alanı nasıl render edileceği — default ShortText. */
  renderField?: (
    field: FieldConfig<TField>,
    val: string,
    onValChange: (v: string) => void
  ) => ReactNode
}

function defaultRenderField<TField extends string>(
  field: FieldConfig<TField>,
  val: string,
  onValChange: (v: string) => void
): ReactNode {
  return (
    <input
      type="text"
      value={val ?? ''}
      onChange={(e) => onValChange(e.target.value)}
      placeholder={field.placeholder}
      className="w-full px-2.5 py-2 text-sm bg-white border border-slate-200 rounded-md focus:border-[#1B4F72] focus:ring-0 outline-none transition-colors"
    />
  )
}

export function FormFixedKeyRecord<TField extends string = string>({
  keys,
  fields,
  value,
  onChange,
  disabled,
  renderField = defaultRenderField,
}: Props<TField>) {
  void disabled

  const updateField = (keyId: string, fieldKey: TField, val: string) => {
    const current = (value[keyId] ?? {}) as Record<TField, string>
    onChange({
      ...value,
      [keyId]: { ...current, [fieldKey]: val },
    })
  }

  return (
    <div className="space-y-3">
      {keys.map((k) => {
        const entry = (value[k.id] ?? {}) as Record<TField, string>
        return (
          <div key={k.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-xs font-medium text-slate-700 mb-2">{k.label}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs text-slate-500 mb-1">{f.label}</label>
                  {renderField(f, entry[f.key] ?? '', (v) => updateField(k.id, f.key, v))}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

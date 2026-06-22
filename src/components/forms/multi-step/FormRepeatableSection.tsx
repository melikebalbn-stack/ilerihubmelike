'use client'

// PR-JOBAPP-RENDERER: Dinamik tekrar eden satır listesi (T tipli).
// renderRow callback ile her satır UI'sı çağıran orchestrator tarafından
// kontrol edilir — sub-field setleri job-application için
// kurs/dil/bilgisayar/iş tecrübesi/referans satırlarında değişiyor.

import { Plus, Trash2 } from 'lucide-react'
import { ReactNode } from 'react'

interface Props<T> {
  label?: string
  value: T[]
  onChange: (next: T[]) => void
  emptyRow: T
  /** İlk render'da min satır sayısı garantilensin (örn. 3) */
  initialRows?: number
  /** Kullanıcı silme sonrası altına düşülemeyecek minimum (default 1) */
  minRows?: number
  renderRow: (
    row: T,
    index: number,
    onRowChange: (next: T) => void,
    onRemove: () => void
  ) => ReactNode
  addButtonText?: string
  disabled?: boolean
}

export function FormRepeatableSection<T>({
  label,
  value,
  onChange,
  emptyRow,
  initialRows,
  minRows = 1,
  renderRow,
  addButtonText = 'Satır Ekle',
  disabled,
}: Props<T>) {
  // initialRows orchestrator'ın state initializer'ı ile sağlanmalı.
  // Bu component yalnızca mevcut value'yu render eder — burada implicit padding
  // yapmıyoruz (test edilebilirlik + tek sorumluluk).
  void initialRows

  const rows = value ?? []

  const handleRowChange = (idx: number, next: T) => {
    onChange(rows.map((r, i) => (i === idx ? next : r)))
  }

  const handleRemove = (idx: number) => {
    if (rows.length <= minRows) return
    onChange(rows.filter((_, i) => i !== idx))
  }

  const handleAdd = () => {
    onChange([...rows, emptyRow])
  }

  return (
    <div className="space-y-3">
      {label && <p className="text-sm font-medium text-slate-700">{label}</p>}
      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 mt-1 text-xs font-medium text-slate-400 tabular-nums w-6">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <div className="flex-1 min-w-0">
                {renderRow(row, idx, (next) => handleRowChange(idx, next), () => handleRemove(idx))}
              </div>
              {rows.length > minRows && (
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  disabled={disabled}
                  className="flex-shrink-0 mt-1 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors"
                  aria-label="Satırı sil"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={handleAdd}
        disabled={disabled}
        className="flex items-center gap-1 text-sm text-[#1B4F72] hover:text-[#1B4F72]/80 font-medium"
      >
        <Plus className="w-4 h-4" />
        {addButtonText}
      </button>
    </div>
  )
}

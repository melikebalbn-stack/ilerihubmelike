'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface TemplateChoice {
  id: string
  formNo: string
  partName: string
  drawingNo: string
  revision: string
  department: string | null
  characteristicsCount: number
}

interface Props {
  templates: TemplateChoice[]
  value: string | null
  onChange: (id: string | null) => void
}

function normalizeTr(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
}

export function TemplateSelector({ templates, value, onChange }: Props) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const query = normalizeTr(q.trim())
    if (!query) return templates
    return templates.filter((t) => {
      const haystack = normalizeTr(
        `${t.partName} ${t.drawingNo} ${t.revision} ${t.formNo} ${t.department ?? ''}`,
      )
      return haystack.includes(query)
    })
  }, [templates, q])

  if (templates.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-slate-50 p-8 text-center">
        <p className="text-sm text-slate-600 mb-2">
          Henüz şablon tanımlanmamış. Önce şablon oluşturulmalı.
        </p>
        <a
          href="/kalite/sablonlar/yeni"
          className="text-sm font-semibold text-[#1B4F72] hover:underline"
        >
          Şablon Tanımla →
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Parça adı, resim no, form no, departman..."
          className="pl-9 h-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed bg-slate-50 p-6 text-center text-sm text-slate-500">
          Arama ile eşleşen şablon yok
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
          {filtered.map((t) => {
            const isActive = t.id === value
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange(t.id)}
                className={cn(
                  'text-left rounded-md border p-3 transition-colors',
                  isActive
                    ? 'border-[#1B4F72] bg-[#1B4F72]/5 ring-2 ring-[#1B4F72]/30'
                    : 'border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-slate-800 truncate">
                      {t.partName}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 font-mono">
                      {t.drawingNo}
                      <span className="text-slate-400">-{t.revision}</span>
                      <span className="text-slate-400 mx-1">•</span>
                      {t.formNo}
                    </div>
                    {t.department && (
                      <div className="text-[11px] text-slate-500 mt-0.5">{t.department}</div>
                    )}
                  </div>
                  <div className="text-right text-[11px] text-slate-500 shrink-0">
                    <div className="tabular-nums font-semibold text-slate-700">
                      {t.characteristicsCount}
                    </div>
                    <div>karakter</div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

'use client'

import { useCallback, useRef, useState } from 'react'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ReportResultBadge, type ReportResult } from './ReportResultBadge'

export interface CharRow {
  id: string
  orderIndex: number
  charName: string
  critical: boolean
  symbol: { id: string; key: string; nameTr: string; svgContent: string } | null
  nominal: string | null
  maxValue: string | null
  minValue: string | null
  hasNumericRange: boolean
  measurements: ReadonlyArray<string | null>
  result: ReportResult
}

interface Props {
  reportId: string
  initialCharacteristics: ReadonlyArray<CharRow>
  /** Finalize edilmişse tüm grid read-only */
  locked?: boolean
}

const MEASUREMENT_COUNT = 10
const DEBOUNCE_MS = 600

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function SymbolGlyph({ svg, className }: { svg: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('text-current', className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

function normalizeForServer(v: string | null): string | null {
  if (v === null) return null
  const trimmed = v.trim().replace(',', '.')
  if (trimmed === '') return null
  return trimmed
}

export function MeasurementGrid({
  reportId,
  initialCharacteristics,
  locked = false,
}: Props) {
  const [rows, setRows] = useState<CharRow[]>(() => [...initialCharacteristics])
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({})
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const setRowSave = useCallback((charId: string, s: SaveState) => {
    setSaveState((prev) => ({ ...prev, [charId]: s }))
  }, [])

  const persistRow = useCallback(
    async (charId: string, measurements: ReadonlyArray<string | null>) => {
      setRowSave(charId, 'saving')
      try {
        const body = {
          measurements: measurements.map((m) => normalizeForServer(m)),
        }
        const res = await fetch(
          `/api/quality/reports/${reportId}/characteristics/${charId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
        )
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Kaydedilemedi')

        // Server response: { characteristic: { measurements, result, ... } }
        const updated = json.characteristic
        if (updated) {
          setRows((prev) =>
            prev.map((r) =>
              r.id === charId
                ? {
                    ...r,
                    measurements: normalizeFromServer(updated.measurements),
                    result: updated.result as ReportResult,
                  }
                : r,
            ),
          )
        }
        setRowSave(charId, 'saved')
        // 1.5s sonra idle'a dön (yeşil tikten temizle)
        setTimeout(() => {
          setSaveState((prev) =>
            prev[charId] === 'saved' ? { ...prev, [charId]: 'idle' } : prev,
          )
        }, 1500)
      } catch (err) {
        setRowSave(charId, 'error')
        toast.error(err instanceof Error ? err.message : 'Kaydedilemedi')
      }
    },
    [reportId, setRowSave],
  )

  const scheduleSave = useCallback(
    (charId: string, measurements: ReadonlyArray<string | null>) => {
      const existing = timersRef.current.get(charId)
      if (existing) clearTimeout(existing)
      const t = setTimeout(() => {
        timersRef.current.delete(charId)
        void persistRow(charId, measurements)
      }, DEBOUNCE_MS)
      timersRef.current.set(charId, t)
    },
    [persistRow],
  )

  const handleCellChange = useCallback(
    (charId: string, slotIndex: number, raw: string) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== charId) return r
          const next: (string | null)[] = [...r.measurements]
          // Boş string null gibi saklanır (UX: render'da "" da boş gözükür)
          next[slotIndex] = raw === '' ? null : raw
          // Debounce'lu auto-save (snapshot)
          scheduleSave(charId, next)
          return { ...r, measurements: next }
        }),
      )
    },
    [scheduleSave],
  )

  return (
    <div className="rounded-md border bg-white overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth: 'max-content' }}>
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th
              rowSpan={2}
              className="sticky left-0 z-20 bg-slate-50 px-2 py-2 w-12 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide border-r border-slate-200"
            >
              #
            </th>
            <th
              colSpan={4}
              className="px-2 py-1.5 text-center text-[10px] font-bold text-[#1B4F72] uppercase tracking-wider bg-[#1B4F72]/[0.06] border-b border-[#1B4F72]/15 border-r border-slate-200"
            >
              Karakter Özellikleri
            </th>
            <th
              colSpan={MEASUREMENT_COUNT}
              className="px-2 py-1.5 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider bg-slate-100/60 border-b border-slate-200"
            >
              Ölçümler
            </th>
            <th
              rowSpan={2}
              className="sticky right-0 z-20 bg-slate-50 px-2 py-2 w-32 text-center text-[10px] font-semibold text-slate-600 uppercase tracking-wide border-l border-slate-200"
            >
              Sonuç
            </th>
          </tr>
          <tr className="bg-[#1B4F72]/[0.04] border-b border-slate-200">
            <th
              className="sticky z-20 bg-[#1B4F72]/[0.04] px-2 py-2 text-left text-[10px] font-semibold text-[#1B4F72] uppercase tracking-wide min-w-[220px]"
              style={{ left: '3rem' }}
            >
              Karakter
            </th>
            <th className="bg-[#1B4F72]/[0.04] px-2 py-2 w-20 text-center text-[10px] font-semibold text-[#1B4F72] uppercase tracking-wide">
              Nominal
            </th>
            <th className="bg-[#1B4F72]/[0.04] px-2 py-2 w-20 text-center text-[10px] font-semibold text-[#1B4F72] uppercase tracking-wide">
              Maks
            </th>
            <th className="bg-[#1B4F72]/[0.04] px-2 py-2 w-20 text-center text-[10px] font-semibold text-[#1B4F72] uppercase tracking-wide border-r border-slate-200">
              Min
            </th>
            {Array.from({ length: MEASUREMENT_COUNT }, (_, i) => (
              <th
                key={i}
                className="px-1 py-2 w-20 text-center text-[10px] font-semibold text-slate-600 uppercase tracking-wide tabular-nums"
              >
                Ö{i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rowBg = row.critical ? 'bg-amber-50/30' : 'bg-white'
            const stickyBg = row.critical ? 'bg-amber-50/30' : 'bg-white'
            const state = saveState[row.id] ?? 'idle'
            const disabled = locked || !row.hasNumericRange

            return (
              <tr key={row.id} className={cn('border-b border-slate-100', rowBg)}>
                <td
                  className={cn(
                    'sticky left-0 z-10 px-2 py-2 align-middle text-xs font-semibold text-slate-500 tabular-nums border-r border-slate-100',
                    stickyBg,
                  )}
                >
                  {row.orderIndex}
                </td>

                <td
                  className={cn('sticky z-10 px-2 py-2 align-middle', stickyBg)}
                  style={{ left: '3rem' }}
                >
                  <div className="flex items-center gap-2">
                    {row.critical && (
                      <span
                        className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-amber-500 text-white text-xs font-bold shrink-0"
                        title="Kritik karakteristik"
                      >
                        *
                      </span>
                    )}
                    {row.symbol && (
                      <SymbolGlyph
                        svg={row.symbol.svgContent}
                        className="h-4 w-4 text-slate-700 shrink-0"
                      />
                    )}
                    <span className="text-sm text-slate-800">{row.charName}</span>
                  </div>
                </td>

                <td
                  className={cn(
                    'sticky px-2 py-2 align-middle text-center text-xs font-mono text-slate-700 tabular-nums',
                    stickyBg,
                  )}
                >
                  {row.hasNumericRange ? row.nominal ?? '—' : '—'}
                </td>
                <td
                  className={cn(
                    'sticky px-2 py-2 align-middle text-center text-xs font-mono text-slate-700 tabular-nums',
                    stickyBg,
                  )}
                >
                  {row.hasNumericRange ? row.maxValue ?? '—' : '—'}
                </td>
                <td
                  className={cn(
                    'sticky px-2 py-2 align-middle text-center text-xs font-mono text-slate-700 tabular-nums border-r border-slate-200',
                    stickyBg,
                  )}
                >
                  {row.hasNumericRange ? row.minValue ?? '—' : '—'}
                </td>

                {Array.from({ length: MEASUREMENT_COUNT }, (_, i) => {
                  const val = row.measurements[i] ?? ''
                  return (
                    <td key={i} className="px-1 py-2 align-middle">
                      <Input
                        value={val}
                        onChange={(e) => handleCellChange(row.id, i, e.target.value)}
                        placeholder="—"
                        inputMode="decimal"
                        disabled={disabled}
                        className={cn(
                          'h-8 w-full text-center text-xs font-mono tabular-nums px-1',
                          disabled && 'bg-slate-50 text-slate-400',
                        )}
                      />
                    </td>
                  )
                })}

                {/* Sonuç sticky right — badge + save state */}
                <td
                  className={cn(
                    'sticky right-0 z-10 px-2 py-2 align-middle text-center border-l border-slate-200',
                    stickyBg,
                  )}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <ReportResultBadge result={row.result} />
                    {state === 'saving' && (
                      <Loader2
                        className="h-3 w-3 text-slate-400 animate-spin"
                        aria-label="Kaydediliyor"
                      />
                    )}
                    {state === 'saved' && (
                      <Check
                        className="h-3 w-3 text-emerald-600"
                        aria-label="Kaydedildi"
                      />
                    )}
                    {state === 'error' && (
                      <AlertCircle
                        className="h-3 w-3 text-red-600"
                        aria-label="Hata"
                      />
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {locked && (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          Bu rapor finalize edildi — ölçümler değiştirilemez.
        </div>
      )}
    </div>
  )
}

// === Helpers ===

function normalizeFromServer(raw: unknown): (string | null)[] {
  const arr = Array.isArray(raw) ? raw : []
  return Array.from({ length: MEASUREMENT_COUNT }, (_, i) => {
    const v = arr[i]
    if (v === null || v === undefined || v === '') return null
    return String(v)
  })
}

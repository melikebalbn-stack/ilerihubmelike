'use client'

import { useCallback, useRef, useState } from 'react'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ReportResultBadge, type ReportResult } from './ReportResultBadge'
import { CharacterCell } from './CharacterCell'

export interface CharRow {
  id: string
  orderIndex: number
  /** Şablon snapshot — rapor doldurmada read-only */
  department: string | null
  inspectionTool: string | null
  sampleFreq: string | null
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
  /** Parent (ReportDetailClient) live aggregator için */
  onCharsChange?: (rows: CharRow[]) => void
}

/**
 * Bir hücrenin tolerans durumunu döndürür.
 *   - hasNumericRange=false → 'na' (görsel kontrol, kırmızı vurgu yok)
 *   - boş input → 'empty'
 *   - max/min tanımsız ya da parse-fail → 'unknown'
 *   - range içi → 'in', dışı → 'out'
 */
function cellTolerance(
  value: string | null,
  maxValue: string | null,
  minValue: string | null,
  hasNumericRange: boolean,
): 'na' | 'empty' | 'unknown' | 'in' | 'out' {
  if (!hasNumericRange) return 'na'
  if (value === null || value === '') return 'empty'
  if (maxValue === null || minValue === null) return 'unknown'
  const v = parseFloat(String(value).replace(',', '.'))
  const max = parseFloat(maxValue.replace(',', '.'))
  const min = parseFloat(minValue.replace(',', '.'))
  if (!Number.isFinite(v) || !Number.isFinite(max) || !Number.isFinite(min)) {
    return 'unknown'
  }
  return v < min || v > max ? 'out' : 'in'
}

const MEASUREMENT_COUNT = 10
const DEBOUNCE_MS = 600

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

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
  onCharsChange,
}: Props) {
  const [rows, setRows] = useState<CharRow[]>(() => [...initialCharacteristics])
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({})
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Parent live update (aggregator için)
  const setRowsAndNotify = useCallback(
    (updater: (prev: CharRow[]) => CharRow[]) => {
      setRows((prev) => {
        const next = updater(prev)
        if (onCharsChange) onCharsChange(next)
        return next
      })
    },
    [onCharsChange],
  )

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
          setRowsAndNotify((prev) =>
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
    [reportId, setRowSave, setRowsAndNotify],
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
      setRowsAndNotify((prev) =>
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
    [scheduleSave, setRowsAndNotify],
  )

  return (
    <div className="overflow-x-auto bg-white">
      <table
        className="w-full border-collapse text-[12.5px] font-quality"
        style={{ minWidth: 'max-content' }}
      >
        <thead>
          {/* 1. satır — gruplar (KRİTİK KARAKTER standalone; KARAKTER ÖZELLİKLERİ = Nominal/Maksimum/Minimum) */}
          <tr className="bg-slate-50 border-b border-slate-200">
            <th
              rowSpan={2}
              className="sticky left-0 z-20 bg-slate-50 px-2 py-2 w-10 text-center text-[10.5px] font-semibold text-slate-600 uppercase tracking-[0.04em] border-r border-slate-200"
            >
              #
            </th>
            <th
              rowSpan={2}
              className="bg-slate-50 px-2 py-2 w-20 text-left text-[10.5px] font-semibold text-slate-600 uppercase tracking-[0.04em] border-r border-slate-200"
            >
              Bölüm
            </th>
            <th
              rowSpan={2}
              className="bg-slate-50 px-2 py-2 w-28 text-left text-[10.5px] font-semibold text-slate-600 uppercase tracking-[0.04em] border-r border-slate-200"
            >
              Muayene Aracı
            </th>
            <th
              rowSpan={2}
              className="bg-slate-50 px-2 py-2 w-28 text-center text-[10.5px] font-semibold text-slate-600 uppercase tracking-[0.04em] border-r border-slate-200"
            >
              Numune / Sıklık
            </th>
            <th
              rowSpan={2}
              className="bg-[#1B4F72]/[0.06] px-2 py-2 text-left text-[10.5px] font-bold text-[#1B4F72] uppercase tracking-[0.04em] min-w-[220px] border-r border-slate-200"
            >
              Kritik Karakter
            </th>
            <th
              colSpan={3}
              className="px-2 py-1.5 text-center text-[10.5px] font-bold text-[#1B4F72] uppercase tracking-[0.04em] bg-[#1B4F72]/[0.06] border-b border-[#1B4F72]/15 border-r border-slate-200"
            >
              Karakter Özellikleri
            </th>
            <th
              colSpan={MEASUREMENT_COUNT}
              className="px-2 py-1.5 text-center text-[10.5px] font-bold text-[#1B4F72] uppercase tracking-[0.04em] bg-[#1B4F72]/[0.06] border-b border-[#1B4F72]/15"
            >
              Numune Ölçümleri
            </th>
            <th
              rowSpan={2}
              className="sticky right-0 z-20 bg-slate-50 px-2 py-2 w-[76px] text-center text-[10.5px] font-semibold text-slate-600 uppercase tracking-[0.04em] border-l border-slate-200"
            >
              Sonuç
            </th>
          </tr>
          {/* 2. satır — KARAKTER ÖZELLİKLERİ alt başlıkları (Nominal/Maksimum/Minimum) + 10 ölçüm numarası */}
          <tr className="bg-[#1B4F72]/[0.04] border-b border-slate-200">
            <th className="bg-[#1B4F72]/[0.04] px-2 py-2 w-[70px] text-center text-[10.5px] font-semibold text-[#1B4F72] uppercase tracking-[0.04em]">
              Nominal
            </th>
            <th className="bg-[#1B4F72]/[0.04] px-2 py-2 w-[70px] text-center text-[10.5px] font-semibold text-[#1B4F72] uppercase tracking-[0.04em]">
              Maksimum
            </th>
            <th className="bg-[#1B4F72]/[0.04] px-2 py-2 w-[70px] text-center text-[10.5px] font-semibold text-[#1B4F72] uppercase tracking-[0.04em] border-r border-slate-200">
              Minimum
            </th>
            {Array.from({ length: MEASUREMENT_COUNT }, (_, i) => (
              <th
                key={i}
                className="px-1 py-2 w-14 text-center text-[10.5px] font-semibold text-slate-600 uppercase tracking-[0.04em] tabular-nums font-quality-mono"
              >
                {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rowBg = row.critical ? 'bg-amber-50/40' : 'bg-white'
            const stickyBg = row.critical ? 'bg-amber-50/40' : 'bg-white'
            const state = saveState[row.id] ?? 'idle'
            const disabled = locked || !row.hasNumericRange

            return (
              <tr
                key={row.id}
                className={cn(
                  'border-b border-slate-100 hover:bg-slate-50/60 transition-colors',
                  rowBg,
                )}
              >
                <td
                  className={cn(
                    'sticky left-0 z-10 px-2 align-middle text-center text-[11px] font-semibold font-quality-mono text-slate-500 tabular-nums border-r border-slate-100',
                    stickyBg,
                  )}
                  style={{ height: '44px' }}
                >
                  {row.orderIndex}
                </td>
                <td className="px-2 align-middle text-left text-[12px] font-quality-mono text-slate-700 border-r border-slate-100">
                  {row.department || ''}
                </td>
                <td className="px-2 align-middle text-left text-[12px] font-quality-mono text-slate-700 border-r border-slate-100">
                  {row.inspectionTool || ''}
                </td>
                <td className="px-2 align-middle text-center text-[12px] font-quality-mono text-slate-700 border-r border-slate-100">
                  {row.sampleFreq || ''}
                </td>

                <td className="align-middle border-r border-slate-100">
                  <CharacterCell
                    mode="readonly"
                    critical={row.critical}
                    charName={row.charName}
                    symbol={
                      row.symbol
                        ? {
                            key: row.symbol.key,
                            nameTr: row.symbol.nameTr,
                            svgContent: row.symbol.svgContent,
                          }
                        : null
                    }
                  />
                </td>

                <td className="px-2 align-middle text-center text-[12px] font-quality-mono text-slate-900 font-semibold tabular-nums">
                  {row.hasNumericRange ? row.nominal ?? '—' : '—'}
                </td>
                <td className="px-2 align-middle text-center text-[12px] font-quality-mono text-slate-700 tabular-nums">
                  {row.hasNumericRange ? row.maxValue ?? '—' : '—'}
                </td>
                <td className="px-2 align-middle text-center text-[12px] font-quality-mono text-slate-700 tabular-nums border-r border-slate-200">
                  {row.hasNumericRange ? row.minValue ?? '—' : '—'}
                </td>

                {Array.from({ length: MEASUREMENT_COUNT }, (_, i) => {
                  const val = row.measurements[i] ?? ''
                  const tolerance = cellTolerance(
                    val === '' ? null : val,
                    row.maxValue,
                    row.minValue,
                    row.hasNumericRange,
                  )
                  return (
                    <td key={i} className="px-1 align-middle">
                      <Input
                        value={val}
                        onChange={(e) => handleCellChange(row.id, i, e.target.value)}
                        placeholder="—"
                        inputMode="decimal"
                        disabled={disabled}
                        title={
                          tolerance === 'out'
                            ? `Tolerans dışı (Min ${row.minValue} / Maks ${row.maxValue})`
                            : undefined
                        }
                        className={cn(
                          'h-8 w-full text-center text-[12.5px] font-quality-mono tabular-nums px-1 transition-colors border-slate-200',
                          disabled && 'bg-slate-50 text-slate-400',
                          tolerance === 'in' &&
                            'bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold focus-visible:ring-emerald-300',
                          tolerance === 'out' &&
                            'bg-red-50 border-red-200 text-red-700 font-bold focus-visible:ring-red-300',
                        )}
                      />
                    </td>
                  )
                })}

                {/* Sonuç sticky right — badge + save state */}
                <td
                  className={cn(
                    'sticky right-0 z-10 px-2 align-middle text-center border-l border-slate-200',
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
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500 font-quality">
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

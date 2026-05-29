'use client'

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
  // 10-elementli array; null veya "" boş slot
  measurements: ReadonlyArray<string | null>
  result: ReportResult
}

interface Props {
  characteristics: ReadonlyArray<CharRow>
  /** Finalize edilmişse tüm grid read-only */
  locked?: boolean
}

const MEASUREMENT_COUNT = 10

function SymbolGlyph({ svg, className }: { svg: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('text-current', className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

/**
 * KALITE-4B Commit 1 — read-only render.
 * Sticky sütunlar (charName/Nominal/Maks/Min/Result) frozen, O1–O10 scroll.
 * Input KALITE-4B Commit 2'de eklenecek.
 */
export function MeasurementGrid({ characteristics, locked = false }: Props) {
  return (
    <div className="rounded-md border bg-white overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth: 'max-content' }}>
        <thead>
          {/* Section header satırı */}
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
              className="sticky right-0 z-20 bg-slate-50 px-2 py-2 w-28 text-center text-[10px] font-semibold text-slate-600 uppercase tracking-wide border-l border-slate-200"
            >
              Sonuç
            </th>
          </tr>
          {/* Sub-header satırı */}
          <tr className="bg-[#1B4F72]/[0.04] border-b border-slate-200">
            <th
              className="sticky left-12 z-20 bg-[#1B4F72]/[0.04] px-2 py-2 text-left text-[10px] font-semibold text-[#1B4F72] uppercase tracking-wide min-w-[220px]"
              style={{ left: '3rem' }}
            >
              Karakter
            </th>
            <th className="sticky bg-[#1B4F72]/[0.04] px-2 py-2 w-20 text-center text-[10px] font-semibold text-[#1B4F72] uppercase tracking-wide">
              Nominal
            </th>
            <th className="sticky bg-[#1B4F72]/[0.04] px-2 py-2 w-20 text-center text-[10px] font-semibold text-[#1B4F72] uppercase tracking-wide">
              Maks
            </th>
            <th className="sticky bg-[#1B4F72]/[0.04] px-2 py-2 w-20 text-center text-[10px] font-semibold text-[#1B4F72] uppercase tracking-wide border-r border-slate-200">
              Min
            </th>
            {Array.from({ length: MEASUREMENT_COUNT }, (_, i) => (
              <th
                key={i}
                className="px-1 py-2 w-16 text-center text-[10px] font-semibold text-slate-600 uppercase tracking-wide tabular-nums"
              >
                Ö{i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {characteristics.map((row) => (
            <tr
              key={row.id}
              className={cn(
                'border-b border-slate-100',
                row.critical && 'bg-amber-50/30',
              )}
            >
              {/* # */}
              <td className="sticky left-0 z-10 bg-inherit px-2 py-2 align-middle text-xs font-semibold text-slate-500 tabular-nums border-r border-slate-100">
                <div className={cn(row.critical && 'bg-amber-50/30 -mx-2 px-2 py-0', !row.critical && 'bg-white -mx-2 px-2 py-0')}>
                  {row.orderIndex}
                </div>
              </td>

              {/* Karakter (sembol + ad) */}
              <td
                className="sticky z-10 bg-inherit px-2 py-2 align-middle"
                style={{ left: '3rem' }}
              >
                <div className={cn('flex items-center gap-2', row.critical && '-mx-2 px-2', !row.critical && '-mx-2 px-2')}>
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

              {/* Nominal */}
              <td className="sticky bg-inherit px-2 py-2 align-middle text-center text-xs font-mono text-slate-700 tabular-nums">
                {row.hasNumericRange ? row.nominal ?? '—' : '—'}
              </td>

              {/* Maks */}
              <td className="sticky bg-inherit px-2 py-2 align-middle text-center text-xs font-mono text-slate-700 tabular-nums">
                {row.hasNumericRange ? row.maxValue ?? '—' : '—'}
              </td>

              {/* Min */}
              <td className="sticky bg-inherit px-2 py-2 align-middle text-center text-xs font-mono text-slate-700 tabular-nums border-r border-slate-200">
                {row.hasNumericRange ? row.minValue ?? '—' : '—'}
              </td>

              {/* O1–O10 — read-only (Commit 1) */}
              {Array.from({ length: MEASUREMENT_COUNT }, (_, i) => {
                const val = row.measurements[i] ?? null
                return (
                  <td
                    key={i}
                    className="px-1 py-2 align-middle text-center text-xs font-mono text-slate-500 tabular-nums"
                  >
                    {val ? <span className="text-slate-800">{val}</span> : <span className="text-slate-300">—</span>}
                  </td>
                )
              })}

              {/* Sonuç (sticky right) */}
              <td className="sticky right-0 z-10 bg-inherit px-2 py-2 align-middle text-center border-l border-slate-200">
                <ReportResultBadge result={row.result} />
              </td>
            </tr>
          ))}
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

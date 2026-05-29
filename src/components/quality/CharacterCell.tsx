'use client'

import { cn } from '@/lib/utils'
import { SymbolGlyph } from './SymbolGlyph'
import { SymbolPicker, type SymbolOption } from './SymbolPicker'

export interface CharacterCellSymbolDisplay {
  key: string
  nameTr: string
  svgContent: string
}

export interface CharacterCellDatum {
  datum1: string | null
  datum2: string | null
  datum3: string | null
}

interface BaseProps {
  /** Kritik bayrak — sarı * görsel; edit'te tıklanabilir */
  critical: boolean
  /** Karakter adı — "34", "Ø9,9", "Yüzey Kontrol"... */
  charName: string
  /** GD&T datum referansları — opsiyonel etiketler (örn. "A","B","C") */
  datum1: string | null
  datum2: string | null
  datum3: string | null
  className?: string
}

interface EditProps extends BaseProps {
  mode: 'edit'
  onCriticalChange: (next: boolean) => void
  /** Seçili sembol id'si (null = sembolsüz) */
  symbolId: string | null
  onSymbolChange: (id: string | null) => void
  /** Picker'a verilecek opsiyon listesi */
  symbols: SymbolOption[]
  onCharNameChange: (next: string) => void
  onDatumChange: (slot: 1 | 2 | 3, next: string | null) => void
  charNamePlaceholder?: string
  disabled?: boolean
}

interface ReadonlyProps extends BaseProps {
  mode: 'readonly'
  /** Tam sembol bilgisi — Glyph + nameTr göstermek için */
  symbol: CharacterCellSymbolDisplay | null
}

type Props = EditProps | ReadonlyProps

/**
 * Tek hücrede karakter tanımı — kritik bayrak + GD&T sembol + karakter adı + datum.
 *
 * Mode:
 * - "edit"     : KALITE-3 şablon builder — tıklanabilir crit toggle,
 *                SymbolPicker dropdown, charName input, 3 küçük datum input
 * - "readonly" : KALITE-4B rapor doldurma — şablondan snapshot, sadece görsel;
 *                datum varsa "▷ A B" kompakt suffix
 *
 * Datum'a ayrı kolon eklenmez — hücre içinde kompakt sergilenir.
 */
export function CharacterCell(props: Props) {
  if (props.mode === 'edit') {
    return <CharacterCellEdit {...props} />
  }
  return <CharacterCellReadonly {...props} />
}

// ════════════════════════════════════════════════════════════
// EDIT
// ════════════════════════════════════════════════════════════

function CharacterCellEdit({
  critical,
  onCriticalChange,
  symbolId,
  onSymbolChange,
  symbols,
  charName,
  onCharNameChange,
  datum1,
  datum2,
  datum3,
  onDatumChange,
  charNamePlaceholder = 'Karakter (örn. 34, Ø9,9, Yüzey Kontrol)',
  disabled,
  className,
}: EditProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 px-1.5 py-1 h-full min-w-0',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <CritGlyphButton
          critical={critical}
          onClick={() => !disabled && onCriticalChange(!critical)}
          disabled={disabled}
          interactive
        />
        <div className="flex-shrink-0">
          <SymbolPicker
            value={symbolId}
            onChange={onSymbolChange}
            symbols={symbols}
            disabled={disabled}
          />
        </div>
        <input
          type="text"
          value={charName}
          onChange={(e) => onCharNameChange(e.target.value)}
          disabled={disabled}
          placeholder={charNamePlaceholder}
          className={cn(
            'flex-1 min-w-0 h-8 px-2 rounded-md border border-slate-200 bg-white',
            'font-quality text-[12.5px] text-slate-800 placeholder:text-slate-400',
            'focus:outline-none focus:border-[#1B4F72] focus:ring-2 focus:ring-[#1B4F72]/15',
            'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed',
          )}
        />
      </div>
      <div className="flex items-center gap-1 pl-[26px]">
        <DatumLabel />
        <DatumInput
          value={datum1}
          onChange={(v) => onDatumChange(1, v)}
          disabled={disabled}
          placeholder="A"
        />
        <DatumInput
          value={datum2}
          onChange={(v) => onDatumChange(2, v)}
          disabled={disabled}
          placeholder="B"
        />
        <DatumInput
          value={datum3}
          onChange={(v) => onDatumChange(3, v)}
          disabled={disabled}
          placeholder="C"
        />
      </div>
    </div>
  )
}

function DatumLabel() {
  return (
    <span
      className="font-quality text-[9.5px] uppercase tracking-[0.06em] text-slate-400 select-none"
      title="Datum referansları"
    >
      ▷
    </span>
  )
}

function DatumInput({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string | null
  onChange: (next: string | null) => void
  disabled?: boolean
  placeholder?: string
}) {
  return (
    <input
      type="text"
      value={value ?? ''}
      onChange={(e) => {
        const trimmed = e.target.value
        onChange(trimmed === '' ? null : trimmed)
      }}
      disabled={disabled}
      placeholder={placeholder}
      maxLength={32}
      className={cn(
        'w-8 h-6 px-1 rounded border border-slate-200 bg-white text-center',
        'font-quality-mono text-[11px] text-slate-700 placeholder:text-slate-300',
        'focus:outline-none focus:border-[#1B4F72] focus:ring-1 focus:ring-[#1B4F72]/20',
        'disabled:bg-slate-50 disabled:text-slate-400',
      )}
    />
  )
}

// ════════════════════════════════════════════════════════════
// READONLY
// ════════════════════════════════════════════════════════════

function CharacterCellReadonly({
  critical,
  symbol,
  charName,
  datum1,
  datum2,
  datum3,
  className,
}: ReadonlyProps) {
  const datums = [datum1, datum2, datum3].filter(
    (d): d is string => d !== null && d.trim() !== '',
  )
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-1.5 py-1 h-full min-w-0',
        className,
      )}
    >
      <CritGlyphButton critical={critical} interactive={false} />
      {symbol && (
        <SymbolGlyph
          svg={symbol.svgContent}
          className="h-[18px] w-[18px] flex-shrink-0 text-slate-700"
        />
      )}
      <span
        className={cn(
          'font-quality text-[12px] truncate',
          critical ? 'text-amber-800 font-medium' : 'text-slate-700',
        )}
        title={
          symbol ? `${symbol.nameTr}${charName ? ` · ${charName}` : ''}` : charName
        }
      >
        {symbol && charName
          ? `${symbol.nameTr} · ${charName}`
          : symbol?.nameTr || charName || '—'}
      </span>
      {datums.length > 0 && (
        <span
          className="ml-auto flex-shrink-0 inline-flex items-center gap-0.5 font-quality-mono text-[10.5px] text-slate-500"
          title={`Datum: ${datums.join(' ')}`}
        >
          <span className="text-slate-400">▷</span>
          <span>{datums.join(' ')}</span>
        </span>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// SHARED — kompakt kritik göstergesi (mockup 22x22 .crit-toggle)
// ════════════════════════════════════════════════════════════

function CritGlyphButton({
  critical,
  onClick,
  disabled,
  interactive,
}: {
  critical: boolean
  onClick?: () => void
  disabled?: boolean
  interactive: boolean
}) {
  const baseClass = cn(
    'flex-shrink-0 inline-flex items-center justify-center w-[22px] h-[22px]',
    'rounded border font-quality-mono text-sm font-bold transition-colors',
    critical
      ? 'bg-amber-500 border-amber-500 text-white'
      : 'bg-white border-slate-200 text-slate-300',
  )

  if (!interactive) {
    return (
      <span
        aria-label={critical ? 'Kritik karakteristik' : 'Standart karakteristik'}
        className={baseClass}
      >
        *
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={critical}
      title={critical ? 'Kritik (tıkla: kaldır)' : 'Kritik olarak işaretle'}
      className={cn(
        baseClass,
        !critical && !disabled && 'hover:border-amber-500 hover:text-amber-500',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      *
    </button>
  )
}

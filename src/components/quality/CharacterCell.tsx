'use client'

import { cn } from '@/lib/utils'
import { SymbolGlyph } from './SymbolGlyph'
import { SymbolPicker, type SymbolOption } from './SymbolPicker'

export interface CharacterCellSymbolDisplay {
  key: string
  nameTr: string
  svgContent: string
}

interface BaseProps {
  /** Kritik bayrak — sarı * görsel; edit'te tıklanabilir */
  critical: boolean
  /** Karakter adı — "34", "Ø9,9", "Yüzey Kontrol"... */
  charName: string
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
 * Tek hücrede karakter tanımı — kritik bayrak + GD&T sembol + karakter adı.
 * Mockup .char-cell paritesi: 22x22 crit toggle + sembol dropdown / glyph + ad.
 *
 * Mode:
 * - "edit"     : KALITE-3 şablon builder — tıklanabilir crit toggle,
 *                SymbolPicker dropdown, charName input
 * - "readonly" : KALITE-4B rapor doldurma — şablondan snapshot, sadece görsel
 *                (mockup'taki rapor görünümünde karakter kısmı değiştirilemez)
 *
 * Hücre yüksekliği parent satıra uyumlu (h-full); ölçüm tablosunda 44px row.
 * Modül font: charName font-quality / sembol label font-quality.
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
  charNamePlaceholder = 'Karakter (örn. 34, Ø9,9, Yüzey Kontrol)',
  disabled,
  className,
}: EditProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-1.5 py-1 h-full min-w-0',
        className,
      )}
    >
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
  )
}

// ════════════════════════════════════════════════════════════
// READONLY
// ════════════════════════════════════════════════════════════

function CharacterCellReadonly({
  critical,
  symbol,
  charName,
  className,
}: ReadonlyProps) {
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

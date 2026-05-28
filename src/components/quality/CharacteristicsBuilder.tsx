'use client'

import { useId } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { SymbolPicker, type SymbolOption } from './SymbolPicker'
import { CritToggle } from './CritToggle'

export interface TemplateCharRow {
  _key: string
  orderIndex: number
  department: string | null
  inspectionTool: string | null
  sampleFreq: string | null
  critical: boolean
  symbolId: string | null
  charName: string
  nominal: string | null
  maxValue: string | null
  minValue: string | null
  hasNumericRange: boolean
}

interface BuilderProps {
  value: TemplateCharRow[]
  onChange: (rows: TemplateCharRow[]) => void
  symbols: SymbolOption[]
}

let _nextKey = 0
function newKey() {
  _nextKey += 1
  return `c-${Date.now()}-${_nextKey}`
}

export function makeEmptyChar(orderIndex: number): TemplateCharRow {
  return {
    _key: newKey(),
    orderIndex,
    department: null,
    inspectionTool: null,
    sampleFreq: null,
    critical: false,
    symbolId: null,
    charName: '',
    nominal: null,
    maxValue: null,
    minValue: null,
    hasNumericRange: true,
  }
}

function normalizeDecimal(v: string | null | undefined): string | null {
  if (!v) return null
  const trimmed = v.trim()
  if (!trimmed) return null
  return trimmed.replace(',', '.')
}

function SortableRow({
  row,
  onPatch,
  onRemove,
  symbols,
}: {
  row: TemplateCharRow
  onPatch: (patch: Partial<TemplateCharRow>) => void
  onRemove: () => void
  symbols: SymbolOption[]
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row._key })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: isDragging ? 'relative' : undefined,
    zIndex: isDragging ? 10 : undefined,
  }

  const disabledRange = !row.hasNumericRange

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        'group border-b border-slate-100 transition-colors hover:bg-slate-50',
        row.critical && 'bg-amber-50/40 hover:bg-amber-50/60',
        isDragging && 'shadow-lg bg-white ring-2 ring-[#1B4F72]/30',
      )}
    >
      {/* Drag + Order */}
      <td className="px-2 py-2 align-middle">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-600"
            aria-label="Sırala"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="text-xs font-semibold text-slate-500 tabular-nums w-4 text-center">
            {row.orderIndex}
          </span>
        </div>
      </td>

      {/* Bölüm */}
      <td className="px-1 py-2 align-middle">
        <Input
          value={row.department ?? ''}
          onChange={(e) => onPatch({ department: e.target.value || null })}
          placeholder="K3"
          className="h-9 text-xs"
        />
      </td>

      {/* Muayene Aracı */}
      <td className="px-1 py-2 align-middle">
        <Input
          value={row.inspectionTool ?? ''}
          onChange={(e) => onPatch({ inspectionTool: e.target.value || null })}
          placeholder="Kumpas"
          className="h-9 text-xs"
        />
      </td>

      {/* Sıklık */}
      <td className="px-1 py-2 align-middle">
        <Input
          value={row.sampleFreq ?? ''}
          onChange={(e) => onPatch({ sampleFreq: e.target.value || null })}
          placeholder="Ürt. Başl."
          className="h-9 text-xs"
        />
      </td>

      {/* ===== Karakter (KOMBİNE: krit + sembol + ad) ===== */}
      <td className="px-1 py-2 align-middle">
        <div className="flex items-center gap-1.5">
          <CritToggle
            value={row.critical}
            onChange={(v) => onPatch({ critical: v })}
          />
          <SymbolPicker
            value={row.symbolId}
            onChange={(id) => onPatch({ symbolId: id })}
            symbols={symbols}
          />
          <Input
            value={row.charName}
            onChange={(e) => onPatch({ charName: e.target.value })}
            placeholder="34, Ø9,9, Yüzey Kontrol..."
            className="h-9 text-sm flex-1 min-w-[140px]"
          />
        </div>
      </td>

      {/* Nominal */}
      <td className="px-1 py-2 align-middle">
        <Input
          value={row.nominal ?? ''}
          onChange={(e) => onPatch({ nominal: e.target.value || null })}
          onBlur={(e) => onPatch({ nominal: normalizeDecimal(e.target.value) })}
          placeholder="—"
          inputMode="decimal"
          disabled={disabledRange}
          className={cn(
            'h-9 text-xs font-mono text-center',
            disabledRange && 'bg-slate-50 text-slate-400',
          )}
        />
      </td>

      {/* Maks */}
      <td className="px-1 py-2 align-middle">
        <Input
          value={row.maxValue ?? ''}
          onChange={(e) => onPatch({ maxValue: e.target.value || null })}
          onBlur={(e) => onPatch({ maxValue: normalizeDecimal(e.target.value) })}
          placeholder="—"
          inputMode="decimal"
          disabled={disabledRange}
          className={cn(
            'h-9 text-xs font-mono text-center',
            disabledRange && 'bg-slate-50 text-slate-400',
          )}
        />
      </td>

      {/* Min */}
      <td className="px-1 py-2 align-middle">
        <Input
          value={row.minValue ?? ''}
          onChange={(e) => onPatch({ minValue: e.target.value || null })}
          onBlur={(e) => onPatch({ minValue: normalizeDecimal(e.target.value) })}
          placeholder="—"
          inputMode="decimal"
          disabled={disabledRange}
          className={cn(
            'h-9 text-xs font-mono text-center',
            disabledRange && 'bg-slate-50 text-slate-400',
          )}
        />
      </td>

      {/* Tip (Sayısal/Görsel) */}
      <td className="px-2 py-2 align-middle">
        <div className="flex items-center gap-1.5">
          <Switch
            checked={row.hasNumericRange}
            onCheckedChange={(v) => onPatch({ hasNumericRange: v })}
            aria-label="Sayısal aralık"
          />
          <span className="text-[10px] uppercase tracking-wide text-slate-500 w-12">
            {row.hasNumericRange ? 'Sayısal' : 'Görsel'}
          </span>
        </div>
      </td>

      {/* Sil */}
      <td className="px-1 py-2 align-middle">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-9 w-9 text-slate-400 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Karakteri sil"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  )
}

export function CharacteristicsBuilder({ value, onChange, symbols }: BuilderProps) {
  const dndId = useId()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = value.findIndex((r) => r._key === active.id)
    const newIndex = value.findIndex((r) => r._key === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const moved = arrayMove(value, oldIndex, newIndex).map((r, i) => ({
      ...r,
      orderIndex: i + 1,
    }))
    onChange(moved)
  }

  function patchRow(key: string, patch: Partial<TemplateCharRow>) {
    onChange(value.map((r) => (r._key === key ? { ...r, ...patch } : r)))
  }

  function removeRow(key: string) {
    const filtered = value.filter((r) => r._key !== key)
    onChange(filtered.map((r, i) => ({ ...r, orderIndex: i + 1 })))
  }

  function addRow() {
    onChange([...value, makeEmptyChar(value.length + 1)])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold text-slate-700">
          Karakterler ({value.length})
        </Label>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-4 w-4 mr-1" />
          Karakter Ekle
        </Button>
      </div>

      {value.length === 0 ? (
        <div className="rounded-md border border-dashed bg-slate-50 p-8 text-center text-sm text-slate-500">
          Henüz karakter eklenmemiş.{' '}
          <span className="font-medium">+ Karakter Ekle</span> ile başlayın.
        </div>
      ) : (
        <div className="rounded-md border bg-white overflow-x-auto">
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <table className="w-full text-sm border-collapse min-w-[1180px]">
              <thead>
                {/* Section header satırı */}
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th rowSpan={2} className="px-2 py-2 w-16 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                    #
                  </th>
                  <th rowSpan={2} className="px-2 py-2 w-24 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                    Bölüm
                  </th>
                  <th rowSpan={2} className="px-2 py-2 w-36 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                    Muayene Aracı
                  </th>
                  <th rowSpan={2} className="px-2 py-2 w-28 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                    Sıklık
                  </th>
                  <th
                    colSpan={4}
                    className="px-2 py-1.5 text-center text-[10px] font-bold text-[#1B4F72] uppercase tracking-wider bg-[#1B4F72]/[0.06] border-b border-[#1B4F72]/15"
                  >
                    Karakter Özellikleri
                  </th>
                  <th rowSpan={2} className="px-2 py-2 w-28 text-center text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                    Tip
                  </th>
                  <th rowSpan={2} className="w-10"></th>
                </tr>
                {/* Sub-header satırı (Karakter Özellikleri altı) */}
                <tr className="bg-[#1B4F72]/[0.04] border-b border-slate-200">
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-[#1B4F72] uppercase tracking-wide min-w-[280px]">
                    Karakter
                  </th>
                  <th className="px-2 py-2 w-24 text-center text-[10px] font-semibold text-[#1B4F72] uppercase tracking-wide">
                    Nominal
                  </th>
                  <th className="px-2 py-2 w-24 text-center text-[10px] font-semibold text-[#1B4F72] uppercase tracking-wide">
                    Maksimum
                  </th>
                  <th className="px-2 py-2 w-24 text-center text-[10px] font-semibold text-[#1B4F72] uppercase tracking-wide">
                    Minimum
                  </th>
                </tr>
              </thead>
              <SortableContext
                items={value.map((r) => r._key)}
                strategy={verticalListSortingStrategy}
              >
                <tbody>
                  {value.map((row) => (
                    <SortableRow
                      key={row._key}
                      row={row}
                      onPatch={(patch) => patchRow(row._key, patch)}
                      onRemove={() => removeRow(row._key)}
                      symbols={symbols}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
        </div>
      )}
    </div>
  )
}

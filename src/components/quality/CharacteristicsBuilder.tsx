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
  // Stable client-side id for DnD; not sent to server
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
  }

  const disabledRange = !row.hasNumericRange

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex gap-2 rounded-md border bg-white p-2 transition-shadow',
        row.critical && 'bg-amber-50/60 border-amber-200',
        isDragging && 'shadow-lg ring-2 ring-[#1B4F72]/30 z-10',
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing px-1 text-slate-400 hover:text-slate-700 self-center"
        aria-label="Sırala"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Order index */}
      <div className="flex h-9 w-7 shrink-0 items-center justify-center text-xs font-semibold text-slate-500 tabular-nums">
        {row.orderIndex}
      </div>

      {/* Department */}
      <Input
        value={row.department ?? ''}
        onChange={(e) => onPatch({ department: e.target.value || null })}
        placeholder="Bölüm"
        className="h-9 w-20 text-xs"
      />

      {/* Inspection tool */}
      <Input
        value={row.inspectionTool ?? ''}
        onChange={(e) => onPatch({ inspectionTool: e.target.value || null })}
        placeholder="Muayene Aracı"
        className="h-9 w-32 text-xs"
      />

      {/* Sample freq */}
      <Input
        value={row.sampleFreq ?? ''}
        onChange={(e) => onPatch({ sampleFreq: e.target.value || null })}
        placeholder="Sıklık"
        className="h-9 w-24 text-xs"
      />

      {/* Critical */}
      <CritToggle value={row.critical} onChange={(v) => onPatch({ critical: v })} />

      {/* Symbol */}
      <SymbolPicker
        value={row.symbolId}
        onChange={(id) => onPatch({ symbolId: id })}
        symbols={symbols}
      />

      {/* Char name (wide) */}
      <Input
        value={row.charName}
        onChange={(e) => onPatch({ charName: e.target.value })}
        placeholder="Karakter (örn. 34, Ø9,9, Yüzey Kontrol)"
        className="h-9 flex-1 min-w-[160px] text-sm"
      />

      {/* Numeric range fields */}
      <Input
        value={row.nominal ?? ''}
        onChange={(e) => onPatch({ nominal: e.target.value || null })}
        placeholder="Nominal"
        inputMode="decimal"
        disabled={disabledRange}
        className={cn('h-9 w-20 text-xs font-mono', disabledRange && 'bg-slate-50')}
      />
      <Input
        value={row.maxValue ?? ''}
        onChange={(e) => onPatch({ maxValue: e.target.value || null })}
        placeholder="Maks"
        inputMode="decimal"
        disabled={disabledRange}
        className={cn('h-9 w-20 text-xs font-mono', disabledRange && 'bg-slate-50')}
      />
      <Input
        value={row.minValue ?? ''}
        onChange={(e) => onPatch({ minValue: e.target.value || null })}
        placeholder="Min"
        inputMode="decimal"
        disabled={disabledRange}
        className={cn('h-9 w-20 text-xs font-mono', disabledRange && 'bg-slate-50')}
      />

      {/* hasNumericRange toggle */}
      <div className="flex items-center gap-1.5 pl-1">
        <Switch
          checked={row.hasNumericRange}
          onCheckedChange={(v) => onPatch({ hasNumericRange: v })}
          aria-label="Sayısal aralık"
        />
        <span className="text-[10px] uppercase tracking-wide text-slate-500">
          {row.hasNumericRange ? 'Sayısal' : 'Görsel'}
        </span>
      </div>

      {/* Remove */}
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
    </div>
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
          Henüz karakter eklenmemiş. <span className="font-medium">+ Karakter Ekle</span>{' '}
          ile başlayın.
        </div>
      ) : (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={value.map((r) => r._key)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {value.map((row) => (
                <SortableRow
                  key={row._key}
                  row={row}
                  onPatch={(patch) => patchRow(row._key, patch)}
                  onRemove={() => removeRow(row._key)}
                  symbols={symbols}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

"use client"

import { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2, Pencil, Search } from "lucide-react"

interface SettingsListProps<T> {
  items: T[]
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  emptyMessage?: string
  noResultsMessage?: string
  renderItem: (item: T) => ReactNode
  onDelete?: (id: string) => void
  onEdit?: (item: T) => void
  getItemId: (item: T) => string
}

export function SettingsList<T>({
  items,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Ara...",
  emptyMessage = "Henüz öğe eklenmemiş",
  noResultsMessage = "Sonuç bulunamadı",
  renderItem,
  onDelete,
  onEdit,
  getItemId
}: SettingsListProps<T>) {
  return (
    <>
      <div className="p-3 border-b bg-background">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-9"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
      <div className="p-3 max-h-64 overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {searchValue ? noResultsMessage : emptyMessage}
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={getItemId(item)}
                className="flex items-center justify-between p-2 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">{renderItem(item)}</div>
                <div className="flex gap-1 ml-2">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(item)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(getItemId(item))}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// Color badge component for categories
interface ColorBadgeProps {
  color: string | null
  name: string
  count?: number
  countLabel?: string
}

export function ColorBadge({ color, name, count, countLabel = "öğe" }: ColorBadgeProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-4 h-4 rounded-full flex-shrink-0"
        style={{ backgroundColor: color || '#3b82f6' }}
      />
      <div>
        <span className="text-sm font-medium">{name}</span>
      </div>
      {count !== undefined && count > 0 && (
        <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
          {count} {countLabel}
        </span>
      )}
    </div>
  )
}

// Simple item with code
interface SimpleItemProps {
  name: string
  code?: string | null
  isActive?: boolean
}

export function SimpleItem({ name, code, isActive = true }: SimpleItemProps) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm font-medium ${!isActive ? 'text-muted-foreground' : ''}`}>
        {name}
      </span>
      {code && (
        <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
          {code}
        </span>
      )}
      {!isActive && (
        <span className="text-xs text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">
          Pasif
        </span>
      )}
    </div>
  )
}

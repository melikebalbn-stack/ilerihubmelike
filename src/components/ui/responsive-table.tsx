'use client'

import { ReactNode } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export interface ResponsiveColumn<T> {
  key: string
  label: string
  /** Primary field — shown as card title on mobile */
  primary?: boolean
  /** Render as badge on mobile (shown next to title) */
  badge?: boolean
  /** Actions column — rendered at bottom right of card */
  actions?: boolean
  /** Hidden on mobile cards (only shown in desktop table) */
  hideOnMobile?: boolean
  /** Custom render function */
  render?: (row: T) => ReactNode
}

interface ResponsiveTableProps<T> {
  columns: ResponsiveColumn<T>[]
  data: T[]
  /** Key field for React keys (default: 'id') */
  keyField?: string
  /** Empty state message */
  emptyMessage?: string
  /** Additional class for the container */
  className?: string
}

export function ResponsiveTable<T extends Record<string, any>>({
  columns,
  data,
  keyField = 'id',
  emptyMessage = 'Kayıt bulunamadı',
  className,
}: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile()

  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  // Desktop: normal table
  if (!isMobile) {
    return (
      <div className={cn('rounded-md border', className)}>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row[keyField]}>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    {col.render ? col.render(row) : (row[col.key] ?? '-')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  // Mobile: card list
  const primaryCol = columns.find((c) => c.primary)
  const badgeCol = columns.find((c) => c.badge)
  const actionsCol = columns.find((c) => c.actions)
  const detailCols = columns.filter(
    (c) => !c.primary && !c.badge && !c.actions && !c.hideOnMobile
  )

  return (
    <div className={cn('space-y-3', className)}>
      {data.map((row) => (
        <div
          key={row[keyField]}
          className="bg-white dark:bg-card rounded-xl border p-4 mb-3 shadow-sm space-y-2"
        >
          {/* Header: primary field + badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="text-base font-semibold text-gray-900 dark:text-foreground min-w-0">
              {primaryCol?.render
                ? primaryCol.render(row)
                : primaryCol
                  ? (row[primaryCol.key] ?? '-')
                  : null}
            </div>
            {badgeCol && (
              <div className="shrink-0">
                {badgeCol.render
                  ? badgeCol.render(row)
                  : (row[badgeCol.key] ?? '')}
              </div>
            )}
          </div>

          {/* Detail fields */}
          {detailCols.map((col) => {
            const value = col.render ? col.render(row) : (row[col.key] ?? '-')
            if (value === '-' || value === null || value === undefined) return null
            return (
              <div
                key={col.key}
                className="flex items-center justify-between"
              >
                <span className="text-sm text-gray-500 dark:text-muted-foreground">{col.label}</span>
                <span className="text-sm text-gray-800 dark:text-foreground text-right">{value}</span>
              </div>
            )
          })}

          {/* Actions */}
          {actionsCol && (
            <div className="flex items-center justify-end gap-2 pt-1 border-t">
              {actionsCol.render ? actionsCol.render(row) : null}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

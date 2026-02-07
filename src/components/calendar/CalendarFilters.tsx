'use client'

import { useState, useEffect } from 'react'
import { Filter, Check, X } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { NativeSelect as Select } from '@/components/ui/select'
import { CalendarEventType } from '@/generated/prisma'
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS, type CalendarFilters as Filters } from './CalendarView'

interface Department {
  id: string
  name: string
}

interface CalendarFiltersProps {
  filters: Filters
  onChange: (filters: Filters) => void
}

const ALL_EVENT_TYPES = Object.values(CalendarEventType)

export function CalendarFilters({ filters, onChange }: CalendarFiltersProps) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)

  // Departmanları yükle
  useEffect(() => {
    const fetchDepartments = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/departments')
        if (res.ok) {
          const data = await res.json()
          setDepartments(data.data || [])
        }
      } catch (error) {
        console.error('Departmanlar yüklenemedi:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchDepartments()
  }, [])

  const selectedTypes = filters.types || ALL_EVENT_TYPES

  const handleTypeToggle = (type: CalendarEventType) => {
    const newTypes = selectedTypes.includes(type)
      ? selectedTypes.filter((t) => t !== type)
      : [...selectedTypes, type]

    onChange({
      ...filters,
      types: newTypes.length === ALL_EVENT_TYPES.length ? undefined : newTypes,
    })
  }

  const handleSelectAll = () => {
    onChange({
      ...filters,
      types: undefined, // undefined = tümü seçili
    })
  }

  const handleDeselectAll = () => {
    onChange({
      ...filters,
      types: [],
    })
  }

  const handleDepartmentChange = (departmentId: string) => {
    onChange({
      ...filters,
      departmentId: departmentId || null,
    })
  }

  const isAllSelected = !filters.types || filters.types.length === ALL_EVENT_TYPES.length
  const isNoneSelected = filters.types?.length === 0

  return (
    <div className="bg-background border rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Filter className="h-4 w-4" />
        Filtreler
      </div>

      {/* Etkinlik Tipleri */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            Etkinlik Tipleri
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              disabled={isAllSelected}
              className="h-7 px-2 text-xs"
            >
              <Check className="h-3 w-3 mr-1" />
              Tümünü Seç
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeselectAll}
              disabled={isNoneSelected}
              className="h-7 px-2 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Tümünü Kaldır
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {ALL_EVENT_TYPES.map((type) => {
            const isChecked = selectedTypes.includes(type)
            const color = EVENT_TYPE_COLORS[type]
            const label = EVENT_TYPE_LABELS[type]

            return (
              <div key={type} className="flex items-center space-x-2">
                <Checkbox
                  id={`type-${type}`}
                  checked={isChecked}
                  onCheckedChange={() => handleTypeToggle(type)}
                />
                <Label
                  htmlFor={`type-${type}`}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  {label}
                </Label>
              </div>
            )
          })}
        </div>
      </div>

      {/* Departman Filtresi */}
      <div className="space-y-2 pt-2 border-t">
        <Label htmlFor="department-filter" className="text-sm font-medium text-muted-foreground">
          Departman
        </Label>
        <Select
          id="department-filter"
          value={filters.departmentId || ''}
          onChange={(e) => handleDepartmentChange(e.target.value)}
          disabled={loading}
        >
          <option value="">Tüm departmanlar</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </Select>
      </div>

      {/* Aktif filtre sayısı */}
      {(filters.types?.length !== undefined && filters.types.length < ALL_EVENT_TYPES.length) ||
      filters.departmentId ? (
        <div className="pt-2 border-t">
          <Button
            variant="link"
            size="sm"
            onClick={() => onChange({ types: undefined, departmentId: null })}
            className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
          >
            Filtreleri temizle
          </Button>
        </div>
      ) : null}
    </div>
  )
}

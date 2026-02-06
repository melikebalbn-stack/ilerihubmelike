'use client'

import { Search, LayoutGrid, List, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { NativeSelect as Select } from '@/components/ui/select'

interface EmployeeFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  department: string
  onDepartmentChange: (value: string) => void
  location: string
  onLocationChange: (value: string) => void
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
  departments: string[]
  locations: string[]
}

export function EmployeeFilters({
  search,
  onSearchChange,
  department,
  onDepartmentChange,
  location,
  onLocationChange,
  viewMode,
  onViewModeChange,
  departments,
  locations,
}: EmployeeFiltersProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      {/* Sol: Arama ve Filtreler */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-1">
        {/* Arama */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="İsim, departman veya unvan ara..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Departman Filtre */}
        <Select
          value={department}
          onChange={(e) => onDepartmentChange(e.target.value)}
          className="w-full sm:w-48"
        >
          <option value="">Tüm Departmanlar</option>
          {departments.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </Select>

        {/* Lokasyon Filtre */}
        <Select
          value={location}
          onChange={(e) => onLocationChange(e.target.value)}
          className="w-full sm:w-48"
        >
          <option value="">Tüm Lokasyonlar</option>
          {locations.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </Select>
      </div>

      {/* Sağ: Görünüm Değiştir */}
      <div className="flex items-center gap-2">
        <Button
          variant={viewMode === 'grid' ? 'default' : 'outline'}
          size="icon"
          onClick={() => onViewModeChange('grid')}
          title="Kart Görünümü"
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button
          variant={viewMode === 'list' ? 'default' : 'outline'}
          size="icon"
          onClick={() => onViewModeChange('list')}
          title="Liste Görünümü"
        >
          <List className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

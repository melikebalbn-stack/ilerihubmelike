"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, Filter, Plus, Clock } from "lucide-react"
import type { Category, SuggestionViewMode } from "@/types/suggestions"

interface SuggestionFiltersProps {
  viewMode: SuggestionViewMode
  onViewModeChange: (mode: SuggestionViewMode) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedCategory: string
  onCategoryChange: (categoryId: string) => void
  categories: Category[]
  onCreateNew: () => void
}

export function SuggestionFilters({
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  categories,
  onCreateNew,
}: SuggestionFiltersProps) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-1 sm:gap-2 overflow-x-auto scrollbar-hide pb-1 sm:pb-0">
          <Button
            variant={viewMode === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewModeChange('all')}
            className="text-xs sm:text-sm whitespace-nowrap"
          >
            Tümü
          </Button>
          <Button
            variant={viewMode === 'my' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewModeChange('my')}
            className="text-xs sm:text-sm whitespace-nowrap"
          >
            <span className="hidden sm:inline">Önerilerim</span>
            <span className="sm:hidden">Benim</span>
          </Button>
          <Button
            variant={viewMode === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewModeChange('pending')}
            className="text-xs sm:text-sm whitespace-nowrap"
          >
            <span className="hidden sm:inline">Bekleyenler</span>
            <span className="sm:hidden">Bekliyor</span>
          </Button>
          <Button
            variant={viewMode === 'awaiting_my_approval' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewModeChange('awaiting_my_approval')}
            className="border-orange-200 text-orange-600 hover:bg-orange-50 text-xs sm:text-sm whitespace-nowrap"
          >
            <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
            <span className="hidden sm:inline">Onayım Beklenen</span>
            <span className="sm:hidden">Onay</span>
          </Button>
        </div>
        <Button className="gap-2 self-end sm:self-auto" size="sm" onClick={onCreateNew}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Yeni Öneri</span>
          <span className="sm:hidden">Ekle</span>
        </Button>
      </div>

      {/* Search & Category Filter */}
      <Card>
        <CardContent className="p-3 sm:pt-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Öneri ara..."
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
            <Select value={selectedCategory || "all"} onValueChange={(v) => onCategoryChange(v === "all" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

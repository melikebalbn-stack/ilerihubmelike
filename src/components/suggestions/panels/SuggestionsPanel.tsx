"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Lightbulb, Plus, Search, Eye, ChevronRight, MessageSquare, Bell } from "lucide-react"
import { cn } from "@/lib/utils"
import { statusConfig, priorityConfig, formatDate } from "@/lib/suggestions-config"
import type { Suggestion, Category, SuggestionViewMode, SuggestionUpdate } from "@/types/suggestions"

interface SuggestionsPanelProps {
  suggestions: Suggestion[]
  categories: Category[]
  loading: boolean
  viewMode: SuggestionViewMode
  searchQuery: string
  selectedCategory: string
  pendingApprovalCount: number
  mySuggestionUpdates: SuggestionUpdate[]
  onViewModeChange: (mode: SuggestionViewMode) => void
  onSearchChange: (query: string) => void
  onCategoryChange: (categoryId: string) => void
  onCreateNew: () => void
}

export function SuggestionsPanel({
  suggestions,
  categories,
  loading,
  viewMode,
  searchQuery,
  selectedCategory,
  pendingApprovalCount,
  mySuggestionUpdates,
  onViewModeChange,
  onSearchChange,
  onCategoryChange,
  onCreateNew
}: SuggestionsPanelProps) {
  const router = useRouter()

  // Filter suggestions
  const filteredSuggestions = suggestions.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.suggestionNumber.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 sm:gap-2">
          <Button
            variant={viewMode === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewModeChange('all')}
            className="text-xs sm:text-sm"
          >
            Tümü
          </Button>
          <Button
            variant={viewMode === 'my' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewModeChange('my')}
            className="text-xs sm:text-sm"
          >
            <span className="hidden sm:inline">Önerilerim</span>
            <span className="sm:hidden">Benim</span>
          </Button>
          <Button
            variant={viewMode === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewModeChange('pending')}
            className="text-xs sm:text-sm"
          >
            <span className="hidden sm:inline">Bekleyenler</span>
            <span className="sm:hidden">Bekliyor</span>
          </Button>
          <Button
            variant={viewMode === 'awaiting_my_approval' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewModeChange('awaiting_my_approval')}
            className="text-xs sm:text-sm relative"
          >
            <span className="hidden sm:inline">Onayım Beklenen</span>
            <span className="sm:hidden">Onay</span>
            {pendingApprovalCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                {pendingApprovalCount}
              </span>
            )}
          </Button>
        </div>
        <Button className="gap-2 self-end sm:self-auto" size="sm" onClick={onCreateNew}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Yeni Öneri</span>
          <span className="sm:hidden">Ekle</span>
        </Button>
      </div>

      {/* My Updates Alert */}
      {mySuggestionUpdates.length > 0 && viewMode !== 'awaiting_my_approval' && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <Bell className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-sm mb-2">Önerilerimde Güncelleme Var</h4>
                <div className="space-y-1.5">
                  {mySuggestionUpdates.slice(0, 3).map(update => (
                    <div
                      key={update.id}
                      className="flex items-center gap-2 text-xs cursor-pointer hover:bg-blue-100/50 p-1.5 rounded"
                      onClick={() => router.push(`/suggestions/${update.id}`)}
                    >
                      <span className="font-mono text-muted-foreground">{update.suggestionNumber}</span>
                      <span className="truncate flex-1">{update.title}</span>
                      <Badge className={cn(
                        "text-[10px]",
                        update.statusType === 'success' ? 'bg-green-100 text-green-800' :
                        update.statusType === 'error' ? 'bg-red-100 text-red-800' :
                        update.statusType === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      )}>
                        {update.statusLabel}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Öneri ara..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedCategory} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Kategoriler</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Suggestions List */}
      <div className="space-y-3 sm:space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="classic-spinner" />
          </div>
        ) : filteredSuggestions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Lightbulb className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Henüz öneri bulunmuyor</p>
              <Button className="mt-4" onClick={onCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                İlk Öneriyi Oluştur
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredSuggestions.map(suggestion => {
            const status = statusConfig[suggestion.status] || statusConfig.SUBMITTED
            const priority = priorityConfig[suggestion.priority] || priorityConfig.NORMAL
            const StatusIcon = status.icon

            return (
              <Card key={suggestion.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                        <span className="text-[10px] sm:text-xs text-muted-foreground font-mono">
                          {suggestion.suggestionNumber}
                        </span>
                        {suggestion.category && (
                          <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded bg-gray-100">
                            {suggestion.category.name}
                          </span>
                        )}
                        <Badge className={cn(priority.color, "text-[10px] sm:text-xs")} variant="secondary">
                          {priority.label}
                        </Badge>
                        <Badge className={cn(status.color, "text-[10px] sm:text-xs sm:hidden")}>
                          <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
                          {status.label}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-sm sm:text-lg mb-1">{suggestion.title}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mb-2">
                        {suggestion.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground">
                        <span className="truncate max-w-[80px] sm:max-w-none">
                          {suggestion.isAnonymous ? 'Anonim' : suggestion.submittedByName}
                        </span>
                        <span>• {formatDate(suggestion.submittedAt)}</span>
                        {(suggestion._count?.comments ?? 0) > 0 && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {suggestion._count?.comments}
                          </span>
                        )}
                        {suggestion.estimatedSavings && (
                          <span className="text-green-600 font-medium">
                            ~{suggestion.estimatedSavings.toLocaleString('tr-TR')} ₺
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="hidden sm:flex flex-col items-end gap-2">
                      <Badge className={status.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => router.push(`/suggestions/${suggestion.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Detay
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground sm:hidden self-end"
                      onClick={() => router.push(`/suggestions/${suggestion.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Detay
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}

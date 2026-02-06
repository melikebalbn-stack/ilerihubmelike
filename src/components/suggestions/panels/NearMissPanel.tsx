"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Plus, Eye, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { nearMissStatusConfig, severityConfig, nearMissTypeConfig, formatDate } from "@/lib/suggestions-config"
import type { NearMiss, NearMissViewMode } from "@/types/suggestions"

interface NearMissPanelProps {
  nearMisses: NearMiss[]
  loading: boolean
  viewMode: NearMissViewMode
  onViewModeChange: (mode: NearMissViewMode) => void
  onCreateNew: () => void
}

export function NearMissPanel({
  nearMisses,
  loading,
  viewMode,
  onViewModeChange,
  onCreateNew
}: NearMissPanelProps) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header Actions */}
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
            <span className="hidden sm:inline">Bildirimlerim</span>
            <span className="sm:hidden">Benim</span>
          </Button>
          <Button
            variant={viewMode === 'open' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewModeChange('open')}
            className="text-xs sm:text-sm whitespace-nowrap"
          >
            <span className="hidden sm:inline">Açık Olanlar</span>
            <span className="sm:hidden">Açık</span>
          </Button>
        </div>
        <Button
          className="gap-1 sm:gap-2 bg-orange-600 hover:bg-orange-700 text-xs sm:text-sm self-end sm:self-auto"
          size="sm"
          onClick={onCreateNew}
        >
          <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Ramak Kala Bildir</span>
          <span className="sm:hidden">Bildir</span>
        </Button>
      </div>

      {/* Near Miss List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="classic-spinner" />
          </div>
        ) : nearMisses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Henüz ramak kala bildirimi bulunmuyor</p>
              <Button
                className="mt-4 bg-orange-600 hover:bg-orange-700"
                onClick={onCreateNew}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                İlk Bildirimi Oluştur
              </Button>
            </CardContent>
          </Card>
        ) : (
          nearMisses.map(report => {
            const status = nearMissStatusConfig[report.status] || nearMissStatusConfig.REPORTED
            const severity = severityConfig[report.potentialSeverity] || severityConfig.MODERATE
            const eventType = nearMissTypeConfig[report.eventType] || 'Diğer'

            return (
              <Card key={report.id} className="hover:shadow-md transition-shadow border-l-4 border-l-orange-500">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                        <span className="text-[10px] sm:text-xs text-muted-foreground font-mono">
                          {report.reportNumber}
                        </span>
                        <Badge variant="outline" className="text-[10px] sm:text-xs">{eventType}</Badge>
                        <Badge className={cn(severity.color, "text-[10px] sm:text-xs")}>{severity.label}</Badge>
                        <Badge className={cn(status.color, "text-[10px] sm:text-xs sm:hidden")}>{status.label}</Badge>
                      </div>
                      <h3 className="font-semibold text-sm sm:text-lg mb-1">{report.title}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mb-2">
                        {report.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground">
                        <span className="truncate max-w-[80px] sm:max-w-none">{report.reportedByName}</span>
                        <span className="hidden sm:inline">• {report.eventLocation}</span>
                        <span>• {formatDate(report.eventDate)}</span>
                        {(report._count?.actions ?? 0) > 0 && (
                          <span className="text-orange-600 font-medium">
                            {report._count?.actions} aksiyon
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="hidden sm:flex flex-col items-end gap-2">
                      <Badge className={status.color}>{status.label}</Badge>
                      <Button variant="ghost" size="sm" className="text-muted-foreground">
                        <Eye className="h-4 w-4 mr-1" />
                        Detay
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                    <Button variant="ghost" size="sm" className="text-muted-foreground sm:hidden self-end">
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

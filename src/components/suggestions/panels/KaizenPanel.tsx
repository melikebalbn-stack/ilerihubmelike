"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCcw, Plus, Eye, ChevronRight, HelpCircle, Paperclip } from "lucide-react"
import { cn } from "@/lib/utils"
import { pdcaConfig, kaizenStatusConfig, priorityConfig, formatDate } from "@/lib/suggestions-config"
import type { KaizenProject, KaizenViewMode } from "@/types/suggestions"

interface KaizenPanelProps {
  projects: KaizenProject[]
  loading: boolean
  viewMode: KaizenViewMode
  onViewModeChange: (mode: KaizenViewMode) => void
  onCreateNew: () => void
  onOpenGuide: () => void
  onView: (id: string) => void
}

export function KaizenPanel({
  projects,
  loading,
  viewMode,
  onViewModeChange,
  onCreateNew,
  onOpenGuide,
  onView
}: KaizenPanelProps) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-2">
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
            Projelerim
          </Button>
        </div>
        <div className="flex gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            className="gap-1 sm:gap-2 text-teal-600 border-teal-300 hover:bg-teal-50 text-xs sm:text-sm"
            onClick={onOpenGuide}
          >
            <HelpCircle className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Kaizen Kılavuzu</span>
            <span className="sm:hidden">Kılavuz</span>
          </Button>
          <Button className="gap-1 sm:gap-2 text-xs sm:text-sm" size="sm" onClick={onCreateNew}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Yeni Kaizen</span>
            <span className="sm:hidden">Ekle</span>
          </Button>
        </div>
      </div>

      {/* Projects List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="classic-spinner" />
          </div>
        ) : projects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <RefreshCcw className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Henüz Kaizen projesi bulunmuyor</p>
              <Button className="mt-4" onClick={onCreateNew}>
                <Plus className="h-4 w-4 mr-2" />
                İlk Kaizen Projesini Başlat
              </Button>
            </CardContent>
          </Card>
        ) : (
          projects.map(project => {
            const pdca = pdcaConfig[project.pdcaStage] || pdcaConfig.PLAN
            const status = kaizenStatusConfig[project.status] || kaizenStatusConfig.DRAFT
            const priority = priorityConfig[project.priority] || priorityConfig.NORMAL

            return (
              <Card key={project.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                        <span className="text-[10px] sm:text-xs text-muted-foreground font-mono">
                          {project.projectNumber}
                        </span>
                        <Badge className={cn(pdca.color, "text-[10px] sm:text-xs")}>{pdca.label}</Badge>
                        <Badge className={cn(priority.color, "text-[10px] sm:text-xs")} variant="secondary">
                          {priority.label}
                        </Badge>
                        <Badge className={cn(status.color, "text-[10px] sm:text-xs sm:hidden")}>{status.label}</Badge>
                      </div>
                      <h3 className="font-semibold text-sm sm:text-lg mb-1">{project.title}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mb-2">
                        {project.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground">
                        {project.teamLeaderName && (
                          <span className="truncate max-w-[100px] sm:max-w-none">Lider: {project.teamLeaderName}</span>
                        )}
                        {project.department && <span className="hidden sm:inline">• {project.department}</span>}
                        <span>• {formatDate(project.createdAt)}</span>
                        {(project._count?.attachments ?? 0) > 0 && (
                          <span className="flex items-center gap-1">
                            <Paperclip className="h-3 w-3" />
                            {project._count?.attachments}
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

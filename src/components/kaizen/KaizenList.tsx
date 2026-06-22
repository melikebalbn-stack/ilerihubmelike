"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCcw, Plus } from "lucide-react"
import { KaizenCard } from "./KaizenCard"
import type { KaizenProject, KaizenViewMode } from "@/types/suggestions"

interface KaizenListProps {
  projects: KaizenProject[]
  loading: boolean
  viewMode: KaizenViewMode
  onViewModeChange: (mode: KaizenViewMode) => void
  onView: (id: string) => void
  onCreateNew: () => void
  onOpenGuide: () => void
}

export function KaizenList({
  projects,
  loading,
  viewMode,
  onViewModeChange,
  onView,
  onCreateNew,
  onOpenGuide
}: KaizenListProps) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewModeChange('all')}
          >
            Tümü
          </Button>
          <Button
            variant={viewMode === 'my' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewModeChange('my')}
          >
            Projelerim
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onOpenGuide}>
            PDCA Rehberi
          </Button>
          <Button className="gap-2" size="sm" onClick={onCreateNew}>
            <Plus className="h-4 w-4" />
            Yeni Proje
          </Button>
        </div>
      </div>

      {/* List */}
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
              İlk Projeyi Başlat
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {projects.map(project => (
            <KaizenCard
              key={project.id}
              project={project}
              onView={onView}
            />
          ))}
        </div>
      )}
    </div>
  )
}

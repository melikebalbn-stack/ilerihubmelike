"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Plus } from "lucide-react"
import { NearMissCard } from "./NearMissCard"
import type { NearMiss, NearMissViewMode } from "@/types/suggestions"

interface NearMissListProps {
  nearMisses: NearMiss[]
  loading: boolean
  viewMode: NearMissViewMode
  onViewModeChange: (mode: NearMissViewMode) => void
  onView: (id: string) => void
  onCreateNew: () => void
}

export function NearMissList({
  nearMisses,
  loading,
  viewMode,
  onViewModeChange,
  onView,
  onCreateNew
}: NearMissListProps) {
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
            Bildirimlerim
          </Button>
          <Button
            variant={viewMode === 'open' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewModeChange('open')}
          >
            Açık Olanlar
          </Button>
        </div>
        <Button className="gap-2" size="sm" onClick={onCreateNew}>
          <Plus className="h-4 w-4" />
          Ramak Kala Bildir
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="classic-spinner" />
        </div>
      ) : nearMisses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Henüz ramak kala bildirimi bulunmuyor</p>
            <Button className="mt-4" onClick={onCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              İlk Bildirimi Oluştur
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {nearMisses.map(nearMiss => (
            <NearMissCard
              key={nearMiss.id}
              nearMiss={nearMiss}
              onView={onView}
            />
          ))}
        </div>
      )}
    </div>
  )
}

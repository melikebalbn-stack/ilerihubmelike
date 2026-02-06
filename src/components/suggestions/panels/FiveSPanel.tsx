"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ClipboardCheck, ClipboardList, Plus, Eye, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/suggestions-config"
import { toast } from "sonner"
import type { FiveSAudit, FiveSArea, FiveSViewMode } from "@/types/suggestions"

interface FiveSPanelProps {
  audits: FiveSAudit[]
  areas: FiveSArea[]
  loading: boolean
  actionPlanLoading: boolean
  viewMode: FiveSViewMode
  onViewModeChange: (mode: FiveSViewMode) => void
  onCreateArea: () => void
  onCreateAudit: () => void
  onOpenGuide: () => void
  onOpenAreaDetail: (area: FiveSArea) => void
  onOpenActionPlan: (audit: FiveSAudit) => void
}

export function FiveSPanel({
  audits,
  areas,
  loading,
  actionPlanLoading,
  viewMode,
  onViewModeChange,
  onCreateArea,
  onCreateAudit,
  onOpenGuide,
  onOpenAreaDetail,
  onOpenActionPlan
}: FiveSPanelProps) {
  const handleStartAudit = () => {
    if (areas.length === 0) {
      toast.error('Önce bir denetim alanı tanımlamalısınız')
      onCreateArea()
    } else {
      onCreateAudit()
    }
  }

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
            <span className="hidden sm:inline">Denetimlerim</span>
            <span className="sm:hidden">Benim</span>
          </Button>
        </div>
        <div className="flex gap-1 sm:gap-2 self-end sm:self-auto overflow-x-auto scrollbar-hide">
          <Button
            variant="outline"
            size="sm"
            className="gap-1 sm:gap-2 text-blue-600 border-blue-300 hover:bg-blue-50 text-xs sm:text-sm whitespace-nowrap"
            onClick={onOpenGuide}
          >
            <HelpCircle className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">5S Kılavuzu</span>
            <span className="sm:hidden">Kılavuz</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 sm:gap-2 text-xs sm:text-sm whitespace-nowrap"
            onClick={onCreateArea}
          >
            <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Alan Tanımla</span>
            <span className="sm:hidden">Alan</span>
          </Button>
          <Button
            size="sm"
            className="gap-1 sm:gap-2 bg-emerald-600 hover:bg-emerald-700 text-xs sm:text-sm whitespace-nowrap"
            onClick={handleStartAudit}
          >
            <ClipboardCheck className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Denetim Başlat</span>
            <span className="sm:hidden">Denetim</span>
          </Button>
        </div>
      </div>

      {/* 5S Info Cards */}
      <div className="grid grid-cols-5 gap-1 sm:gap-4">
        {['Seiri (Ayıkla)', 'Seiton (Düzenle)', 'Seiso (Temizle)', 'Seiketsu (Standartlaştır)', 'Shitsuke (Sürdür)'].map((s, i) => (
          <Card key={i} className="text-center">
            <CardContent className="p-2 sm:p-4">
              <div className="text-lg sm:text-3xl font-bold mb-0.5 sm:mb-1">{i + 1}S</div>
              <p className="text-[8px] sm:text-xs text-muted-foreground truncate">{s.split(' ')[0]}</p>
              <p className="text-[7px] sm:text-[10px] text-muted-foreground hidden sm:block">
                {s.match(/\(([^)]+)\)/)?.[1]}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 5S Areas */}
      {areas.length > 0 && (
        <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-base sm:text-lg">Denetim Alanları</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {areas.map(area => (
                <div
                  key={area.id}
                  className="p-2.5 sm:p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors hover:border-emerald-300"
                  onClick={() => onOpenAreaDetail(area)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm sm:text-base truncate mr-2">{area.name}</span>
                    <Badge variant="outline" className="text-[10px] sm:text-xs flex-shrink-0">{area.code}</Badge>
                  </div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground truncate">
                    {area.department && <span>{area.department}</span>}
                    {area.location && <span> • {area.location}</span>}
                  </div>
                  <div className="flex items-center justify-between mt-1.5 sm:mt-2 text-[10px] sm:text-xs">
                    <span className="text-muted-foreground">{area._count?.audits || 0} denetim</span>
                    {area.audits && area.audits[0] && (
                      <span className={cn(
                        "font-medium",
                        area.audits[0].totalScore >= 80 ? "text-green-600" :
                        area.audits[0].totalScore >= 60 ? "text-yellow-600" : "text-red-600"
                      )}>
                        Son: {area.audits[0].totalScore}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audits List or Empty State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="classic-spinner" />
        </div>
      ) : audits.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">5S Denetim Modülü</h3>
            <p className="text-muted-foreground mb-4">
              {areas.length === 0
                ? 'Denetim alanları tanımlandıktan sonra 5S denetimleri başlatılabilir.'
                : 'Henüz denetim yapılmamış. İlk 5S denetimini başlatın.'}
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={onCreateArea}>
                <Plus className="h-4 w-4 mr-2" />
                Alan Tanımla
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleStartAudit}>
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Denetim Başlat
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          <h3 className="font-semibold text-sm sm:text-base">Son Denetimler</h3>
          {audits.map(audit => (
            <Card key={audit.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                      <span className="text-[10px] sm:text-xs text-muted-foreground font-mono">
                        {audit.auditNumber}
                      </span>
                      <Badge variant="outline" className="text-[10px] sm:text-xs">{audit.area?.name}</Badge>
                      <span className={cn(
                        "text-sm sm:text-lg font-bold sm:hidden",
                        audit.totalScore >= 80 ? "text-green-600" :
                        audit.totalScore >= 60 ? "text-yellow-600" : "text-red-600"
                      )}>
                        {audit.totalScore} puan
                      </span>
                    </div>
                    <p className="text-[10px] sm:text-sm text-muted-foreground">
                      <span className="hidden sm:inline">Denetçi: </span>
                      {audit.auditorName} • {formatDate(audit.auditDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="text-center hidden sm:block">
                      <div className={cn(
                        "text-2xl font-bold",
                        audit.totalScore >= 80 ? "text-green-600" :
                        audit.totalScore >= 60 ? "text-yellow-600" : "text-red-600"
                      )}>
                        {audit.totalScore}
                      </div>
                      <p className="text-xs text-muted-foreground">Puan</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenActionPlan(audit)}
                      disabled={actionPlanLoading}
                      className="text-xs sm:text-sm"
                    >
                      <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      Detay
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-orange-600 border-orange-300 hover:bg-orange-50 text-xs sm:text-sm"
                      onClick={() => onOpenActionPlan(audit)}
                      disabled={actionPlanLoading}
                    >
                      <ClipboardList className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      <span className="hidden sm:inline">Aksiyon Planı</span>
                      <span className="sm:hidden">Aksiyon</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

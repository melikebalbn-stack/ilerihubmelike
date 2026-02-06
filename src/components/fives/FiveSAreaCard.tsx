"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Eye, ClipboardCheck } from "lucide-react"
import type { FiveSArea } from "@/types/suggestions"

interface FiveSAreaCardProps {
  area: FiveSArea
  onViewDetail: (area: FiveSArea) => void
  onStartAudit: (areaId: string) => void
}

export function FiveSAreaCard({ area, onViewDetail, onStartAudit }: FiveSAreaCardProps) {
  const lastAudit = area.audits?.[0]
  const lastScore = lastAudit?.totalScore

  const getScoreColor = (score?: number) => {
    if (!score) return 'text-gray-400'
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground font-mono">{area.code}</span>
              <span className="text-xs text-muted-foreground">• {area._count?.audits || 0} denetim</span>
            </div>
            <h3 className="font-semibold text-sm sm:text-lg">{area.name}</h3>
            {area.description && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{area.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
              {area.department && <span>{area.department}</span>}
              {area.responsibleName && <span>• {area.responsibleName}</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {lastScore !== undefined && (
              <div className={`text-2xl font-bold ${getScoreColor(lastScore)}`}>
                {lastScore}
              </div>
            )}
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => onViewDetail(area)}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={() => onStartAudit(area.id)}>
                <ClipboardCheck className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

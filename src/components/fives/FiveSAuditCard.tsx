"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, ClipboardList } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/suggestions-config"
import type { FiveSAudit } from "@/types/suggestions"

interface FiveSAuditCardProps {
  audit: FiveSAudit
  onView: (id: string) => void
  onOpenActionPlan: (audit: FiveSAudit) => void
}

const getScoreColor = (score: number) => {
  if (score >= 80) return 'text-green-600 bg-green-100'
  if (score >= 60) return 'text-yellow-600 bg-yellow-100'
  return 'text-red-600 bg-red-100'
}

export function FiveSAuditCard({ audit, onView, onOpenActionPlan }: FiveSAuditCardProps) {
  const statusColor = audit.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
              <span className="text-[10px] sm:text-xs text-muted-foreground font-mono">
                {audit.auditNumber}
              </span>
              {audit.area && (
                <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-600">
                  {audit.area.name}
                </span>
              )}
              <Badge className={cn(statusColor, "text-[10px] sm:text-xs")}>
                {audit.status === 'COMPLETED' ? 'Tamamlandı' : 'Devam Ediyor'}
              </Badge>
            </div>

            {/* 5S Scores */}
            <div className="flex flex-wrap gap-1 sm:gap-2 my-2">
              <span className={cn("text-xs px-2 py-0.5 rounded", getScoreColor(audit.seiriScore || 0))}>
                1S: {audit.seiriScore}
              </span>
              <span className={cn("text-xs px-2 py-0.5 rounded", getScoreColor(audit.seitonScore || 0))}>
                2S: {audit.seitonScore}
              </span>
              <span className={cn("text-xs px-2 py-0.5 rounded", getScoreColor(audit.seisoScore || 0))}>
                3S: {audit.seisoScore}
              </span>
              <span className={cn("text-xs px-2 py-0.5 rounded", getScoreColor(audit.seiketsuScore || 0))}>
                4S: {audit.seiketsuScore}
              </span>
              <span className={cn("text-xs px-2 py-0.5 rounded", getScoreColor(audit.shitsukeScore || 0))}>
                5S: {audit.shitsukeScore}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground">
              <span>{audit.auditorName}</span>
              <span>• {formatDate(audit.auditDate)}</span>
            </div>
          </div>
          <div className="flex sm:flex-col items-center gap-2 self-end sm:self-start">
            <div className={cn(
              "text-lg sm:text-xl font-bold px-2 py-1 rounded",
              getScoreColor(audit.totalScore)
            )}>
              {audit.totalScore}
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => onOpenActionPlan(audit)} title="Aksiyon Planı">
                <ClipboardList className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onView(audit.id)}>
                <Eye className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

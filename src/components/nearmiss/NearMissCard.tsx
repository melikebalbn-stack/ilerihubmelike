"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import { nearMissStatusConfig, severityConfig, nearMissTypeConfig, formatDate } from "@/lib/suggestions-config"
import type { NearMiss } from "@/types/suggestions"

interface NearMissCardProps {
  nearMiss: NearMiss
  onView: (id: string) => void
}

export function NearMissCard({ nearMiss, onView }: NearMissCardProps) {
  const status = nearMissStatusConfig[nearMiss.status] || nearMissStatusConfig.REPORTED
  const severity = severityConfig[nearMiss.potentialSeverity] || severityConfig.MODERATE
  const eventType = nearMissTypeConfig[nearMiss.eventType] || nearMiss.eventType

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
              <span className="text-[10px] sm:text-xs text-muted-foreground font-mono">
                {nearMiss.reportNumber}
              </span>
              <Badge className={cn(severity.color, "text-[10px] sm:text-xs")} variant="secondary">
                {severity.label}
              </Badge>
              <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                {eventType}
              </span>
            </div>
            <h3 className="font-semibold text-sm sm:text-lg mb-1">{nearMiss.title}</h3>
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mb-2">
              {nearMiss.description}
            </p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground">
              <span>{nearMiss.reportedByName}</span>
              <span>• {nearMiss.eventLocation}</span>
              <span>• {formatDate(nearMiss.eventDate)}</span>
            </div>
          </div>
          <div className="flex sm:flex-col items-center gap-2 self-end sm:self-start">
            <Badge className={cn(status.color, "text-[10px] sm:text-xs")}>
              {status.label}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => onView(nearMiss.id)}>
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

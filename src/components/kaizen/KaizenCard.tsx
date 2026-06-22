"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import { kaizenStatusConfig, pdcaConfig, priorityConfig, formatDate } from "@/lib/suggestions-config"
import type { KaizenProject } from "@/types/suggestions"

interface KaizenCardProps {
  project: KaizenProject
  onView: (id: string) => void
}

export function KaizenCard({ project, onView }: KaizenCardProps) {
  const status = kaizenStatusConfig[project.status] || kaizenStatusConfig.DRAFT
  const pdca = pdcaConfig[project.pdcaStage] || pdcaConfig.PLAN
  const priority = priorityConfig[project.priority] || priorityConfig.NORMAL

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
              <span className="text-[10px] sm:text-xs text-muted-foreground font-mono">
                {project.projectNumber}
              </span>
              <Badge className={cn(pdca.color, "text-[10px] sm:text-xs")} variant="secondary">
                {pdca.label}
              </Badge>
              <Badge className={cn(priority.color, "text-[10px] sm:text-xs")} variant="secondary">
                {priority.label}
              </Badge>
            </div>
            <h3 className="font-semibold text-sm sm:text-lg mb-1">{project.title}</h3>
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mb-2">
              {project.description}
            </p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground">
              {project.teamLeaderName && <span>{project.teamLeaderName}</span>}
              {project.department && <span className="hidden sm:inline">• {project.department}</span>}
              <span>• {formatDate(project.createdAt)}</span>
            </div>
          </div>
          <div className="flex sm:flex-col items-center gap-2 self-end sm:self-start">
            <Badge className={cn(status.color, "text-[10px] sm:text-xs")}>
              {status.label}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => onView(project.id)}>
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

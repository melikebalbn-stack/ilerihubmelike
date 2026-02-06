"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { statusConfig, priorityConfig, formatDate } from "@/lib/suggestions-config"
import type { Suggestion } from "@/types/suggestions"

interface SuggestionCardProps {
  suggestion: Suggestion
  onView: (id: string) => void
}

export function SuggestionCard({ suggestion, onView }: SuggestionCardProps) {
  const status = statusConfig[suggestion.status] || statusConfig.SUBMITTED
  const StatusIcon = status.icon
  const priority = priorityConfig[suggestion.priority] || priorityConfig.NORMAL

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
              <span className="text-[10px] sm:text-xs text-muted-foreground font-mono">
                {suggestion.suggestionNumber}
              </span>
              {suggestion.category && (
                <span
                  className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: suggestion.category.color + '20',
                    color: suggestion.category.color
                  }}
                >
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
              <span className="truncate max-w-[100px] sm:max-w-none">{suggestion.submittedByName}</span>
              {suggestion.submittedByDept && <span className="hidden sm:inline">• {suggestion.submittedByDept}</span>}
              <span>• {formatDate(suggestion.submittedAt)}</span>
              {(suggestion._count?.comments ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {suggestion._count?.comments}
                </span>
              )}
            </div>
          </div>
          <div className="flex sm:flex-col items-center gap-2 self-end sm:self-start">
            <Badge className={cn(status.color, "hidden sm:flex items-center gap-1")}>
              <StatusIcon className="h-3 w-3" />
              {status.label}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => onView(suggestion.id)}>
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

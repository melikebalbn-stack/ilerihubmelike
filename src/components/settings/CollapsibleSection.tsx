"use client"

import { useState, ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ChevronDown, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface CollapsibleSectionProps {
  title: string
  description?: string
  icon: LucideIcon
  iconBgColor?: string
  iconColor?: string
  children: ReactNode
  defaultOpen?: boolean
  externalLink?: string
}

export function CollapsibleSection({
  title,
  description,
  icon: Icon,
  iconBgColor = "bg-gray-100 dark:bg-gray-800",
  iconColor = "text-gray-600 dark:text-gray-400",
  children,
  defaultOpen = false,
  externalLink
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", iconBgColor)}>
              <Icon className={cn("h-5 w-5", iconColor)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle>{title}</CardTitle>
                {externalLink && (
                  <a
                    href={externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
          </div>
          <ChevronDown
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </CardHeader>
      {isOpen && <CardContent>{children}</CardContent>}
    </Card>
  )
}

// Subsection component for nested collapsibles
interface SubsectionProps {
  title: string
  icon: LucideIcon
  count?: number
  children: ReactNode
  defaultOpen?: boolean
}

export function Subsection({
  title,
  icon: Icon,
  count,
  children,
  defaultOpen = false
}: SubsectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">{title}</h3>
          {count !== undefined && (
            <span className="text-xs text-muted-foreground">({count})</span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </div>
      {isOpen && <div className="border-t">{children}</div>}
    </div>
  )
}

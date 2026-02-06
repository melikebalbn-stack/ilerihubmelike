"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { moduleCards } from "@/lib/suggestions-config"

interface ModuleCardsProps {
  onModuleSelect: (moduleId: string) => void
  getModuleStats: (key: string) => number
}

export function ModuleCards({ onModuleSelect, getModuleStats }: ModuleCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
      {moduleCards.map((module) => {
        const Icon = module.icon
        const count = getModuleStats(module.stats.key)

        return (
          <Card
            key={module.id}
            className={cn(
              "relative overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1",
              module.bgColor,
              module.borderColor,
              "border-2"
            )}
            onClick={() => onModuleSelect(module.id)}
          >
            <CardContent className="p-3 sm:p-6">
              {/* Background decoration */}
              <div className="absolute -right-4 -top-4 opacity-10">
                <Icon className="h-20 sm:h-32 w-20 sm:w-32" />
              </div>

              <div className="relative z-10">
                <div className={cn("inline-flex p-2 sm:p-3 rounded-lg sm:rounded-xl mb-2 sm:mb-4", module.iconBg)}>
                  <Icon
                    className="h-5 w-5 sm:h-6 sm:w-6"
                    style={{
                      color: module.color.includes('yellow') ? '#d97706' :
                             module.color.includes('blue') ? '#3b82f6' :
                             module.color.includes('orange') ? '#ea580c' : '#059669'
                    }}
                  />
                </div>

                <h3 className="text-sm sm:text-lg font-bold mb-0.5 sm:mb-1">{module.title}</h3>
                <p className="text-xs text-muted-foreground mb-2 sm:mb-4 line-clamp-2 hidden sm:block">
                  {module.description}
                </p>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xl sm:text-3xl font-bold">{count}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{module.stats.label}</p>
                  </div>
                  <Button size="sm" variant="secondary" className="gap-1 hidden sm:flex">
                    Gör
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <ChevronRight className="h-4 w-4 sm:hidden text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

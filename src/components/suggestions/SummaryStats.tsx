"use client"

import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2, Target, Shield, Trophy } from "lucide-react"
import type { SuggestionStats, KaizenProject, NearMiss } from "@/types/suggestions"

interface SummaryStatsProps {
  stats: SuggestionStats | null
  kaizenProjects: KaizenProject[]
  nearMisses: NearMiss[]
}

export function SummaryStats({ stats, kaizenProjects, nearMisses }: SummaryStatsProps) {
  if (!stats) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-green-700">{stats.overview.implemented}</p>
              <p className="text-[10px] sm:text-xs text-green-600">Uygulanan</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
              <Target className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-blue-700">
                {kaizenProjects.filter(p => p.status === 'IN_PROGRESS').length}
              </p>
              <p className="text-[10px] sm:text-xs text-blue-600">Aktif Kaizen</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-orange-100 rounded-lg">
              <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-orange-700">
                {nearMisses.filter(n => n.status !== 'CLOSED').length}
              </p>
              <p className="text-[10px] sm:text-xs text-orange-600">Açık R.Kala</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-emerald-100 rounded-lg">
              <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-emerald-700">
                {stats.overview.totalSavings > 0 ? `${(stats.overview.totalSavings / 1000).toFixed(0)}K` : '0'} ₺
              </p>
              <p className="text-[10px] sm:text-xs text-emerald-600">Tasarruf</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

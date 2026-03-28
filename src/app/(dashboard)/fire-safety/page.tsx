"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Flame } from "lucide-react"

export default function FireSafetyPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold tracking-tight">Yangın Güvenliği</h1>
          <p className="text-muted-foreground">
            Yangın güvenlik ekipmanları ve kontrol yönetimi
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-600" />
            Yangın Güvenliği Modülü
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Flame className="h-16 w-16 mx-auto mb-4 text-orange-400" />
            <p className="text-lg">Yangın Güvenliği modülü yakında eklenecek</p>
            <p className="text-sm mt-2">
              Yangın söndürme ekipmanları, kontrol takibi ve periyodik bakım yönetimi
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

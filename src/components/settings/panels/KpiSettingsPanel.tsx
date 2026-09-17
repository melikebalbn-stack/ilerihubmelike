"use client"

import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface KpiSettingsPanelProps {
  zorunluAksiyon: boolean
  onToggleZorunluAksiyon: (value: boolean) => void
}

export function KpiSettingsPanel({ zorunluAksiyon, onToggleZorunluAksiyon }: KpiSettingsPanelProps) {
  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="kpi-zorunlu-aksiyon" className="text-sm font-medium">
            Hedef tutturulamayan KPI'larda aksiyon zorunlu olsun
          </Label>
          <p className="text-sm text-muted-foreground">
            Açıksa, bir aylık ölçüm hedefi tutturamadığında (kırmızı) o KPI için en az bir aksiyon girilmeden ölçüm kaydedilemez.
          </p>
        </div>
        <Switch
          id="kpi-zorunlu-aksiyon"
          checked={zorunluAksiyon}
          onCheckedChange={onToggleZorunluAksiyon}
        />
      </div>
    </div>
  )
}

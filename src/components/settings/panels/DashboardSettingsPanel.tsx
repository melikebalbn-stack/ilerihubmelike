"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { AlertTriangle, Save } from "lucide-react"
import type { SystemNotice } from "@/types/settings"

interface DashboardSettingsPanelProps {
  systemNotice: SystemNotice
  setSystemNotice: (notice: SystemNotice) => void
  noticeEdited: boolean
  setNoticeEdited: (edited: boolean) => void
  savingSettings: boolean
  onSaveSystemNotice: () => void
}

export function DashboardSettingsPanel({
  systemNotice,
  setSystemNotice,
  noticeEdited,
  setNoticeEdited,
  savingSettings,
  onSaveSystemNotice
}: DashboardSettingsPanelProps) {
  return (
    <div className="space-y-4">
      {/* Sistem Notu / Duyuru */}
      <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${systemNotice.enabled ? 'bg-amber-100 dark:bg-amber-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
              <AlertTriangle className={`h-5 w-5 ${systemNotice.enabled ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`} />
            </div>
            <div>
              <h3 className="font-semibold">Sistem Notu / Duyuru</h3>
              <p className="text-sm text-muted-foreground">
                Dashboard'da kullanıcılara gösterilecek bilgilendirme mesajı
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${systemNotice.enabled ? 'text-amber-600' : 'text-gray-500'}`}>
              {systemNotice.enabled ? 'Aktif' : 'Kapalı'}
            </span>
            <Switch
              checked={systemNotice.enabled}
              onCheckedChange={(checked) => {
                setSystemNotice({ ...systemNotice, enabled: checked })
                setNoticeEdited(true)
              }}
              disabled={savingSettings}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="notice-title" className="text-sm font-medium">Başlık</Label>
            <Input
              id="notice-title"
              placeholder="Örn: Sistem Bakımda"
              value={systemNotice.title}
              onChange={(e) => {
                setSystemNotice({ ...systemNotice, title: e.target.value })
                setNoticeEdited(true)
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="notice-message" className="text-sm font-medium">Mesaj</Label>
            <Textarea
              id="notice-message"
              placeholder="Örn: Yangın Güvenliği Modülü bakımda. Lütfen daha sonra tekrar deneyiniz."
              value={systemNotice.message}
              onChange={(e) => {
                setSystemNotice({ ...systemNotice, message: e.target.value })
                setNoticeEdited(true)
              }}
              className="mt-1"
              rows={3}
            />
          </div>
        </div>

        {/* Önizleme */}
        {systemNotice.enabled && (systemNotice.title || systemNotice.message) && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-2">Önizleme:</p>
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
              {systemNotice.title && (
                <p className="font-semibold text-amber-800 dark:text-amber-200">{systemNotice.title}</p>
              )}
              {systemNotice.message && (
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{systemNotice.message}</p>
              )}
            </div>
          </div>
        )}

        {noticeEdited && (
          <div className="flex justify-end pt-2">
            <Button onClick={onSaveSystemNotice} disabled={savingSettings} size="sm">
              <Save className="h-4 w-4 mr-2" />
              {savingSettings ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

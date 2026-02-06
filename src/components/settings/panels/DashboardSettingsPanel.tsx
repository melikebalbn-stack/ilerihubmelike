"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { AlertTriangle, Save, UtensilsCrossed, Download, Upload } from "lucide-react"
import { toast } from "sonner"
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
  const handleMenuUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/menu/import', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || 'Menüler başarıyla yüklendi')
      } else {
        toast.error(data.error || 'Yükleme başarısız')
      }
    } catch {
      toast.error('Dosya yüklenirken hata oluştu')
    }

    e.target.value = ''
  }

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

      {/* Yemek Menüsü Yönetimi */}
      <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
            <UtensilsCrossed className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h3 className="font-semibold">Yemek Menüsü Yönetimi</h3>
            <p className="text-sm text-muted-foreground">
              Haftalık yemek menüsünü Excel ile yükleyin veya şablon indirin
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 border rounded-lg bg-background">
            <h4 className="font-medium mb-2">Excel Şablonu İndir</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Yemek menüsü girmek için Excel şablonunu indirin
            </p>
            <Button variant="outline" size="sm" onClick={() => window.open('/api/menu/template', '_blank')}>
              <Download className="h-4 w-4 mr-2" />
              Şablon İndir
            </Button>
          </div>

          <div className="p-3 border rounded-lg bg-background">
            <h4 className="font-medium mb-2">Excel Dosyası Yükle</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Doldurulmuş Excel dosyasını yükleyerek menüleri import edin
            </p>
            <div className="flex gap-2">
              <Input
                type="file"
                accept=".xlsx,.xls"
                id="menu-upload"
                className="hidden"
                onChange={handleMenuUpload}
              />
              <Button variant="outline" size="sm" onClick={() => document.getElementById('menu-upload')?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Excel Yükle
              </Button>
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
          <p className="font-medium mb-1">Excel Şablonu Kullanımı:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Tarih sütununu DD.MM.YYYY formatında doldurun</li>
            <li>Çorba, Ana Yemek, Yan Yemek, İçecek sütunlarını doldurun</li>
            <li>Tatil günleri için &quot;Tatil&quot; sütununa &quot;Evet&quot; yazın</li>
            <li>Hafta sonu günleri otomatik olarak tatil işaretlenir</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

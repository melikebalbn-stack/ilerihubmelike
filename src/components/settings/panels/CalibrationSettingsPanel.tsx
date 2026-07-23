"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, MapPin, Box, Layers, Tag, Building2, Mail, Bell, RefreshCw, Trash2, Pencil, Factory } from "lucide-react"
import { Subsection } from "../CollapsibleSection"
import { SettingsList, SimpleItem } from "../SettingsList"
import type {
  Location,
  DeviceType,
  DeviceModel,
  DeviceName,
  CalibrationDepartment,
  ProductionSection,
  NotificationEmail,
  NotificationRule,
  EditingType
} from "@/types/settings"

interface CalibrationSettingsPanelProps {
  locations: Location[]
  deviceTypes: DeviceType[]
  deviceModels: DeviceModel[]
  deviceNames: DeviceName[]
  departments: CalibrationDepartment[]
  productionSections: ProductionSection[]
  expiringEmails: NotificationEmail[]
  expiredEmails: NotificationEmail[]
  notificationRules: NotificationRule[]
  // Search states
  locationSearch: string
  setLocationSearch: (value: string) => void
  deviceTypeSearch: string
  setDeviceTypeSearch: (value: string) => void
  deviceModelSearch: string
  setDeviceModelSearch: (value: string) => void
  deviceNameSearch: string
  setDeviceNameSearch: (value: string) => void
  departmentSearch: string
  setDepartmentSearch: (value: string) => void
  productionSectionSearch: string
  setProductionSectionSearch: (value: string) => void
  // New email - expiring
  newExpiringEmail: string
  setNewExpiringEmail: (value: string) => void
  addingExpiringEmail: boolean
  // New email - expired
  newExpiredEmail: string
  setNewExpiredEmail: (value: string) => void
  addingExpiredEmail: boolean
  // New rule
  newRule: {
    type: 'EXPIRING' | 'EXPIRED'
    period: 'BEFORE' | 'AFTER'
    days: number
    repeatWeekly: boolean
  }
  setNewRule: (rule: { type: 'EXPIRING' | 'EXPIRED'; period: 'BEFORE' | 'AFTER'; days: number; repeatWeekly: boolean }) => void
  addingRule: boolean
  // Handlers
  onAddExpiringEmail: () => void
  onAddExpiredEmail: () => void
  onDeleteEmail: (id: string) => void
  onAddRule: () => void
  onDeleteRule: (id: string) => void
  onOpenAddDialog: (type: EditingType) => void
  onOpenEditDialog: (item: any, type: EditingType) => void
  onDeleteItem: (id: string, type: EditingType) => void
}

const getRuleDescription = (rule: NotificationRule) => {
  const typeText = rule.type === 'EXPIRING' ? 'Süresi Yaklaşan' : 'Süresi Dolan'
  const periodText = rule.period === 'BEFORE' ? 'kala' : 'sonra'
  const repeatText = rule.repeatWeekly ? ' (Haftalık tekrar)' : ''
  return `${typeText} - ${rule.days} gün ${periodText}${repeatText}`
}

export function CalibrationSettingsPanel({
  locations,
  deviceTypes,
  deviceModels,
  deviceNames,
  departments,
  productionSections,
  expiringEmails,
  expiredEmails,
  notificationRules,
  locationSearch,
  setLocationSearch,
  deviceTypeSearch,
  setDeviceTypeSearch,
  deviceModelSearch,
  setDeviceModelSearch,
  deviceNameSearch,
  setDeviceNameSearch,
  departmentSearch,
  setDepartmentSearch,
  productionSectionSearch,
  setProductionSectionSearch,
  newExpiringEmail,
  setNewExpiringEmail,
  addingExpiringEmail,
  newExpiredEmail,
  setNewExpiredEmail,
  addingExpiredEmail,
  newRule,
  setNewRule,
  addingRule,
  onAddExpiringEmail,
  onAddExpiredEmail,
  onDeleteEmail,
  onAddRule,
  onDeleteRule,
  onOpenAddDialog,
  onOpenEditDialog,
  onDeleteItem
}: CalibrationSettingsPanelProps) {
  const filteredLocations = locations.filter(loc =>
    loc.name.toLowerCase().includes(locationSearch.toLowerCase()) ||
    (loc.code && loc.code.toLowerCase().includes(locationSearch.toLowerCase()))
  )

  const filteredDeviceTypes = deviceTypes.filter(type =>
    type.name.toLowerCase().includes(deviceTypeSearch.toLowerCase()) ||
    (type.code && type.code.toLowerCase().includes(deviceTypeSearch.toLowerCase()))
  )

  const filteredDeviceModels = deviceModels.filter(model =>
    model.name.toLowerCase().includes(deviceModelSearch.toLowerCase()) ||
    (model.code && model.code.toLowerCase().includes(deviceModelSearch.toLowerCase())) ||
    (model.manufacturer && model.manufacturer.toLowerCase().includes(deviceModelSearch.toLowerCase()))
  )

  const filteredDeviceNames = deviceNames.filter(item =>
    item.name.toLowerCase().includes(deviceNameSearch.toLowerCase()) ||
    (item.code && item.code.toLowerCase().includes(deviceNameSearch.toLowerCase()))
  )

  const filteredDepartments = departments.filter(item =>
    item.name.toLowerCase().includes(departmentSearch.toLowerCase()) ||
    (item.code && item.code.toLowerCase().includes(departmentSearch.toLowerCase()))
  )

  const filteredProductionSections = productionSections.filter(item =>
    item.name.toLowerCase().includes(productionSectionSearch.toLowerCase()) ||
    (item.code && item.code.toLowerCase().includes(productionSectionSearch.toLowerCase()))
  )

  const ItemWithActions = ({ item, type }: { item: any; type: EditingType }) => (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
      <div className="flex-1">
        <p className="font-medium text-sm">{item.name}</p>
        <div className="flex gap-3 text-xs text-muted-foreground">
          {item.code && <span>Kod: {item.code}</span>}
          {item.manufacturer && <span>Üretici: {item.manufacturer}</span>}
          {type === 'production-section' && (
            <span>Departman: {item.department?.name || '—'}</span>
          )}
          <span className={item.isActive ? 'text-green-600' : 'text-red-600'}>
            {item.isActive ? 'Aktif' : 'Pasif'}
          </span>
        </div>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenEditDialog(item, type)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDeleteItem(item.id, type)}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Lokasyonlar */}
      <Subsection title="Lokasyonlar" icon={MapPin} count={locations.length}>
        <div className="p-3 border-b bg-background flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenAddDialog('location')}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Ekle
          </Button>
        </div>
        <div className="p-3 border-b bg-background">
          <div className="relative">
            <Input
              placeholder="Lokasyon ara..."
              value={locationSearch}
              onChange={(e) => setLocationSearch(e.target.value)}
              className="h-9"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
        <div className="p-3 max-h-64 overflow-y-auto space-y-2">
          {filteredLocations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {locationSearch ? "Sonuç bulunamadı" : "Henüz lokasyon eklenmemiş"}
            </p>
          ) : (
            filteredLocations.map((item) => (
              <ItemWithActions key={item.id} item={item} type="location" />
            ))
          )}
        </div>
      </Subsection>

      {/* Cihaz Tipleri */}
      <Subsection title="Cihaz Tipleri" icon={Box} count={deviceTypes.length}>
        <div className="p-3 border-b bg-background flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenAddDialog('device-type')}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Ekle
          </Button>
        </div>
        <div className="p-3 border-b bg-background">
          <Input
            placeholder="Cihaz tipi ara..."
            value={deviceTypeSearch}
            onChange={(e) => setDeviceTypeSearch(e.target.value)}
            className="h-9"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="p-3 max-h-64 overflow-y-auto space-y-2">
          {filteredDeviceTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {deviceTypeSearch ? "Sonuç bulunamadı" : "Henüz cihaz tipi eklenmemiş"}
            </p>
          ) : (
            filteredDeviceTypes.map((item) => (
              <ItemWithActions key={item.id} item={item} type="device-type" />
            ))
          )}
        </div>
      </Subsection>

      {/* Cihaz Modelleri */}
      <Subsection title="Cihaz Modelleri" icon={Layers} count={deviceModels.length}>
        <div className="p-3 border-b bg-background flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenAddDialog('device-model')}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Ekle
          </Button>
        </div>
        <div className="p-3 border-b bg-background">
          <Input
            placeholder="Cihaz modeli ara..."
            value={deviceModelSearch}
            onChange={(e) => setDeviceModelSearch(e.target.value)}
            className="h-9"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="p-3 max-h-64 overflow-y-auto space-y-2">
          {filteredDeviceModels.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {deviceModelSearch ? "Sonuç bulunamadı" : "Henüz cihaz modeli eklenmemiş"}
            </p>
          ) : (
            filteredDeviceModels.map((item) => (
              <ItemWithActions key={item.id} item={item} type="device-model" />
            ))
          )}
        </div>
      </Subsection>

      {/* Cihaz Adları */}
      <Subsection title="Cihaz Adları" icon={Tag} count={deviceNames.length}>
        <div className="p-3 border-b bg-background flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenAddDialog('device-name')}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Ekle
          </Button>
        </div>
        <div className="p-3 border-b bg-background">
          <Input
            placeholder="Cihaz adı ara..."
            value={deviceNameSearch}
            onChange={(e) => setDeviceNameSearch(e.target.value)}
            className="h-9"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="p-3 max-h-64 overflow-y-auto space-y-2">
          {filteredDeviceNames.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {deviceNameSearch ? "Sonuç bulunamadı" : "Henüz cihaz adı eklenmemiş"}
            </p>
          ) : (
            filteredDeviceNames.map((item) => (
              <ItemWithActions key={item.id} item={item} type="device-name" />
            ))
          )}
        </div>
      </Subsection>

      {/* Departmanlar */}
      <Subsection title="Departmanlar" icon={Building2} count={departments.length}>
        <div className="p-3 border-b bg-background flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenAddDialog('department')}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Ekle
          </Button>
        </div>
        <div className="p-3 border-b bg-background">
          <Input
            placeholder="Departman ara..."
            value={departmentSearch}
            onChange={(e) => setDepartmentSearch(e.target.value)}
            className="h-9"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="p-3 max-h-64 overflow-y-auto space-y-2">
          {filteredDepartments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {departmentSearch ? "Sonuç bulunamadı" : "Henüz departman eklenmemiş"}
            </p>
          ) : (
            filteredDepartments.map((item) => (
              <ItemWithActions key={item.id} item={item} type="department" />
            ))
          )}
        </div>
      </Subsection>

      {/* Bölümler */}
      <Subsection title="Bölümler" icon={Factory} count={productionSections.length}>
        <div className="p-3 border-b bg-background flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenAddDialog('production-section')}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Ekle
          </Button>
        </div>
        <div className="p-3 border-b bg-background">
          <Input
            placeholder="Bölüm ara..."
            value={productionSectionSearch}
            onChange={(e) => setProductionSectionSearch(e.target.value)}
            className="h-9"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="p-3 max-h-64 overflow-y-auto space-y-2">
          {filteredProductionSections.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {productionSectionSearch ? "Sonuç bulunamadı" : "Henüz bölüm eklenmemiş"}
            </p>
          ) : (
            filteredProductionSections.map((item) => (
              <ItemWithActions key={item.id} item={item} type="production-section" />
            ))
          )}
        </div>
      </Subsection>

      {/* Süresi Yaklaşanlar - Bildirim E-postaları */}
      <Subsection title="Süresi Yaklaşanlar E-postaları" icon={Mail} count={expiringEmails.length}>
        <div className="p-3 border-b bg-background">
          <p className="text-sm text-muted-foreground mb-3">
            Kalibrasyon/doğrulama süresi <strong>yaklaşan</strong> cihaz bildirimleri bu kişilere gönderilecektir.
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="ornek@ilerigroup.com"
              value={newExpiringEmail}
              onChange={(e) => setNewExpiringEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onAddExpiringEmail()
                }
              }}
              className="flex-1"
            />
            <Button
              onClick={onAddExpiringEmail}
              disabled={addingExpiringEmail || !newExpiringEmail}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Ekle
            </Button>
          </div>
        </div>
        <div className="p-3 max-h-64 overflow-y-auto">
          {expiringEmails.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Henüz e-posta eklenmemiş
            </p>
          ) : (
            <div className="space-y-2">
              {expiringEmails.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-amber-500" />
                    <span className="text-sm">{item.email}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteEmail(item.id)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Subsection>

      {/* Süresi Dolanlar - Bildirim E-postaları */}
      <Subsection title="Süresi Dolanlar E-postaları" icon={Mail} count={expiredEmails.length}>
        <div className="p-3 border-b bg-background">
          <p className="text-sm text-muted-foreground mb-3">
            Kalibrasyon/doğrulama süresi <strong>dolan</strong> cihaz bildirimleri bu kişilere gönderilecektir.
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="ornek@ilerigroup.com"
              value={newExpiredEmail}
              onChange={(e) => setNewExpiredEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onAddExpiredEmail()
                }
              }}
              className="flex-1"
            />
            <Button
              onClick={onAddExpiredEmail}
              disabled={addingExpiredEmail || !newExpiredEmail}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Ekle
            </Button>
          </div>
        </div>
        <div className="p-3 max-h-64 overflow-y-auto">
          {expiredEmails.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Henüz e-posta eklenmemiş
            </p>
          ) : (
            <div className="space-y-2">
              {expiredEmails.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-red-500" />
                    <span className="text-sm">{item.email}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteEmail(item.id)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Subsection>

      {/* Bildirim Kuralları */}
      <Subsection title="Bildirim Kuralları" icon={Bell} count={notificationRules.length}>
        <div className="p-3 border-b bg-background">
          <p className="text-sm text-muted-foreground mb-3">
            Hangi durumlarda bildirim e-postası gönderileceğini belirleyin.
          </p>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[140px]">
              <Label className="text-xs text-muted-foreground">Durum</Label>
              <select
                value={newRule.type}
                onChange={(e) => {
                  const type = e.target.value as 'EXPIRING' | 'EXPIRED'
                  setNewRule({
                    ...newRule,
                    type,
                    period: type === 'EXPIRING' ? 'BEFORE' : 'AFTER',
                  })
                }}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="EXPIRING">Süresi Yaklaşan</option>
                <option value="EXPIRED">Süresi Dolan</option>
              </select>
            </div>
            <div className="w-[80px]">
              <Label className="text-xs text-muted-foreground">Süre</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={newRule.days}
                onChange={(e) => setNewRule({ ...newRule, days: parseInt(e.target.value) || 1 })}
                className="h-9"
              />
            </div>
            <div className="w-[80px]">
              <Label className="text-xs text-muted-foreground">Periyod</Label>
              <select
                value={newRule.period}
                disabled
                className="w-full h-9 px-3 rounded-md border border-input bg-muted text-sm"
              >
                <option value="BEFORE">Kala</option>
                <option value="AFTER">Sonra</option>
              </select>
            </div>
            {newRule.type === 'EXPIRED' && (
              <div className="flex items-center gap-2 h-9">
                <input
                  type="checkbox"
                  id="repeatWeekly"
                  checked={newRule.repeatWeekly}
                  onChange={(e) => setNewRule({ ...newRule, repeatWeekly: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="repeatWeekly" className="text-xs whitespace-nowrap">
                  Haftalık tekrar
                </Label>
              </div>
            )}
            <Button
              onClick={onAddRule}
              disabled={addingRule}
              size="sm"
              className="h-9"
            >
              <Plus className="h-4 w-4 mr-1" />
              Ekle
            </Button>
          </div>
        </div>
        <div className="p-3 max-h-64 overflow-y-auto">
          {notificationRules.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Henüz bildirim kuralı eklenmemiş
            </p>
          ) : (
            <div className="space-y-2">
              {notificationRules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-2 rounded-lg border bg-background hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{getRuleDescription(rule)}</span>
                    {rule.repeatWeekly && (
                      <RefreshCw className="h-3 w-3 text-blue-500" />
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteRule(rule.id)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Subsection>
    </div>
  )
}

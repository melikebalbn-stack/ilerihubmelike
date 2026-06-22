'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { NativeSelect as Select } from '@/components/ui/select'
import { CalendarEventType } from '@/generated/prisma'
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS, type CalendarEvent } from './CalendarView'

interface Department {
  id: string
  name: string
}

interface EventFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  event?: CalendarEvent | null
  onSuccess?: () => void
  initialDate?: Date | null
  initialAllDay?: boolean
}

const REMIND_OPTIONS = [
  { value: '', label: 'Hatırlatma yok' },
  { value: '15', label: '15 dakika önce' },
  { value: '30', label: '30 dakika önce' },
  { value: '60', label: '1 saat önce' },
  { value: '1440', label: '1 gün önce' },
]

const COLOR_PRESETS = [
  '#3b82f6', // mavi
  '#8b5cf6', // mor
  '#f97316', // turuncu
  '#ef4444', // kırmızı
  '#22c55e', // yeşil
  '#6b7280', // gri
  '#06b6d4', // camgöbeği
  '#64748b', // arduvaz
  '#ec4899', // pembe
  '#f59e0b', // amber
]

export function EventForm({
  open,
  onOpenChange,
  event,
  onSuccess,
  initialDate,
  initialAllDay,
}: EventFormProps) {
  const isEditing = !!event

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [type, setType] = useState<CalendarEventType>(CalendarEventType.MEETING)
  const [color, setColor] = useState('')
  const [location, setLocation] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [remindBefore, setRemindBefore] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [loading, setLoading] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])

  // Departmanları yükle
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await fetch('/api/departments')
        if (res.ok) {
          const data = await res.json()
          setDepartments(data.data || [])
        }
      } catch (error) {
        console.error('Departmanlar yüklenemedi:', error)
      }
    }
    fetchDepartments()
  }, [])

  // Form'u düzenleme için doldur veya sıfırla
  useEffect(() => {
    if (open) {
      if (event) {
        // Düzenleme modu
        setTitle(event.title)
        setDescription(event.description || '')
        setStartDate(formatDateTimeLocal(event.startDate))
        setEndDate(formatDateTimeLocal(event.endDate))
        setAllDay(event.allDay || false)
        setType(event.type)
        setColor(event.color || '')
        setLocation(event.location || '')
        setDepartmentId(event.departmentId || '')
        setIsRecurring(event.isRecurring || false)
        setRemindBefore(event.remindBefore?.toString() || '')
        setIsPublic(event.isPublic ?? true)
      } else {
        // Yeni etkinlik
        resetForm()
        if (initialDate) {
          setStartDate(formatDateTimeLocal(initialDate))
          // Bitiş tarihi olarak başlangıçtan 1 saat sonrası
          const endDateValue = new Date(initialDate)
          endDateValue.setHours(endDateValue.getHours() + 1)
          setEndDate(formatDateTimeLocal(endDateValue))
          setAllDay(initialAllDay || false)
        }
      }
    }
  }, [open, event, initialDate, initialAllDay])

  // Tip değiştiğinde rengi otomatik güncelle (manuel seçilmediyse)
  useEffect(() => {
    if (!color || Object.values(EVENT_TYPE_COLORS).includes(color)) {
      setColor(EVENT_TYPE_COLORS[type])
    }
  }, [type])

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setStartDate('')
    setEndDate('')
    setAllDay(false)
    setType(CalendarEventType.MEETING)
    setColor(EVENT_TYPE_COLORS.MEETING)
    setLocation('')
    setDepartmentId('')
    setIsRecurring(false)
    setRemindBefore('')
    setIsPublic(true)
  }

  const formatDateTimeLocal = (date: string | Date): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validasyon
    if (!title.trim()) {
      toast.error('Başlık zorunludur')
      return
    }

    if (!startDate) {
      toast.error('Başlangıç tarihi zorunludur')
      return
    }

    if (!endDate) {
      toast.error('Bitiş tarihi zorunludur')
      return
    }

    const startDateObj = new Date(startDate)
    const endDateObj = new Date(endDate)

    if (startDateObj > endDateObj) {
      toast.error('Bitiş tarihi başlangıç tarihinden önce olamaz')
      return
    }

    setLoading(true)

    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        startDate: startDateObj.toISOString(),
        endDate: endDateObj.toISOString(),
        allDay,
        type,
        color: color || null,
        location: location.trim() || null,
        departmentId: departmentId || null,
        isRecurring,
        remindBefore: remindBefore || null,
        isPublic,
      }

      const url = isEditing
        ? `/api/calendar/local-events/${event!.id}`
        : '/api/calendar/local-events'

      const method = isEditing ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Bir hata oluştu')
      }

      toast.success(isEditing ? 'Etkinlik güncellendi' : 'Etkinlik oluşturuldu')
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Etkinlik kaydedilemedi:', error)
      toast.error(error instanceof Error ? error.message : 'Etkinlik kaydedilemedi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Etkinliği Düzenle' : 'Yeni Etkinlik'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Etkinlik bilgilerini güncelleyin'
              : 'Takvime yeni bir etkinlik ekleyin'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Başlık */}
          <div className="space-y-2">
            <Label htmlFor="title">Başlık *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Etkinlik başlığı"
              disabled={loading}
            />
          </div>

          {/* Açıklama */}
          <div className="space-y-2">
            <Label htmlFor="description">Açıklama</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Etkinlik açıklaması (isteğe bağlı)"
              rows={3}
              disabled={loading}
            />
          </div>

          {/* Tarihler */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Başlangıç *</Label>
              <Input
                id="startDate"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Bitiş *</Label>
              <Input
                id="endDate"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Tüm gün */}
          <div className="flex items-center justify-between">
            <Label htmlFor="allDay">Tüm gün</Label>
            <Switch
              id="allDay"
              checked={allDay}
              onCheckedChange={setAllDay}
              disabled={loading}
            />
          </div>

          {/* Tip */}
          <div className="space-y-2">
            <Label htmlFor="type">Etkinlik Tipi</Label>
            <Select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as CalendarEventType)}
              disabled={loading}
            >
              {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          {/* Renk */}
          <div className="space-y-2">
            <Label>Renk</Label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_PRESETS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  onClick={() => setColor(presetColor)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === presetColor
                      ? 'border-foreground scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: presetColor }}
                  disabled={loading}
                />
              ))}
              <Input
                type="color"
                value={color || EVENT_TYPE_COLORS[type]}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 p-0 border-0 cursor-pointer"
                disabled={loading}
              />
            </div>
          </div>

          {/* Konum */}
          <div className="space-y-2">
            <Label htmlFor="location">Konum</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Toplantı odası, adres, vb."
              disabled={loading}
            />
          </div>

          {/* Departman */}
          <div className="space-y-2">
            <Label htmlFor="departmentId">Departman</Label>
            <Select
              id="departmentId"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              disabled={loading}
            >
              <option value="">Departman seçin (isteğe bağlı)</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Hatırlatma */}
          <div className="space-y-2">
            <Label htmlFor="remindBefore">Hatırlatma</Label>
            <Select
              id="remindBefore"
              value={remindBefore}
              onChange={(e) => setRemindBefore(e.target.value)}
              disabled={loading}
            >
              {REMIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Tekrarlayan */}
          <div className="flex items-center justify-between">
            <Label htmlFor="isRecurring">Tekrarlayan etkinlik</Label>
            <Switch
              id="isRecurring"
              checked={isRecurring}
              onCheckedChange={setIsRecurring}
              disabled={loading}
            />
          </div>

          {/* Herkese açık */}
          <div className="flex items-center justify-between">
            <Label htmlFor="isPublic">Herkese açık</Label>
            <Switch
              id="isPublic"
              checked={isPublic}
              onCheckedChange={setIsPublic}
              disabled={loading}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              İptal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Güncelle' : 'Oluştur'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

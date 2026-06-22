"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertTriangle } from "lucide-react"
import type { NearMissFormData } from "@/types/suggestions"

interface CreateNearMissDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: NearMissFormData
  setForm: React.Dispatch<React.SetStateAction<NearMissFormData>>
  onSubmit: (e: React.FormEvent) => Promise<boolean>
}

export function CreateNearMissDialog({
  open,
  onOpenChange,
  form,
  setForm,
  onSubmit
}: CreateNearMissDialogProps) {
  const handleSubmit = async (e: React.FormEvent) => {
    const success = await onSubmit(e)
    if (success) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
            Ramak Kala Bildir
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Potansiyel tehlike veya kazayı hızlıca bildirin
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2">
              <Label htmlFor="title">Olay Başlığı *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Kısa ve açıklayıcı başlık"
                required
              />
            </div>

            <div className="col-span-1 sm:col-span-2">
              <Label htmlFor="description">Olay Açıklaması *</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Olayı detaylı açıklayın"
                rows={3}
                required
              />
            </div>

            <div>
              <Label htmlFor="eventDate">Olay Tarihi *</Label>
              <Input
                id="eventDate"
                type="date"
                value={form.eventDate}
                onChange={e => setForm({ ...form, eventDate: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="eventLocation">Olay Yeri *</Label>
              <Input
                id="eventLocation"
                value={form.eventLocation}
                onChange={e => setForm({ ...form, eventLocation: e.target.value })}
                placeholder="Olayın gerçekleştiği yer"
                required
              />
            </div>

            <div>
              <Label htmlFor="eventType">Olay Türü</Label>
              <Select value={form.eventType} onValueChange={v => setForm({ ...form, eventType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FALLING">Düşme</SelectItem>
                  <SelectItem value="SLIPPING">Kayma</SelectItem>
                  <SelectItem value="TRIPPING">Takılma</SelectItem>
                  <SelectItem value="COLLISION">Çarpışma</SelectItem>
                  <SelectItem value="FALLING_OBJECT">Düşen Cisim</SelectItem>
                  <SelectItem value="ELECTRICAL">Elektrik</SelectItem>
                  <SelectItem value="FIRE">Yangın</SelectItem>
                  <SelectItem value="CHEMICAL">Kimyasal</SelectItem>
                  <SelectItem value="MACHINERY">Makine/Ekipman</SelectItem>
                  <SelectItem value="VEHICLE">Araç</SelectItem>
                  <SelectItem value="ERGONOMIC">Ergonomik</SelectItem>
                  <SelectItem value="ENVIRONMENTAL">Çevresel</SelectItem>
                  <SelectItem value="OTHER">Diğer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="potentialSeverity">Potansiyel Şiddet</Label>
              <Select value={form.potentialSeverity} onValueChange={v => setForm({ ...form, potentialSeverity: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MINOR">Hafif</SelectItem>
                  <SelectItem value="MODERATE">Orta</SelectItem>
                  <SelectItem value="MAJOR">Ciddi</SelectItem>
                  <SelectItem value="CRITICAL">Kritik</SelectItem>
                  <SelectItem value="FATAL">Ölümcül</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-1 sm:col-span-2">
              <Label htmlFor="whatHappened">Ne Oldu?</Label>
              <Textarea
                id="whatHappened"
                value={form.whatHappened}
                onChange={e => setForm({ ...form, whatHappened: e.target.value })}
                placeholder="Olayın detaylı açıklaması"
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isAnonymous"
                checked={form.isAnonymous}
                onChange={e => setForm({ ...form, isAnonymous: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="isAnonymous" className="text-sm cursor-pointer">Anonim olarak bildir</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button type="submit" className="bg-orange-600 hover:bg-orange-700">
              Bildir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

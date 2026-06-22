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
import { RefreshCcw } from "lucide-react"
import type { KaizenFormData } from "@/types/suggestions"

interface CreateKaizenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: KaizenFormData
  setForm: React.Dispatch<React.SetStateAction<KaizenFormData>>
  onSubmit: (e: React.FormEvent) => Promise<boolean>
}

export function CreateKaizenDialog({
  open,
  onOpenChange,
  form,
  setForm,
  onSubmit
}: CreateKaizenDialogProps) {
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
            <RefreshCcw className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
            Yeni Kaizen Projesi
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            PDCA döngüsü ile sürekli iyileştirme projesi başlatın
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2">
              <Label htmlFor="title">Proje Adı *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Kaizen projesinin adı"
                required
              />
            </div>

            <div className="col-span-1 sm:col-span-2">
              <Label htmlFor="description">Proje Açıklaması *</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Projeyi detaylı açıklayın"
                rows={3}
                required
              />
            </div>

            <div>
              <Label htmlFor="projectType">Proje Türü</Label>
              <Select value={form.projectType} onValueChange={v => setForm({ ...form, projectType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INDIVIDUAL">Bireysel</SelectItem>
                  <SelectItem value="TEAM">Takım</SelectItem>
                  <SelectItem value="DEPARTMENT">Departman</SelectItem>
                  <SelectItem value="CROSS_FUNCTIONAL">Çapraz Fonksiyonel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="priority">Öncelik</Label>
              <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Düşük</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="HIGH">Yüksek</SelectItem>
                  <SelectItem value="CRITICAL">Kritik</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="problemWhat">Problem Nedir?</Label>
              <Textarea
                id="problemWhat"
                value={form.problemWhat}
                onChange={e => setForm({ ...form, problemWhat: e.target.value })}
                placeholder="Çözülmesi gereken problem nedir?"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="problemWhy">Neden Önemli?</Label>
              <Textarea
                id="problemWhy"
                value={form.problemWhy}
                onChange={e => setForm({ ...form, problemWhy: e.target.value })}
                placeholder="Bu problem neden çözülmeli?"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="currentState">Mevcut Durum</Label>
              <Textarea
                id="currentState"
                value={form.currentState}
                onChange={e => setForm({ ...form, currentState: e.target.value })}
                placeholder="Şu anki durum nasıl?"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="targetState">Hedef Durum</Label>
              <Textarea
                id="targetState"
                value={form.targetState}
                onChange={e => setForm({ ...form, targetState: e.target.value })}
                placeholder="Hedeflenen durum nedir?"
                rows={2}
              />
            </div>

            <div className="col-span-1 sm:col-span-2">
              <Label htmlFor="proposedSolution">Önerilen Çözüm</Label>
              <Textarea
                id="proposedSolution"
                value={form.proposedSolution}
                onChange={e => setForm({ ...form, proposedSolution: e.target.value })}
                placeholder="Önerdiğiniz çözüm nedir?"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button type="submit">
              Proje Oluştur
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

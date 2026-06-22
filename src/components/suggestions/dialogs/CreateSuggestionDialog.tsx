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
import { Lightbulb, Upload, X, FileText, Image } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatFileSize } from "@/lib/suggestions-config"
import type { Category, SuggestionFormData, UploadedFile } from "@/types/suggestions"

interface CreateSuggestionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  form: SuggestionFormData
  setForm: React.Dispatch<React.SetStateAction<SuggestionFormData>>
  categories: Category[]
  uploadedFiles: UploadedFile[]
  isDragging: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveFile: (index: number) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onSubmit: (e: React.FormEvent) => Promise<boolean>
}

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return <Image className="h-4 w-4" />
  return <FileText className="h-4 w-4" />
}

export function CreateSuggestionDialog({
  open,
  onOpenChange,
  form,
  setForm,
  categories,
  uploadedFiles,
  isDragging,
  fileInputRef,
  onFileSelect,
  onRemoveFile,
  onDragOver,
  onDragLeave,
  onDrop,
  onSubmit
}: CreateSuggestionDialogProps) {
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
            <Lightbulb className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
            Yeni Öneri Oluştur
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Şirketi geliştirmek için önerinizi paylaşın
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2">
              <Label htmlFor="title">Başlık *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Önerinizin başlığı"
                required
              />
            </div>

            <div className="col-span-1 sm:col-span-2">
              <Label htmlFor="description">Açıklama *</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Önerinizi detaylı açıklayın"
                rows={3}
                required
              />
            </div>

            <div>
              <Label htmlFor="currentSituation">Mevcut Durum</Label>
              <Textarea
                id="currentSituation"
                value={form.currentSituation}
                onChange={e => setForm({ ...form, currentSituation: e.target.value })}
                placeholder="Şu anki durum nasıl?"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="proposedSolution">Önerilen Çözüm</Label>
              <Textarea
                id="proposedSolution"
                value={form.proposedSolution}
                onChange={e => setForm({ ...form, proposedSolution: e.target.value })}
                placeholder="Önerdiğiniz çözüm nedir?"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="expectedBenefit">Beklenen Fayda</Label>
              <Textarea
                id="expectedBenefit"
                value={form.expectedBenefit}
                onChange={e => setForm({ ...form, expectedBenefit: e.target.value })}
                placeholder="Hangi faydaları sağlayacak?"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="estimatedSavings">Tahmini Tasarruf (TL)</Label>
              <Input
                id="estimatedSavings"
                type="number"
                value={form.estimatedSavings}
                onChange={e => setForm({ ...form, estimatedSavings: e.target.value })}
                placeholder="0"
              />
            </div>

            <div>
              <Label htmlFor="categoryId">Kategori</Label>
              <Select value={form.categoryId} onValueChange={v => setForm({ ...form, categoryId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Kategori seçin" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
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
              <Label htmlFor="suggestionType">Öneri Türü</Label>
              <Select value={form.suggestionType} onValueChange={v => setForm({ ...form, suggestionType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IMPROVEMENT">İyileştirme</SelectItem>
                  <SelectItem value="COST_REDUCTION">Maliyet Azaltma</SelectItem>
                  <SelectItem value="SAFETY">İş Güvenliği</SelectItem>
                  <SelectItem value="QUALITY">Kalite</SelectItem>
                  <SelectItem value="ENVIRONMENT">Çevre</SelectItem>
                  <SelectItem value="OTHER">Diğer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isAnonymous"
                checked={form.isAnonymous}
                onChange={e => setForm({ ...form, isAnonymous: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="isAnonymous" className="text-sm cursor-pointer">Anonim olarak gönder</Label>
            </div>

            {/* File Upload */}
            <div className="col-span-1 sm:col-span-2 space-y-3">
              <Label>Dosya Ekle</Label>
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
                  isDragging ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                )}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                  className="hidden"
                  onChange={onFileSelect}
                />
                <Upload className={cn("h-8 w-8 mx-auto mb-2", isDragging ? "text-blue-500" : "text-gray-400")} />
                <p className={cn("text-sm", isDragging ? "text-blue-600" : "text-gray-600")}>
                  {isDragging ? "Dosyayı buraya bırakın" : "Dosya yüklemek için tıklayın veya sürükleyin"}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  JPG, PNG, PDF, Word, Excel, PowerPoint (max 10MB)
                </p>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                      {getFileIcon(file.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => onRemoveFile(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button type="submit">
              Öneri Gönder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

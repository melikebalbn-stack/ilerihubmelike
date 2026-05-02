"use client"

import { useState, useEffect } from "react"
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
import { Badge } from "@/components/ui/badge"
import { FileUp, Loader2, Upload, X, FileText, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

interface NewVersionModalProps {
  open: boolean
  onClose: () => void
  document: {
    id: string
    documentNumber: string
    title: string
    version: string
    fileName: string
  } | null
  onSuccess?: () => void
}

const VERSION_REGEX = /^\d+\.\d+$/
const MIN_NOTE_LENGTH = 20
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ACCEPT = ".pdf,.docx,.xlsx,.doc,.xls"

const compareVersion = (a: string, b: string): number => {
  const [am, an] = a.split(".").map((x) => parseInt(x) || 0)
  const [bm, bn] = b.split(".").map((x) => parseInt(x) || 0)
  return am !== bm ? am - bm : an - bn
}

const suggestNextVersion = (current: string): string => {
  const [major] = current.split(".").map((x) => parseInt(x) || 0)
  return `${major + 1}.0`
}

export function NewVersionModal({
  open,
  onClose,
  document,
  onSuccess,
}: NewVersionModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [version, setVersion] = useState("")
  const [changeDescription, setChangeDescription] = useState("")
  const [revisionDate, setRevisionDate] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const buildSchema = (currentVersion: string) =>
    z.object({
      version: z
        .string()
        .regex(VERSION_REGEX, "Versiyon formatı geçersiz (örn: 2.0)")
        .refine(
          (v) => compareVersion(v, currentVersion) > 0,
          `Yeni versiyon mevcut versiyondan (${currentVersion}) büyük olmalı`,
        ),
      changeDescription: z
        .string()
        .min(
          MIN_NOTE_LENGTH,
          `Değişiklik açıklaması en az ${MIN_NOTE_LENGTH} karakter olmalı`,
        ),
      revisionDate: z.string().min(1, "Revizyon tarihi zorunlu"),
    })

  // Modal açılınca form'u resetle ve önerileri doldur
  useEffect(() => {
    if (open && document) {
      setFile(null)
      setVersion(suggestNextVersion(document.version))
      setChangeDescription("")
      setRevisionDate(new Date().toISOString().slice(0, 10))
      setErrors({})
    }
  }, [open, document])

  if (!document) return null

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > MAX_FILE_SIZE) {
      toast.error("Dosya 50MB üzerinde olamaz")
      return
    }
    setFile(f)
    setErrors((prev) => ({ ...prev, file: "" }))
  }

  const handleSubmit = async () => {
    if (!file) {
      setErrors((prev) => ({ ...prev, file: "Dosya seçilmedi" }))
      return
    }

    const schema = buildSchema(document.version)
    const result = schema.safeParse({ version, changeDescription, revisionDate })
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = String(issue.path[0])
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("version", version)
      formData.append("changeDescription", changeDescription)
      formData.append("revisionDate", revisionDate)

      const res = await fetch(
        `/api/iso27001/documents/${document.id}/version`,
        {
          method: "POST",
          body: formData,
        },
      )

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || "Yeni versiyon yüklenemedi")
        return
      }

      toast.success(`Versiyon ${version} başarıyla yüklendi`)
      onSuccess?.()
      onClose()
    } catch (e) {
      console.error("Versiyon yükleme:", e)
      toast.error("Yükleme sırasında hata oluştu")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !submitting && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-sky-600" />
            Yeni Versiyon Yükle
          </DialogTitle>
          <DialogDescription className="space-y-1.5">
            <span className="block">
              <Badge variant="outline" className="font-mono mr-1">
                {document.documentNumber}
              </Badge>
              {document.title}
            </span>
            <span className="block text-xs">
              Mevcut versiyon: <span className="font-mono">{document.version}</span>
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Dosya */}
          <div className="space-y-2">
            <Label htmlFor="file">Dosya *</Label>
            {!file ? (
              <label
                htmlFor="file"
                className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center cursor-pointer hover:bg-slate-50 hover:border-sky-300 transition-colors"
              >
                <Upload className="h-6 w-6 text-slate-400" />
                <div className="text-sm">
                  <span className="font-medium text-sky-600">Dosya seç</span>
                  <span className="text-muted-foreground"> veya buraya bırak</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  PDF, Word, Excel · Maks 50MB
                </span>
                <input
                  id="file"
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={submitting}
                />
              </label>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border bg-emerald-50/50 border-emerald-200 px-3 py-2.5">
                <FileText className="h-5 w-5 text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {file.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFile(null)}
                  disabled={submitting}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            {errors.file && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.file}
              </p>
            )}
          </div>

          {/* Versiyon No */}
          <div className="space-y-2">
            <Label htmlFor="version">Yeni Versiyon No *</Label>
            <Input
              id="version"
              type="text"
              placeholder="Örn: 2.0"
              value={version}
              onChange={(e) => {
                setVersion(e.target.value)
                if (errors.version) {
                  setErrors((p) => ({ ...p, version: "" }))
                }
              }}
              className="font-mono"
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">
              Major: <span className="font-mono">+1.0</span> · Minor:{" "}
              <span className="font-mono">+0.1</span>
            </p>
            {errors.version && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.version}
              </p>
            )}
          </div>

          {/* Değişiklik Açıklaması */}
          <div className="space-y-2">
            <Label htmlFor="changeDescription">
              Değişiklik Açıklaması (Revizyon Notu) *
            </Label>
            <Textarea
              id="changeDescription"
              placeholder="Bu versiyonda neler değişti? Hangi maddeler güncellendi?"
              rows={4}
              value={changeDescription}
              onChange={(e) => {
                setChangeDescription(e.target.value)
                if (errors.changeDescription) {
                  setErrors((p) => ({ ...p, changeDescription: "" }))
                }
              }}
              disabled={submitting}
            />
            <div className="flex justify-between text-xs">
              <span
                className={
                  changeDescription.length < MIN_NOTE_LENGTH
                    ? "text-amber-600"
                    : "text-emerald-600"
                }
              >
                En az {MIN_NOTE_LENGTH} karakter
              </span>
              <span className="text-muted-foreground">
                {changeDescription.length} karakter
              </span>
            </div>
            {errors.changeDescription && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.changeDescription}
              </p>
            )}
          </div>

          {/* Revizyon Tarihi */}
          <div className="space-y-2">
            <Label htmlFor="revisionDate">Revizyon Tarihi *</Label>
            <Input
              id="revisionDate"
              type="date"
              value={revisionDate}
              onChange={(e) => setRevisionDate(e.target.value)}
              disabled={submitting}
            />
            {errors.revisionDate && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.revisionDate}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            İptal
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Yükleniyor...
              </>
            ) : (
              <>
                <FileUp className="h-4 w-4 mr-2" />
                Yeni Versiyonu Yükle
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

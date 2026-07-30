"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Upload, Download, Loader2, CheckCircle2, AlertTriangle, FileWarning } from "lucide-react"
import { toast } from "sonner"

interface ImportResult {
  message?: string
  success?: number
  failed?: number
  format?: "catering" | "legacy"
  warnings?: string[]
  errors?: string[]
}

export function MenuSettingsPanel() {
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setResult(null)
    setErrorMsg(null)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch("/api/menu/import", { method: "POST", body: formData })
      const data = await res.json()
      if (res.ok) {
        setResult(data as ImportResult)
        toast.success(data.message || "Menü yüklendi")
      } else {
        // API 403 (yetkisiz) veya 400 (format) → Türkçe mesaj
        setErrorMsg(data.error || "Yükleme başarısız")
        toast.error(data.error || "Yükleme başarısız")
      }
    } catch {
      setErrorMsg("Dosya yüklenirken bağlantı hatası oluştu")
      toast.error("Dosya yüklenirken hata oluştu")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Excel ile Menü Yükle</CardTitle>
          <CardDescription>
            Yemek şirketinin gönderdiği haftalık/aylık menü dosyasını (.xlsx) yükleyin. Format otomatik algılanır.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="file"
              accept=".xlsx,.xls"
              id="menu-upload-input"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
            <Button onClick={() => document.getElementById("menu-upload-input")?.click()} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Yükleniyor...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Excel Yükle
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open("/api/menu/template", "_blank")}
              disabled={uploading}
            >
              <Download className="h-4 w-4 mr-2" />
              Şablon İndir
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Yemek şirketi standart formatını gönderiyorsa şablon gerekmez — dosyayı doğrudan yükleyin.
          </p>

          {/* 400/403 hata */}
          {errorMsg && (
            <Alert variant="destructive">
              <FileWarning className="h-4 w-4" />
              <AlertTitle>Menü yüklenemedi</AlertTitle>
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          {/* Başarılı sonuç */}
          {result && (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="flex flex-wrap items-center gap-2">
                <span>{result.success ?? 0} gün yüklendi</span>
                {result.format && (
                  <span className="text-xs font-normal text-muted-foreground">
                    ({result.format === "catering" ? "şirket formatı" : "şablon formatı"})
                  </span>
                )}
                {typeof result.failed === "number" && result.failed > 0 && (
                  <span className="text-xs font-normal text-destructive">{result.failed} başarısız</span>
                )}
              </AlertTitle>
              <AlertDescription>
                {result.warnings && result.warnings.length > 0 && (
                  <div className="mt-2">
                    <p className="flex items-center gap-1 text-sm font-medium text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Uyarılar
                    </p>
                    <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
                      {result.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.errors && result.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-destructive">Hatalar</p>
                    <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
                      {result.errors.map((er, i) => (
                        <li key={i}>{er}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {!result.warnings?.length && !result.errors?.length && (
                  <p className="mt-1 text-xs text-muted-foreground">Tüm günler sorunsuz içe aktarıldı.</p>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

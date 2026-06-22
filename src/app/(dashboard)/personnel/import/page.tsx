"use client"

import { useState, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowLeft, Download, Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import { EXCEL_TEMPLATE_COLUMNS, EXCEL_COLUMN_MAP } from "@/lib/personnel-constants"

type PreviewRow = Record<string, any>

type ImportResult = {
  created: number
  updated: number
  errors: { row: number; message: string }[]
}

export default function PersonnelImportPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [previewColumns, setPreviewColumns] = useState<string[]>([])
  const [columnErrors, setColumnErrors] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragActive, setDragActive] = useState(false)

  // Step 1: Download template
  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([EXCEL_TEMPLATE_COLUMNS])

    // Set column widths
    ws["!cols"] = EXCEL_TEMPLATE_COLUMNS.map(() => ({ wch: 20 }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Personel")
    XLSX.writeFile(wb, "personel_sablon.xlsx")
    toast.success("Şablon dosyası indirildi")
  }

  // Step 2: File handling
  const processFile = useCallback((selectedFile: File) => {
    setFile(selectedFile)
    setResult(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" })

        if (jsonData.length === 0) {
          toast.error("Dosyada veri bulunamadı")
          return
        }

        // Get columns from first row
        const cols = Object.keys(jsonData[0])
        setPreviewColumns(cols)

        // Check for unmapped columns
        const errors = new Set<string>()
        cols.forEach((col) => {
          if (!EXCEL_COLUMN_MAP[col]) {
            errors.add(col)
          }
        })
        setColumnErrors(errors)

        // Preview first 10 rows
        setPreviewRows(jsonData.slice(0, 10))

        if (errors.size > 0) {
          toast.warning(`${errors.size} sütun eşleştirilemedi`)
        } else {
          toast.success(`${jsonData.length} satır okundu`)
        }
      } catch (err) {
        toast.error("Dosya okunamadı. Lütfen geçerli bir Excel dosyası seçin.")
        setFile(null)
      }
    }
    reader.readAsArrayBuffer(selectedFile)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) processFile(selectedFile)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      const ext = droppedFile.name.split(".").pop()?.toLowerCase()
      if (ext === "xlsx" || ext === "xls") {
        processFile(droppedFile)
      } else {
        toast.error("Yalnızca .xlsx ve .xls dosyaları kabul edilir")
      }
    }
  }

  // Step 4: Import
  const handleImport = async () => {
    if (!file) return
    try {
      setImporting(true)
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/personnel/import", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || "İçe aktarma başarısız")
      }

      const data = await res.json()
      setResult(data)

      if (data.errors?.length > 0) {
        toast.warning(`İçe aktarma tamamlandı (${data.errors.length} hata)`)
      } else {
        toast.success("İçe aktarma başarıyla tamamlandı")
      }
    } catch (err: any) {
      toast.error(err.message || "Bir hata oluştu")
    } finally {
      setImporting(false)
    }
  }

  const resetForm = () => {
    setFile(null)
    setPreviewRows([])
    setPreviewColumns([])
    setColumnErrors(new Set())
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/personnel">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Geri
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Excel İçe Aktarma</h1>
      </div>

      {/* Step 1: Template */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Badge className="bg-primary text-primary-foreground">1</Badge>
            Şablon İndir
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Doğru sütun başlıklarına sahip şablon Excel dosyasını indirin ve verilerinizi bu şablona uygun şekilde doldurun.
          </p>
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Şablon Excel&apos;i İndir
          </Button>
        </CardContent>
      </Card>

      {/* Step 2: Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Badge className="bg-primary text-primary-foreground">2</Badge>
            Dosya Yükle
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            }`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
          >
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              Excel dosyanızı sürükleyip bırakın veya
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Dosya Seç
            </Button>
            {file && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">{file.name}</span>
                <Button variant="ghost" size="sm" onClick={resetForm} className="text-red-500 hover:text-red-700">
                  Kaldır
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Preview */}
      {previewRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Badge className="bg-primary text-primary-foreground">3</Badge>
              Ön İzleme (İlk 10 Satır)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {columnErrors.size > 0 && (
              <div className="p-4 bg-red-50 border-b">
                <p className="text-sm text-red-700 font-medium mb-1">Eşleştirilemayan sütunlar:</p>
                <div className="flex flex-wrap gap-1">
                  {Array.from(columnErrors).map((col) => (
                    <Badge key={col} variant="destructive" className="text-xs">{col}</Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    {previewColumns.map((col) => (
                      <TableHead
                        key={col}
                        className={columnErrors.has(col) ? "text-red-600 bg-red-50" : undefined}
                      >
                        <div className="text-xs">
                          {col}
                          {EXCEL_COLUMN_MAP[col] && (
                            <span className="block text-muted-foreground font-normal">
                              → {EXCEL_COLUMN_MAP[col]}
                            </span>
                          )}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                      {previewColumns.map((col) => (
                        <TableCell
                          key={col}
                          className={`text-xs ${columnErrors.has(col) ? "bg-red-50" : ""}`}
                        >
                          {String(row[col] ?? "")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Import */}
      {previewRows.length > 0 && !result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Badge className="bg-primary text-primary-foreground">4</Badge>
              İçe Aktar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  İçe aktarılıyor...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  İçe Aktar
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sonuç</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-medium">{result.created} oluşturuldu</span>
              </div>
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-blue-600" />
                <span className="font-medium">{result.updated} güncellendi</span>
              </div>
              {result.errors.length > 0 && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="font-medium text-red-600">{result.errors.length} hata</span>
                </div>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm font-medium text-red-700 mb-2">Hatalı Satırlar:</p>
                <ul className="text-sm text-red-600 space-y-1">
                  {result.errors.map((err, idx) => (
                    <li key={idx}>
                      Satır {err.row}: {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={resetForm}>
                Yeni İçe Aktarma
              </Button>
              <Button asChild>
                <Link href="/personnel">Personel Listesine Dön</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

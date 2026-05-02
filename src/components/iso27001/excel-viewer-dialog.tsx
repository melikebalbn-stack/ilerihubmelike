"use client"

import { useState, useEffect, useMemo } from "react"
import * as XLSX from "xlsx"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Download, Save, Loader2, Search, FileSpreadsheet, Pencil, X } from "lucide-react"
import { toast } from "sonner"

interface ExcelViewerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentId: string
  documentTitle: string
  fileUrl: string
  fileName: string
  canEdit?: boolean
  onVersionUploaded?: () => void
}

type SheetData = {
  name: string
  rows: string[][]
}

export function ExcelViewerDialog({
  open,
  onOpenChange,
  documentId,
  documentTitle,
  fileUrl,
  fileName,
  canEdit = false,
  onVersionUploaded,
}: ExcelViewerDialogProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sheets, setSheets] = useState<SheetData[]>([])
  const [activeSheet, setActiveSheet] = useState<string>("")
  const [editMode, setEditMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [originalBuffer, setOriginalBuffer] = useState<ArrayBuffer | null>(null)

  const resolvedUrl = fileUrl.startsWith("/api/") ? fileUrl : `/api/files${fileUrl}`

  useEffect(() => {
    if (!open) return
    setEditMode(false)
    setSearchQuery("")
    loadExcel()
  }, [open, fileUrl])

  const loadExcel = async () => {
    try {
      setLoading(true)
      const res = await fetch(resolvedUrl)
      if (!res.ok) throw new Error("Dosya alinamadi")
      const buffer = await res.arrayBuffer()
      setOriginalBuffer(buffer)

      const workbook = XLSX.read(buffer, { type: "array" })
      const parsed: SheetData[] = workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name]
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
          header: 1,
          defval: "",
          raw: false,
        }) as string[][]
        return { name, rows }
      })

      setSheets(parsed)
      setActiveSheet(parsed[0]?.name || "")
    } catch (error) {
      console.error("Excel okuma hatasi:", error)
      toast.error("Excel dosyasi okunamadi")
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadOriginal = () => {
    const a = document.createElement("a")
    a.href = resolvedUrl
    a.download = fileName || "dosya.xlsx"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const updateCell = (sheetName: string, rowIdx: number, colIdx: number, value: string) => {
    setSheets((prev) =>
      prev.map((s) => {
        if (s.name !== sheetName) return s
        const newRows = s.rows.map((r) => [...r])
        if (!newRows[rowIdx]) newRows[rowIdx] = []
        newRows[rowIdx][colIdx] = value
        return { ...s, rows: newRows }
      })
    )
  }

  const handleSaveAsNewVersion = async () => {
    if (!confirm("Degisiklikleri kaydedip yeni bir versiyon olusturmak istiyor musunuz?")) return

    try {
      setSaving(true)
      const workbook = XLSX.utils.book_new()
      sheets.forEach((s) => {
        const ws = XLSX.utils.aoa_to_sheet(s.rows)
        XLSX.utils.book_append_sheet(workbook, ws, s.name)
      })

      const wbBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" })
      const blob = new Blob([wbBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const file = new File([blob], fileName || "dosya.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })

      const formData = new FormData()
      formData.append("file", file)
      formData.append("changeDescription", "Tablo uzerinden duzenlendi")

      const res = await fetch(`/api/iso27001/documents/${documentId}/version`, {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Kaydetme basarisiz")
      }

      const data = await res.json()
      toast.success(data.message || "Yeni versiyon olusturuldu")
      setEditMode(false)
      onVersionUploaded?.()
      onOpenChange(false)
    } catch (error: any) {
      console.error("Kaydetme hatasi:", error)
      toast.error(error?.message || "Kaydedilemedi")
    } finally {
      setSaving(false)
    }
  }

  const currentSheet = useMemo(
    () => sheets.find((s) => s.name === activeSheet),
    [sheets, activeSheet]
  )

  const filteredRows = useMemo(() => {
    if (!currentSheet) return []
    if (!searchQuery.trim()) {
      return currentSheet.rows.map((row, idx) => ({ row, originalIdx: idx }))
    }
    const q = searchQuery.toLowerCase()
    return currentSheet.rows
      .map((row, idx) => ({ row, originalIdx: idx }))
      .filter(({ row, originalIdx }) => {
        if (originalIdx === 0) return true
        return row.some((cell) => String(cell ?? "").toLowerCase().includes(q))
      })
  }, [currentSheet, searchQuery])

  const maxCols = currentSheet
    ? Math.max(0, ...currentSheet.rows.map((r) => r.length))
    : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {documentTitle}
          </DialogTitle>
          <DialogDescription>{fileName}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 px-6 py-3 border-b bg-muted/30">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tabloda ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex-1" />
          {canEdit && !editMode && (
            <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Duzenle
            </Button>
          )}
          {editMode && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditMode(false)
                  loadExcel()
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Iptal
              </Button>
              <Button size="sm" onClick={handleSaveAsNewVersion} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Yeni Versiyon Olustur
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={handleDownloadOriginal}>
            <Download className="h-4 w-4 mr-2" />
            Excel Indir
          </Button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sheets.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Bu dosya bos veya okunamadi
            </div>
          ) : (
            <Tabs value={activeSheet} onValueChange={setActiveSheet} className="flex-1 flex flex-col overflow-hidden">
              {sheets.length > 1 && (
                <div className="px-6 pt-3 border-b">
                  <TabsList>
                    {sheets.map((s) => (
                      <TabsTrigger key={s.name} value={s.name}>
                        {s.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              )}

              {sheets.map((s) => (
                <TabsContent
                  key={s.name}
                  value={s.name}
                  className="flex-1 overflow-auto m-0 p-0 data-[state=inactive]:hidden"
                >
                  <div className="overflow-auto max-h-full">
                    <table className="w-full border-collapse text-sm">
                      <thead className="sticky top-0 bg-muted z-10">
                        <tr>
                          <th className="border px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground w-12">
                            #
                          </th>
                          {(s.rows[0] || []).map((cell, ci) => (
                            <th
                              key={ci}
                              className="border px-3 py-1.5 text-left text-xs font-semibold whitespace-nowrap"
                            >
                              {String(cell ?? "")}
                            </th>
                          ))}
                          {Array.from({
                            length: Math.max(0, maxCols - (s.rows[0]?.length || 0)),
                          }).map((_, i) => (
                            <th key={`empty-${i}`} className="border px-3 py-1.5" />
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows
                          .filter(({ originalIdx }) => originalIdx > 0)
                          .map(({ row, originalIdx }) => (
                            <tr key={originalIdx} className="hover:bg-muted/50">
                              <td className="border px-2 py-1 text-xs text-muted-foreground bg-muted/30">
                                {originalIdx}
                              </td>
                              {Array.from({ length: maxCols }).map((_, ci) => {
                                const value = String(row[ci] ?? "")
                                return (
                                  <td
                                    key={ci}
                                    className="border px-0 py-0 align-top"
                                  >
                                    {editMode ? (
                                      <input
                                        className="w-full px-3 py-1 bg-transparent outline-none focus:bg-blue-50 dark:focus:bg-blue-950 focus:ring-1 focus:ring-primary"
                                        value={value}
                                        onChange={(e) =>
                                          updateCell(s.name, originalIdx, ci, e.target.value)
                                        }
                                      />
                                    ) : (
                                      <div className="px-3 py-1 whitespace-pre-wrap break-words min-h-[28px]">
                                        {value}
                                      </div>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        {filteredRows.length <= 1 && (
                          <tr>
                            <td
                              colSpan={maxCols + 1}
                              className="text-center py-8 text-muted-foreground"
                            >
                              {searchQuery ? "Eslesen kayit yok" : "Veri yok"}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t bg-muted/30">
          <div className="text-xs text-muted-foreground mr-auto">
            {currentSheet
              ? `${Math.max(0, currentSheet.rows.length - 1)} satir, ${maxCols} sutun`
              : ""}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

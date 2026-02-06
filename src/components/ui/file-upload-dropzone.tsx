"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Upload, X, FileText, Image as ImageIcon, Paperclip } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export type UploadedFile = {
  name: string
  size: number
  type: string
  file?: File
  url?: string
}

interface FileUploadDropzoneProps {
  files: UploadedFile[]
  onFilesChange: (files: UploadedFile[]) => void
  maxFiles?: number
  maxSizeMB?: number
  accept?: string
  label?: string
}

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) {
    return <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" />
  }
  return <FileText className="h-4 w-4 text-gray-500 shrink-0" />
}

function FileThumbnail({ file }: { file: UploadedFile }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file.type.startsWith("image/")) return

    // If there is a server URL, use it directly
    if (file.url) {
      setObjectUrl(file.url)
      return
    }

    // Create an object URL for local File objects
    if (file.file) {
      const url = URL.createObjectURL(file.file)
      setObjectUrl(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [file])

  if (!file.type.startsWith("image/") || !objectUrl) {
    return getFileIcon(file.type)
  }

  return (
    <img
      src={objectUrl}
      alt={file.name}
      className="h-10 w-10 rounded object-cover shrink-0"
    />
  )
}

export function FileUploadDropzone({
  files,
  onFilesChange,
  maxFiles = 10,
  maxSizeMB = 10,
  accept = ".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx",
  label = "Dosya / Fotoğraf Ekle",
}: FileUploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const maxSizeBytes = maxSizeMB * 1024 * 1024

  const processFiles = useCallback(
    (incoming: FileList) => {
      const remaining = maxFiles - files.length
      if (remaining <= 0) {
        toast.error(`En fazla ${maxFiles} dosya yükleyebilirsiniz`)
        return
      }

      const newFiles: UploadedFile[] = []

      for (let i = 0; i < incoming.length; i++) {
        if (newFiles.length >= remaining) {
          toast.error(`En fazla ${maxFiles} dosya yükleyebilirsiniz`)
          break
        }

        const file = incoming[i]

        // Size check
        if (file.size > maxSizeBytes) {
          toast.error(`${file.name} dosyası çok büyük (max ${maxSizeMB}MB)`)
          continue
        }

        // Type check
        if (!ALLOWED_TYPES.includes(file.type)) {
          toast.error(`${file.name} desteklenmeyen dosya tipi`)
          continue
        }

        newFiles.push({
          name: file.name,
          size: file.size,
          type: file.type,
          file: file,
        })
      }

      if (newFiles.length > 0) {
        onFilesChange([...files, ...newFiles])
        toast.success(`${newFiles.length} dosya eklendi`)
      }
    },
    [files, onFilesChange, maxFiles, maxSizeBytes, maxSizeMB]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const droppedFiles = e.dataTransfer.files
      if (!droppedFiles || droppedFiles.length === 0) return
      processFiles(droppedFiles)
    },
    [processFiles]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files
      if (!selected) return
      processFiles(selected)

      // Reset input so re-selecting the same file triggers onChange
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    },
    [processFiles]
  )

  const removeFile = useCallback(
    (index: number) => {
      onFilesChange(files.filter((_, i) => i !== index))
    },
    [files, onFilesChange]
  )

  return (
    <div className="space-y-3">
      {label && (
        <Label className="flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          {label}
        </Label>
      )}

      {/* Dropzone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
          isDragging
            ? "border-blue-400 bg-blue-50"
            : "border-gray-200 hover:border-gray-300"
        )}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={handleFileSelect}
        />
        <Upload
          className={cn(
            "h-8 w-8 mx-auto mb-2",
            isDragging ? "text-blue-500" : "text-gray-400"
          )}
        />
        <p
          className={cn(
            "text-sm",
            isDragging ? "text-blue-600" : "text-gray-600"
          )}
        >
          {isDragging
            ? "Dosyayı buraya bırakın"
            : "Dosya yüklemek için tıklayın veya sürükleyin"}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          JPG, PNG, PDF, Word, Excel, PowerPoint (max {maxSizeMB}MB)
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
            >
              <FileThumbnail file={file} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  removeFile(index)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Upload, FileText, Image, X, Paperclip } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatFileSize } from "@/lib/suggestions-config"
import type { UploadedFile } from "@/types/suggestions"

interface FileUploadSectionProps {
  files: UploadedFile[]
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveFile: (index: number) => void
  fileInputRef: React.RefObject<HTMLInputElement>
  isDragging: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  accept?: string
  label?: string
  variant?: 'default' | 'fives'
}

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return <Image className="h-4 w-4" />
  return <FileText className="h-4 w-4" />
}

export function FileUploadSection({
  files,
  onFileSelect,
  onRemoveFile,
  fileInputRef,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  accept = ".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx",
  label = "Dosya Ekle",
  variant = 'default'
}: FileUploadSectionProps) {
  const isFives = variant === 'fives'

  return (
    <div className="col-span-2 space-y-3">
      <Label className="flex items-center gap-2">
        <Paperclip className="h-4 w-4" />
        {label}
      </Label>
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
          isDragging
            ? "border-blue-400 bg-blue-50"
            : isFives
              ? "border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50"
              : "border-gray-200 hover:border-gray-300"
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
          accept={accept}
          className="hidden"
          onChange={onFileSelect}
        />
        <Upload className={cn(
          "h-8 w-8 mx-auto mb-2",
          isDragging ? "text-blue-500" : isFives ? "text-emerald-500" : "text-gray-400"
        )} />
        <p className={cn("text-sm", isDragging ? "text-blue-600" : "text-gray-600")}>
          {isDragging ? "Dosyayı buraya bırakın" : "Dosya yüklemek için tıklayın veya sürükleyin"}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {isFives
            ? "Fotoğraf (JPG, PNG), Video (MP4, MOV), PDF, Word (max 10MB)"
            : "JPG, PNG, PDF, Word, Excel, PowerPoint (max 10MB)"
          }
        </p>
      </div>
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className={cn(
                "flex items-center gap-3 p-2 rounded-lg",
                isFives ? "bg-emerald-50" : "bg-gray-50"
              )}
            >
              {getFileIcon(file.type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemoveFile(index)}
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

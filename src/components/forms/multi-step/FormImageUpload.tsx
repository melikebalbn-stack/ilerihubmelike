'use client'

// PR-JOBAPP-RENDERER: Tek resim dosyası yükleme + preview.
// Backend kontratı: multipart/form-data'da File object olarak.

import { useRef, useState, useEffect } from 'react'
import { Upload, X, Image as ImageIcon } from 'lucide-react'

interface Props {
  value: File | null
  onChange: (file: File | null) => void
  maxSizeMB?: number
  disabled?: boolean
}

export function FormImageUpload({ value, onChange, maxSizeMB = 5, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!value) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(value)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [value])

  const handleSelect = (file: File | null) => {
    setError(null)
    if (!file) {
      onChange(null)
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('Sadece resim dosyaları kabul edilmektedir.')
      return
    }
    const maxBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxBytes) {
      setError(`Dosya boyutu ${maxSizeMB} MB'dan küçük olmalıdır.`)
      return
    }
    onChange(file)
  }

  const handleRemove = () => {
    onChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  if (previewUrl) {
    return (
      <div className="space-y-2">
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Yüklenen fotoğraf önizleme"
            className="max-h-48 rounded-lg border border-slate-200"
          />
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            className="absolute -top-2 -right-2 bg-white border border-slate-300 rounded-full p-1 shadow hover:bg-rose-50 hover:border-rose-300 transition-colors"
            aria-label="Kaldır"
          >
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>
        <p className="text-xs text-slate-500">{value?.name} · {(value!.size / 1024).toFixed(0)} KB</p>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="w-full border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-[#1B4F72]/60 hover:bg-slate-50 transition-colors disabled:opacity-50"
      >
        <ImageIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-600">
          <Upload className="w-4 h-4 inline mr-1" />
          Resim yüklemek için tıklayın
        </p>
        <p className="text-xs text-slate-400 mt-1">Maks. {maxSizeMB} MB · JPG / PNG / GIF</p>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleSelect(e.target.files?.[0] ?? null)}
      />
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  )
}

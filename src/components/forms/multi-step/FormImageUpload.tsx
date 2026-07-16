'use client'

// PR-JOBAPP-RENDERER: Tek resim dosyası yükleme + preview.
// Backend kontratı: multipart/form-data'da File object olarak.

import { useRef, useState, useEffect } from 'react'
import { Upload, X, Image as ImageIcon, Camera } from 'lucide-react'
import { FormCameraCapture } from './FormCameraCapture'

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
  const [cameraOpen, setCameraOpen] = useState(false)
  // İK kararı: kamera ÖNCELİKLİ. "Dosyadan Seç" yalnız kamera açılamazsa (izin reddi /
  // kamera yok) fallback olarak gösterilir → kimse bloke olmasın.
  const [cameraFallback, setCameraFallback] = useState(false)

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

  // PR-JOBAPP-CAMERA-AND-SUCCESS: Modal'dan gelen base64 dataURL → File.
  // NOT: fetch(dataUrl) KULLANMA — CSP connect-src 'data:' içermediği için
  // tarayıcı data: URL fetch'ini engeller ("Fotoğraf işlenemedi"). Base64'ü
  // doğrudan decode ediyoruz; ağ/CSP'ye hiç dokunmaz.
  const handleCameraCapture = (dataUrl: string) => {
    try {
      const [header, base64] = dataUrl.split(',')
      const mime = header.match(/data:(.*?);/)?.[1] ?? 'image/jpeg'
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const file = new File([bytes], `kamera-${Date.now()}.jpg`, { type: mime })
      handleSelect(file)
    } catch {
      setError('Fotoğraf işlenemedi.')
    }
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
        <p className="text-xs text-slate-500">
          {value?.name} · {(value!.size / 1024).toFixed(0)} KB
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* BİRİNCİL: Kameradan Çek (dolgulu, öne çıkan) */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setCameraOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-xl p-5 bg-[#1B4F72] text-white font-medium hover:bg-[#163d5a] transition-colors disabled:opacity-50"
      >
        <Camera className="w-6 h-6" />
        Kameradan Çek
      </button>
      <p className="text-xs text-slate-400 mt-1.5 text-center">Live preview · ön/arka kamera · Maks. {maxSizeMB} MB</p>

      {/* FALLBACK: yalnız kamera açılamazsa (izin reddi / kamera yok) "Dosyadan Seç" */}
      {cameraFallback && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="mt-3 w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl p-4 text-slate-700 hover:border-[#1B4F72]/60 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <ImageIcon className="w-5 h-5 text-slate-400" />
          <span className="text-sm font-medium">
            <Upload className="w-4 h-4 inline mr-1" />
            Dosyadan Seç
          </span>
          <span className="text-xs text-slate-400">(JPG / PNG / GIF)</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleSelect(e.target.files?.[0] ?? null)}
      />
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      <FormCameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCameraCapture}
        onUnavailable={() => setCameraFallback(true)}
      />
    </div>
  )
}

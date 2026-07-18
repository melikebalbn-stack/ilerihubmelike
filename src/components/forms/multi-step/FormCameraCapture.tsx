'use client'

// PR-JOBAPP-CAMERA-AND-SUCCESS: Live kamera preview + canvas çekim modal'ı.
//
// İlk denemede file input + capture="environment" attribute kullanılmıştı,
// ama:
//   - Desktop'ta capture ignore edilir, kullanıcı dosya seçici görür
//   - Mobile'da bile bazı tarayıcılar tutarsız davranır
// Bu component getUserMedia ile gerçek live preview + canvas frame
// yakalama yapar — desktop webcam + mobile/tablet arka kamera tek akışta.

import { useEffect, useRef, useState } from 'react'
import { Camera, RotateCw, X, Check } from 'lucide-react'

interface Props {
  open: boolean
  onCapture: (dataUrl: string) => void
  onClose: () => void
  // Kamera açılamazsa (izin reddi / kamera yok / diğer) çağrılır → çağıran taraf
  // galeri (Dosyadan Seç) fallback'ini gösterir. Kimse bloke olmasın (İK kararı).
  onUnavailable?: () => void
}

export function FormCameraCapture({ open, onCapture, onClose, onUnavailable }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [captured, setCaptured] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')

  useEffect(() => {
    if (!open) return

    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        setError(null)
      } catch (err) {
        const e = err as { name?: string; message?: string }
        setError(
          e.name === 'NotAllowedError'
            ? 'Kamera izni reddedildi. "Dosyadan Seç" ile fotoğraf yükleyebilirsiniz.'
            : e.name === 'NotFoundError'
              ? 'Kamera bulunamadı. "Dosyadan Seç" ile fotoğraf yükleyebilirsiniz.'
              : `Kamera açılamadı: ${e.message ?? 'bilinmeyen hata'}`
        )
        // Fallback'i aç: çağıran "Dosyadan Seç"i göstersin (kimse bloke olmasın).
        onUnavailable?.()
      }
    }

    start()

    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [open, facingMode])

  // Modal kapanınca state cleanup
  useEffect(() => {
    if (!open) {
      setCaptured(null)
      setError(null)
    }
  }, [open])

  const handleCapture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    setCaptured(canvas.toDataURL('image/jpeg', 0.85))
  }

  const handleConfirm = () => {
    if (!captured) return
    onCapture(captured)
    onClose()
  }

  const handleRetry = () => setCaptured(null)
  const flipCamera = () => setFacingMode((m) => (m === 'user' ? 'environment' : 'user'))

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-medium text-slate-900">Fotoğraf Çek</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative bg-black aspect-video">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center text-white p-6 text-center">
              <div>
                <p className="mb-3 text-sm">{error}</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium"
                >
                  Kapat
                </button>
              </div>
            </div>
          ) : captured ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={captured} alt="Çekilen fotoğraf" className="w-full h-full object-contain" />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={flipCamera}
                className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                aria-label="Kamerayı değiştir"
                title="Kamerayı değiştir"
              >
                <RotateCw className="w-5 h-5" />
              </button>
            </>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="px-5 py-4 flex items-center justify-center gap-3 border-t border-slate-200">
          {error ? null : captured ? (
            <>
              <button
                type="button"
                onClick={handleRetry}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Tekrar Çek
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-4 py-2 bg-[#1B4F72] text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-[#1B4F72]/90 transition-colors"
              >
                <Check className="w-4 h-4" />
                Bu Fotoğrafı Kullan
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleCapture}
              className="w-14 h-14 rounded-full bg-[#1B4F72] hover:bg-[#163d5a] flex items-center justify-center text-white transition-colors"
              aria-label="Çek"
              title="Çek"
            >
              <Camera className="w-7 h-7" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

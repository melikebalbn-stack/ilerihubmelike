'use client'

// PR-JOBAPP-RENDERER: Canvas-based signature pad.
// Mouse + touch events. Output: PNG base64 dataURL.
// 400×150 logical CSS px, devicePixelRatio ile retina destekli.

import { useRef, useEffect, useCallback } from 'react'
import { Eraser } from 'lucide-react'

interface Props {
  value: string // dataURL veya ''
  onChange: (dataUrl: string) => void
  disabled?: boolean
}

const CANVAS_W = 400
const CANVAS_H = 150
const STROKE_COLOR = '#1B4F72'
const STROKE_WIDTH = 2

export function FormSignaturePad({ value, onChange, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)
  const hasDrawnRef = useRef(false)

  // İlk mount + value değişince (örn. clear sonrası) canvas'ı temizle ya da
  // value verilmişse onu yükle.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = CANVAS_W * dpr
    canvas.height = CANVAS_H * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = STROKE_COLOR
    ctx.lineWidth = STROKE_WIDTH
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    if (value) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H)
      img.src = value
      hasDrawnRef.current = true
    } else {
      hasDrawnRef.current = false
    }
    // value yalnız 'reset' tetikleyicisi olarak izleniyor — sürekli effect
    // her stroke'ta çakışmasın diye intentional dep list küçük tutuldu.
  }, [value])

  const getPos = useCallback((evt: MouseEvent | TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = CANVAS_W / rect.width
    const scaleY = CANVAS_H / rect.height
    if ('touches' in evt) {
      const t = evt.touches[0] ?? evt.changedTouches[0]
      if (!t) return null
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY }
    }
    return { x: (evt.clientX - rect.left) * scaleX, y: (evt.clientY - rect.top) * scaleY }
  }, [])

  const startDraw = useCallback(
    (evt: MouseEvent | TouchEvent) => {
      if (disabled) return
      evt.preventDefault()
      const pos = getPos(evt)
      if (!pos) return
      drawingRef.current = true
      lastPosRef.current = pos
    },
    [disabled, getPos]
  )

  const draw = useCallback(
    (evt: MouseEvent | TouchEvent) => {
      if (!drawingRef.current || disabled) return
      evt.preventDefault()
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!ctx) return
      const pos = getPos(evt)
      if (!pos || !lastPosRef.current) return
      ctx.beginPath()
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      lastPosRef.current = pos
      hasDrawnRef.current = true
    },
    [disabled, getPos]
  )

  const endDraw = useCallback(() => {
    if (!drawingRef.current) return
    drawingRef.current = false
    lastPosRef.current = null
    const canvas = canvasRef.current
    if (!canvas) return
    if (hasDrawnRef.current) {
      onChange(canvas.toDataURL('image/png'))
    }
  }, [onChange])

  // Event listener attach — pasif touch için passive:false
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('mousedown', startDraw)
    canvas.addEventListener('mousemove', draw)
    window.addEventListener('mouseup', endDraw)
    canvas.addEventListener('touchstart', startDraw, { passive: false })
    canvas.addEventListener('touchmove', draw, { passive: false })
    canvas.addEventListener('touchend', endDraw)
    canvas.addEventListener('touchcancel', endDraw)
    return () => {
      canvas.removeEventListener('mousedown', startDraw)
      canvas.removeEventListener('mousemove', draw)
      window.removeEventListener('mouseup', endDraw)
      canvas.removeEventListener('touchstart', startDraw)
      canvas.removeEventListener('touchmove', draw)
      canvas.removeEventListener('touchend', endDraw)
      canvas.removeEventListener('touchcancel', endDraw)
    }
  }, [startDraw, draw, endDraw])

  const handleClear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    hasDrawnRef.current = false
    onChange('')
  }

  return (
    <div className="space-y-2">
      <div className="border border-slate-200 rounded-lg bg-white inline-block">
        <canvas
          ref={canvasRef}
          style={{ width: CANVAS_W, height: CANVAS_H, touchAction: 'none', maxWidth: '100%' }}
          className="block cursor-crosshair rounded-lg"
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Lütfen yukarıdaki alana imzanızı atın.</p>
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled || !value}
          className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Eraser className="w-3.5 h-3.5" />
          Temizle
        </button>
      </div>
    </div>
  )
}

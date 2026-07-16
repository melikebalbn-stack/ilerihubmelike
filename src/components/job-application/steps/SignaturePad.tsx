"use client";

// Canvas imza alanı — touch + mouse (Pointer Events). Temizle butonu; boş-imza takibi.
// onChange: çizim varsa PNG dataURL, boşsa null. Responsive (genişliğe uyar).

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";

const NAVY = "#1B4F72";

interface Props {
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
}

export function SignaturePad({ onChange, disabled = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasStroke = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  // Canvas'ı konteyner genişliğine göre ölçekle (retina için devicePixelRatio).
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ratio = window.devicePixelRatio || 1;
    const cssW = parent.clientWidth;
    const cssH = 180;
    canvas.width = cssW * ratio;
    canvas.height = cssH * ratio;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111";
    }
  }, []);

  useEffect(() => {
    setupCanvas();
    const onResize = () => {
      // Yeniden boyutlandırmada tuval temizlenir (basitlik) — kullanıcı yeniden imzalar.
      setupCanvas();
      hasStroke.current = false;
      setEmpty(true);
      onChange(null);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupCanvas]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!hasStroke.current) {
      hasStroke.current = true;
      setEmpty(false);
    }
  }
  function end(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    e.preventDefault();
    drawing.current = false;
    last.current = null;
    if (hasStroke.current && canvasRef.current) {
      onChange(canvasRef.current.toDataURL("image/png"));
    }
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    hasStroke.current = false;
    setEmpty(true);
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <div
        className="rounded-md border-2 border-dashed bg-white"
        style={{ borderColor: empty ? "#cbd5e1" : NAVY, touchAction: "none" }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
          className="block w-full cursor-crosshair"
          aria-label="İmza alanı"
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {empty ? "Parmağınız veya fareyle imzalayın" : "İmza alındı"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clear}
          disabled={disabled || empty}
          className="text-red-500 hover:text-red-700 h-8"
        >
          Temizle
        </Button>
      </div>
    </div>
  );
}

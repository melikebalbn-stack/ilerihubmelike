import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'IPRO Kiosk — Üretim Terminali',
}

// Kiosk = atölye dokunmatik terminali. Fullscreen, karanlık zemin, sidebar YOK.
// Dashboard layout'undan bağımsız (ayrı route segmenti). Tema toggle'a bağlı DEĞİL —
// atölye ortamı için sabit koyu zemin.
export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ipro-kiosk fixed inset-0 overflow-hidden bg-slate-950 text-slate-100 select-none">
      {children}
    </div>
  )
}

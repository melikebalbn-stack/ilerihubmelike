import type { Viewport } from 'next'

export const dynamic = 'force-dynamic'

// El terminali / tezgah ekranları — dashboard'dan TAMAMEN bağımsız sade kabuk.
// Sidebar/üst-nav/footer YOK. Mobil öncelikli, tezgah başı dokunmatik.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  // Okutma/veri girişi sırasında yanlışlıkla zoom olmasın.
  userScalable: false,
}

export default function TerminalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Genişlik kuralı YOK — bölüm layout'ları belirler (depo/menü dar, üretim tam ekran).
  return (
    <div className="flex min-h-screen w-full flex-col bg-neutral-50 dark:bg-neutral-950">
      {children}
    </div>
  )
}

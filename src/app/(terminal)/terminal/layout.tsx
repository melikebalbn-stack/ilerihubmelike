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
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col p-2">
        {children}
      </div>
    </div>
  )
}

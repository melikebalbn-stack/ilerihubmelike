export const dynamic = 'force-dynamic'

export const metadata = { title: 'Depo El Terminali' }

// Depo = 5.45" el terminali → dar kalıp (max-w-md). Üretim bu layout'a dahil değil,
// tam genişlikte kalır.
export default function DepoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col p-2">
      {children}
    </div>
  )
}

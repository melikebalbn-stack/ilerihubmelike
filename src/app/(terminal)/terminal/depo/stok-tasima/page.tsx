import Link from 'next/link'
import { ArrowLeft, Construction } from 'lucide-react'
import { requirePermission } from '@/lib/auth/require-permission'

export const dynamic = 'force-dynamic'

// Stok Taşıma (EL-1 placeholder). Akış sonraki fazda kurulacak. Guard: admin.system.manage.
export default async function StokTasimaPage() {
  const { error } = await requirePermission('admin.system.manage')
  if (error) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Bu ekran için yetkiniz bulunmuyor.
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 py-2">
      <div className="flex items-center gap-2 pt-1">
        <Link
          href="/terminal/depo"
          aria-label="Depo menüsüne dön"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors active:bg-muted/70"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">Stok Taşıma</h1>
      </div>

      <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
        <Construction className="h-10 w-10 opacity-60" />
        <p className="text-sm font-medium">Stok Taşıma — yapım aşamasında</p>
        <p className="text-xs">Akış sonraki fazda kurulacak.</p>
      </div>
    </div>
  )
}

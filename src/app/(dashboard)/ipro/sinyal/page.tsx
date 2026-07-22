import { redirect } from 'next/navigation'
import { Radio } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { SinyalClient } from '@/components/ipro/sinyal/SinyalClient'

export const dynamic = 'force-dynamic'

/**
 * Sinyal Takibi — PLC poller'ın canlı durumu (Melike #14).
 *
 * GUARD: middleware `/ipro/*` yollarını KAPSAMIYOR (src/middleware.ts matcher'ı) →
 * yetki kontrolü burada, server component'te yapılır. Bu ekran teşhis/altyapı
 * ekranıdır: `ipro.view` YETMEZ, `ipro.admin` gerekir.
 */
export default async function IproSinyalPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  const canAdmin = await hasPermission('ipro.admin')
  if (!canAdmin) redirect('/dashboard')

  return (
    <div className="container mx-auto max-w-[1600px] space-y-4 px-6 py-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1B4F72]">
          <Radio className="h-6 w-6" />
          Sinyal Takibi
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          PLC poller'ın canlı durumu: bağlantı sağlığı, hata sayaçları ve pin bazlı sayaç/duruş
          okumaları. 5 saniyede bir yenilenir; salt okuma — PLC'ye ve poller'a hiçbir şey yazılmaz.
        </p>
      </div>
      <SinyalClient />
    </div>
  )
}

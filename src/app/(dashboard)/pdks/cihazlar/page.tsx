import { redirect } from 'next/navigation'
import { DoorOpen } from 'lucide-react'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { CihazlarClient } from '@/components/pdks/CihazlarClient'

export const dynamic = 'force-dynamic'

// PDKS Faz 1 — geçiş kontrol panelleri, kapılar ve okuyucular (yön). Guard sidebar ile birebir: pdks.manage.
export default async function PdksCihazlarPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')

  if (!(await hasPermission('pdks.manage'))) return <YetkisizErisim permission="pdks.manage" />

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1B4F72]">
          <DoorOpen className="h-6 w-6" />
          PDKS · Cihazlar &amp; Turnikeler
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Geçiş kontrol panelleri (Hikvision ISAPI), turnikeler ve okuyucu yönleri. Kimlik bilgileri sunucu
          .env dosyasında tutulur; bu ekranda yalnız tanımlı olup olmadığı görünür.
        </p>
      </div>
      <CihazlarClient />
    </div>
  )
}

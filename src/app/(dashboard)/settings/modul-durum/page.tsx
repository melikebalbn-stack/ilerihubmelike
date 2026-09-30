import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { YetkisizErisim } from '@/components/YetkisizErisim'
import { requireUser } from '@/lib/auth/require-user'
import { prisma } from '@/lib/prisma'
import { MODUL_KAYDI } from '@/lib/modul-durum/kayit'
import { modulYayinlari } from '@/lib/modul-durum/sunucu'
import { ModulDurumPaneli } from '@/components/settings/modul-durum-paneli'

// Ayarlar > Modül Yayın Durumu — yeni modüller canlıya çıkar ama yayına
// SUPER_ADMIN açar. Kayıttaki modüller: src/lib/modul-durum/kayit.ts
export default async function ModulDurumPage() {
  const { user, error } = await requireUser()
  if (error) redirect('/login')
  if (user.role !== 'SUPER_ADMIN') return <YetkisizErisim />

  const [yayinlar, bolumSatirlari] = await Promise.all([
    modulYayinlari(),
    prisma.personnel.findMany({
      where: { aktif: true, bolum: { not: '' } },
      select: { bolum: true },
      distinct: ['bolum'],
      orderBy: { bolum: 'asc' },
    }),
  ])

  const moduller = MODUL_KAYDI.map((m) => {
    const y = yayinlar.get(m.anahtar)
    return {
      anahtar: m.anahtar,
      etiket: m.etiket,
      rota: m.rota,
      durum: y?.durum ?? ('ACIK' as const),
      pilotBolumler: y?.pilotBolumler ?? [],
    }
  })

  const bolumler = bolumSatirlari.map((b) => b.bolum).filter(Boolean)

  return (
    <div className="p-6 space-y-6">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/settings" className="hover:text-foreground">
          Ayarlar
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">Modül Yayın Durumu</span>
      </nav>

      <div>
        <h1 className="text-2xl font-semibold">Modül Yayın Durumu</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Yeni modüller canlıya çıkabilir ama yayına burada açılır. Gizli ve pilot modüller
          menüde görünmez, adresi yazan 404 alır, cron ve bildirimleri susar.
        </p>
      </div>

      <ModulDurumPaneli moduller={moduller} bolumler={bolumler} />
    </div>
  )
}

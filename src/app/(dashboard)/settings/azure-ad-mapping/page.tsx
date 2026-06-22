import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Network } from 'lucide-react'
import { requireUser } from '@/lib/auth/require-user'
import { prisma } from '@/lib/prisma'
import { MappingClient } from './mapping-client'

export default async function AzureAdMappingPage() {
  const { user, error } = await requireUser()
  if (error) redirect('/login')
  if (user.role !== 'SUPER_ADMIN') redirect('/dashboard')

  const allRoles = await prisma.role.findMany({
    select: { id: true, slug: true, name: true, isSystem: true },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  })

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      <nav className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
        <Link href="/settings" className="hover:text-foreground">
          Ayarlar
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span>Yetkilendirme</span>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">AD Grup Mapping</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Network className="h-6 w-6 text-teal-600" />
          AD Grup ↔ Rol Eşlemeleri
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Active Directory grup üyeliğini ILERIHub rollerine bağla. Sync
          sırasında <code>source=&apos;azure_ad&apos;</code> kayıtları otomatik atanır;
          manuel atamalar dokunulmaz.
        </p>
      </div>

      <MappingClient allRoles={allRoles} />
    </div>
  )
}

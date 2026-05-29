import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/require-user'
import { hasPermission } from '@/lib/auth/has-permission'
import { prisma } from '@/lib/prisma'
import { SymbolsAdminClient, type SymbolRow } from '@/components/quality/SymbolsAdminClient'

export const dynamic = 'force-dynamic'

export default async function SymbolsAdminPage() {
  const { error } = await requireUser()
  if (error) redirect('/login')
  if (!(await hasPermission('quality.symbol.manage'))) redirect('/dashboard')

  const symbols = await prisma.qualitySymbol.findMany({
    orderBy: [{ isSystem: 'desc' }, { displayOrder: 'asc' }],
    select: {
      id: true,
      key: true,
      nameTr: true,
      nameEn: true,
      svgContent: true,
      displayOrder: true,
      active: true,
      isSystem: true,
    },
  })

  const rows: SymbolRow[] = symbols

  return (
    <div className="container mx-auto px-6 py-8 max-w-[1200px] space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1B4F72]">GD&T Semboller</h1>
        <p className="text-sm text-slate-500 mt-1">
          Standart ISO 1101 / ASME Y14.5 sembolleri ve şirket içi özel semboller.
          Standart sembollerin glyph'i ve durumu kilitlidir; yalnızca etiket ve
          sıralama değiştirilebilir.
        </p>
      </div>

      <SymbolsAdminClient initialSymbols={rows} />
    </div>
  )
}

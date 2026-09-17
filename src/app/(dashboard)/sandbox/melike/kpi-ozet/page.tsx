'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, LayoutDashboard } from 'lucide-react'

const NAVY = '#1B4F72'

interface OzetKpiSirasi {
  id: string
  name: string
  oran: number
}

interface DepartmanOzeti {
  orgUnitId: string
  name: string
  kpiSayisi: number
  genelOran: number | null
  enBasarili: OzetKpiSirasi[]
  enBasarisiz: OzetKpiSirasi[]
}

function oranRengi(oran: number): string {
  if (oran >= 80) return '#16a34a'
  if (oran >= 50) return '#d97706'
  return '#dc2626'
}

export default function KpiOzetPage() {
  const router = useRouter()
  const [ozet, setOzet] = useState<DepartmanOzeti[] | null>(null)

  useEffect(() => {
    fetch('/api/sandbox/melike/kpi/ozet')
      .then(res => res.json())
      .then(d => setOzet(d.ozet ?? []))
      .catch(() => setOzet([]))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
            <LayoutDashboard className="h-6 w-6 lg:h-7 lg:w-7" style={{ color: NAVY }} />
            KPI Özet
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Departman bazlı genel başarı oranı, en başarılı ve en başarısız KPI'lar
          </p>
        </div>
        <Link href="/sandbox/melike/kpi">
          <Button size="sm" variant="outline">← KPI Takip</Button>
        </Link>
      </div>

      {!ozet ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ozet.map(d => (
            <Card
              key={d.orgUnitId}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`/sandbox/melike/kpi?departman=${d.orgUnitId}`)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{d.name}</span>
                  {d.genelOran != null && (
                    <span className="text-lg font-bold" style={{ color: oranRengi(d.genelOran) }}>%{d.genelOran}</span>
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{d.kpiSayisi} KPI</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {d.kpiSayisi === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Henüz KPI tanımlanmamış</p>
                ) : d.genelOran == null ? (
                  <p className="text-sm text-muted-foreground py-2">Henüz ölçüm verisi yok</p>
                ) : (
                  <>
                    {d.enBasarili.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">En başarılı</p>
                        {d.enBasarili.map(k => (
                          <div key={k.id} className="flex items-center justify-between text-sm py-0.5">
                            <span className="truncate pr-2">{k.name}</span>
                            <span className="font-medium" style={{ color: oranRengi(k.oran) }}>%{k.oran}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {d.enBasarisiz.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">En başarısız</p>
                        {d.enBasarisiz.map(k => (
                          <div key={k.id} className="flex items-center justify-between text-sm py-0.5">
                            <span className="truncate pr-2">{k.name}</span>
                            <span className="font-medium" style={{ color: oranRengi(k.oran) }}>%{k.oran}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

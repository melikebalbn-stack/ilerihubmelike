'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { ArrowUpRight, Clock, Loader2, UserCheck, UserX, AlertTriangle, CalendarClock, CalendarX } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

type Veri = {
  bugun: string
  aktifSayi: number
  bugunOzet: { gelen: number; gelmedi: number; gec: number; eksik: number; izinli: number }
  ay: { toplamGecDk: number; gelmediGunu: number; mesaiDk: number; toleransIciGec: number }
  trend: { gun: string; gec: number; gelmedi: number }[]
}

const saat = (dk: number) => `${Math.floor(dk / 60)} sa ${String(dk % 60).padStart(2, '0')} dk`
const gunKisa = (g: string) => {
  const [, a, d] = g.split('-')
  const aylar = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
  return `${d} ${aylar[Number(a) - 1]}`
}

function Kpi({ ikon, etiket, deger, alt, renk }: { ikon: React.ReactNode; etiket: string; deger: string | number; alt?: string; renk: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${renk}`}>{ikon}</div>
        <div className="min-w-0">
          <div className="text-xs text-slate-500">{etiket}</div>
          <div className="text-xl font-bold tabular-nums text-slate-800">{deger}</div>
          {alt && <div className="text-xs text-slate-400">{alt}</div>}
        </div>
      </CardContent>
    </Card>
  )
}

export function DashboardClient() {
  const [veri, setVeri] = useState<Veri | null>(null)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    let iptal = false
    fetch('/api/pdks/dashboard')
      .then((r) => r.json())
      .then((j) => {
        if (iptal) return
        if (j.ok) setVeri(j as Veri)
        else setHata(j.error ?? 'Veri alınamadı')
      })
      .catch(() => !iptal && setHata('Veri alınamadı'))
    return () => {
      iptal = true
    }
  }, [])

  if (hata) return <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{hata}</div>
  if (!veri) return <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…</div>

  const { bugunOzet: b, ay, trend } = veri
  return (
    <div className="space-y-6">
      {/* Bugün */}
      <div>
        <div className="mb-2 text-sm font-medium text-slate-600">Bugün ({veri.aktifSayi} aktif personel)</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Kpi ikon={<UserCheck className="h-5 w-5 text-blue-700" />} renk="bg-blue-50" etiket="Gelen" deger={b.gelen} />
          <Kpi ikon={<UserX className="h-5 w-5 text-slate-600" />} renk="bg-slate-100" etiket="Gelmedi" deger={b.gelmedi} />
          <Kpi ikon={<Clock className="h-5 w-5 text-amber-700" />} renk="bg-amber-50" etiket="Geç gelen" deger={b.gec} />
          <Kpi ikon={<AlertTriangle className="h-5 w-5 text-amber-700" />} renk="bg-amber-50" etiket="Eksik kayıt" deger={b.eksik} />
          <Kpi ikon={<CalendarClock className="h-5 w-5 text-blue-700" />} renk="bg-blue-50" etiket="İzinli" deger={b.izinli} />
        </div>
      </div>

      {/* Bu ay */}
      <div>
        <div className="mb-2 text-sm font-medium text-slate-600">Bu ay (ay başından bugüne)</div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi ikon={<Clock className="h-5 w-5 text-amber-700" />} renk="bg-amber-50" etiket="Toplam geç" deger={saat(ay.toplamGecDk)} />
          <Kpi ikon={<CalendarX className="h-5 w-5 text-slate-600" />} renk="bg-slate-100" etiket="Devamsızlık" deger={`${ay.gelmediGunu} gün`} />
          <Kpi ikon={<CalendarClock className="h-5 w-5 text-blue-700" />} renk="bg-blue-50" etiket="Onaylı mesai" deger={saat(ay.mesaiDk)} />
          <Kpi ikon={<AlertTriangle className="h-5 w-5 text-amber-700" />} renk="bg-amber-50" etiket="Tolerans-içi geç" deger={ay.toleransIciGec} alt="4+'sı İV'ye düşer" />
        </div>
      </div>

      {/* 14 gün trend */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 text-sm font-medium text-slate-600">Son 14 gün — geç gelen / gelmeyen (kişi)</div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="gun" tickFormatter={gunKisa} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip
                  labelFormatter={(l) => gunKisa(String(l))}
                  formatter={(v, n) => [v, n === 'gec' ? 'Geç gelen' : 'Gelmeyen']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Legend formatter={(n) => (n === 'gec' ? 'Geç gelen' : 'Gelmeyen')} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="gec" fill="#d97706" radius={[3, 3, 0, 0]} />
                <Bar dataKey="gelmedi" fill="#94a3b8" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Link href="/pdks/puantaj" className="inline-flex items-center gap-1 text-sm font-medium text-[#1B4F72] hover:underline">
        Günlük puantaj ayrıntısı <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

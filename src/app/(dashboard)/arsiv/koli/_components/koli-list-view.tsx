import Link from 'next/link'
import { KoliListHeader } from './koli-list-header'

type Koli = {
  id: string
  arsivNo: string
  bolum: { id: number; ad: string; kod: string; renkHex: string }
  lokasyon: { id: number; depoNo: string; rafKodu: string; siraNo: number } | null
  sorumlu: { id: string; name: string | null; email: string }
  durum: 'Aktif' | 'Arsivde' | 'ImhaYaklasti' | 'ImhaEdildi'
  tarihAraligiBaslangic: string
  tarihAraligiSonu: string
  imhaTarihi: string
  arsivlemeTarihi: string
  aciklama: string | null
  _count: { altKoliler: number }
}

const DURUM_LABEL: Record<Koli['durum'], string> = {
  Aktif: 'Aktif',
  Arsivde: 'Arşivde',
  ImhaYaklasti: 'İmha Yaklaştı',
  ImhaEdildi: 'İmha Edildi',
}

const DURUM_STYLE: Record<Koli['durum'], string> = {
  Aktif: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  Arsivde: 'bg-slate-100 text-slate-800 border-slate-300',
  ImhaYaklasti: 'bg-amber-100 text-amber-800 border-amber-300',
  ImhaEdildi: 'bg-rose-100 text-rose-800 border-rose-300',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatYearRange(bas: string, son: string): string {
  const by = new Date(bas).getFullYear()
  const sy = new Date(son).getFullYear()
  return by === sy ? `${by}` : `${by}–${sy}`
}

export default function KoliListView({
  items,
  sortKey,
  sortDir,
}: {
  items: Koli[]
  sortKey: string | null
  sortDir: 'asc' | 'desc'
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
        <p className="text-slate-500">Kriterlere uyan koli yok.</p>
      </div>
    )
  }

  return (
    <>
      {/* Mobil: Kart grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:hidden">
        {items.map((k) => (
          <Link
            key={k.id}
            href={`/arsiv/koli/${k.arsivNo}`}
            className="rounded-lg border border-slate-200 bg-white overflow-hidden hover:shadow-md transition"
          >
            <div className="h-2" style={{ backgroundColor: k.bolum.renkHex }} />
            <div className="p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono text-sm font-semibold">{k.arsivNo}</div>
                  <div className="text-xs text-slate-600 mt-0.5">{k.bolum.ad}</div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium border ${DURUM_STYLE[k.durum]}`}
                >
                  {DURUM_LABEL[k.durum]}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-2">
                <span>📅 {formatYearRange(k.tarihAraligiBaslangic, k.tarihAraligiSonu)}</span>
                <span>📦 {k._count.altKoliler} alt</span>
                {k.lokasyon && (
                  <span>📍 {k.lokasyon.depoNo}/{k.lokasyon.rafKodu}/{k.lokasyon.siraNo}</span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Masaüstü: Tablo */}
      <div className="hidden md:block rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <KoliListHeader currentSort={sortKey} currentDir={sortDir} />
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((k) => (
              <tr key={k.id} className="hover:bg-slate-50 cursor-pointer">
                <td className="px-4 py-2.5">
                  <Link
                    href={`/arsiv/koli/${k.arsivNo}`}
                    className="font-mono text-slate-900 hover:underline"
                  >
                    {k.arsivNo}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: k.bolum.renkHex }}
                    />
                    <span className="font-medium">{k.bolum.kod}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {formatYearRange(k.tarihAraligiBaslangic, k.tarihAraligiSonu)}
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {k.lokasyon ? (
                    `${k.lokasyon.depoNo}/${k.lokasyon.rafKodu}/${k.lokasyon.siraNo}`
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {k.sorumlu.name ?? k.sorumlu.email}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{k._count.altKoliler}</td>
                <td className="px-4 py-2.5 text-slate-600">{formatDate(k.imhaTarihi)}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium border ${DURUM_STYLE[k.durum]}`}
                  >
                    {DURUM_LABEL[k.durum]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

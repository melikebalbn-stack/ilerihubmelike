'use client'

import { useRouter, usePathname } from 'next/navigation'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

const COLUMNS = [
  { key: 'arsivNo',      label: 'Arşiv No'  },
  { key: 'bolum',        label: 'Bölüm'     },
  { key: 'donem',        label: 'Dönem'     },
  { key: 'lokasyon',     label: 'Lokasyon'  },
  { key: 'sorumlu',      label: 'Sorumlu'   },
  { key: 'altKoliCount', label: 'Alt'       },
  { key: 'imhaTarihi',   label: 'İmha'      },
  { key: 'durum',        label: 'Durum'     },
] as const

type Props = {
  currentSort: string | null
  currentDir: 'asc' | 'desc'
}

export function KoliListHeader({ currentSort, currentDir }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function handleSort(key: string) {
    // window.location.search: router.push sonrası ANINDA güncellenir,
    // server cevabını beklemez — her tıklamada gerçek URL'yi okur.
    const params = new URLSearchParams(window.location.search)
    const activeSort = params.get('sort')
    const activeDir: 'asc' | 'desc' = params.get('dir') === 'desc' ? 'desc' : 'asc'

    if (activeSort !== key) {
      params.set('sort', key)
      params.set('dir', 'asc')
    } else if (activeDir === 'asc') {
      params.set('sort', key)
      params.set('dir', 'desc')
    } else {
      params.delete('sort')
      params.delete('dir')
    }

    params.delete('page')
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <tr>
      {COLUMNS.map((col) => {
        const isActive = currentSort === col.key
        const Icon = !isActive
          ? ChevronsUpDown
          : currentDir === 'asc'
            ? ChevronUp
            : ChevronDown

        return (
          <th key={col.key} className="text-left px-4 py-2.5">
            <button
              type="button"
              onClick={() => handleSort(col.key)}
              className={`flex items-center gap-1 text-sm font-medium transition-colors hover:text-slate-900 ${
                isActive ? 'text-slate-900' : 'text-slate-600'
              }`}
            >
              {col.label}
              <Icon size={13} className={isActive ? 'opacity-100' : 'opacity-35'} />
            </button>
          </th>
        )
      })}
    </tr>
  )
}

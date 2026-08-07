'use client'

import { type ReactNode, useState } from 'react'
import { ClipboardCheck, UserCheck } from 'lucide-react'
import { TeslimTakipListesi } from './TeslimTakipListesi'

// IV / Envanter — "Zimmetler" sekmesinin iki görünümü arasındaki geçiş.
// "Zimmet Ver" görünümü page.tsx içindeki PersonelZimmeti'dir; buraya
// zimmetSlot ile verilir (PersonelZimmeti page.tsx'te kalır, taşınmaz).

export function ZimmetVeTeslimListesi({ zimmetSlot }: { zimmetSlot: ReactNode }) {
  const [gorunum, setGorunum] = useState<'zimmet' | 'liste'>('zimmet')

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          onClick={() => setGorunum('zimmet')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            gorunum === 'zimmet' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Zimmet Ver
        </button>
        <button
          type="button"
          onClick={() => setGorunum('liste')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            gorunum === 'liste' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ClipboardCheck className="h-4 w-4" />
          Teslim Takip Listesi
        </button>
      </div>
      {gorunum === 'zimmet' ? zimmetSlot : <TeslimTakipListesi />}
    </div>
  )
}

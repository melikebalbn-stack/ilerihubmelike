'use client'

import Link from 'next/link'
import { Printer } from 'lucide-react'

type Props = {
  koli: {
    arsivNo: string
    bolum: { ad: string; kod: string; renkHex: string }
    durum: 'Aktif' | 'Arsivde' | 'ImhaYaklasti' | 'ImhaEdildi'
  }
  canEdit: boolean
  onEditClick: () => void
}

const DURUM_LABEL = {
  Aktif: 'Aktif',
  Arsivde: 'Arşivde',
  ImhaYaklasti: 'İmha Yaklaştı',
  ImhaEdildi: 'İmha Edildi',
} as const

const DURUM_STYLE = {
  Aktif: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  Arsivde: 'bg-slate-100 text-slate-800 border-slate-300',
  ImhaYaklasti: 'bg-amber-100 text-amber-800 border-amber-300',
  ImhaEdildi: 'bg-rose-100 text-rose-800 border-rose-300',
} as const

/**
 * Header card'ı — sadece görsel + Düzenle butonu callback'i.
 * Modal state ve refreshKey artık parent (`KoliDetailClient`) yönetir.
 */
export default function KoliDetayHeader({ koli, canEdit, onEditClick }: Props) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="h-2" style={{ backgroundColor: koli.bolum.renkHex }} />
      <div className="p-5 flex items-center justify-between flex-wrap gap-4">
        <div>
          <Link
            href="/arsiv/koli"
            className="text-sm text-slate-500 hover:underline"
          >
            ← Liste
          </Link>
          <div className="flex items-baseline gap-3 mt-1">
            <h1 className="font-mono text-2xl font-semibold text-slate-900">
              {koli.arsivNo}
            </h1>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium border ${DURUM_STYLE[koli.durum]}`}
            >
              {DURUM_LABEL[koli.durum]}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full mr-2"
              style={{ backgroundColor: koli.bolum.renkHex }}
            />
            {koli.bolum.kod} — {koli.bolum.ad}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/arsiv/koli/${koli.arsivNo}/etiket`}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            <Printer size={16} />
            <span>Etiket Bas</span>
          </Link>
          {canEdit && (
            <button
              onClick={onEditClick}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Düzenle
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

export default function KoliPagination({
  page,
  limit,
  total,
}: {
  page: number
  limit: number
  total: number
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const totalPages = Math.max(1, Math.ceil(total / limit))

  if (totalPages <= 1) return null

  function goTo(newPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(newPage))
    startTransition(() => {
      router.push(`?${params.toString()}`)
    })
  }

  const showPages: number[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) showPages.push(i)
  } else {
    showPages.push(1)
    if (page > 3) showPages.push(-1)
    for (
      let i = Math.max(2, page - 1);
      i <= Math.min(totalPages - 1, page + 1);
      i++
    ) {
      showPages.push(i)
    }
    if (page < totalPages - 2) showPages.push(-1)
    showPages.push(totalPages)
  }

  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <p className="text-sm text-slate-600">
        Sayfa {page} / {totalPages} • Toplam {total} kayıt
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => goTo(page - 1)}
          disabled={page <= 1 || isPending}
          className="px-3 py-1.5 rounded border border-slate-300 text-sm hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← Önceki
        </button>
        {showPages.map((p, i) =>
          p === -1 ? (
            <span key={`e${i}`} className="px-2 text-slate-400">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => goTo(p)}
              disabled={isPending}
              className={`px-3 py-1.5 rounded text-sm ${
                p === page
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-300 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => goTo(page + 1)}
          disabled={page >= totalPages || isPending}
          className="px-3 py-1.5 rounded border border-slate-300 text-sm hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Sonraki →
        </button>
      </div>
    </div>
  )
}

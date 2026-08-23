"use client"

import { useEffect, useRef, useState } from "react"
import { MoreHorizontal } from "lucide-react"

// Kart üzerindeki işlem menüsü. Buradaki her işlem O KUTUYA özeldir: üst birim,
// kaynak kutu ve kaynak koltuk zaten bellidir, kullanıcıya sorulmaz.
// Yalnız hasFullAccess olan kullanıcıda render edilir (çağıran taraf kapıyı tutar).

export type KartIslem =
  | "pozisyonEkle"
  | "birimEkle"
  | "uyeAta"
  | "ustBirim"
  | "raporlama"
  | "sil"

interface Props {
  /** Menüdeki hangi işlemler geçerli — kutu tipine göre çağıran belirler. */
  islemler: { id: KartIslem; etiket: string; tehlikeli?: boolean; pasifSebep?: string }[]
  onSec: (islem: KartIslem) => void
}

export default function KartIslemMenusu({ islemler, onSec }: Props) {
  const [acik, setAcik] = useState(false)
  const kap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!acik) return
    const dis = (e: MouseEvent) => {
      if (kap.current && !kap.current.contains(e.target as Node)) setAcik(false)
    }
    document.addEventListener("mousedown", dis)
    return () => document.removeEventListener("mousedown", dis)
  }, [acik])

  return (
    <div ref={kap} className="relative print:hidden" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label="Kutu işlemleri"
        title="Kutu işlemleri"
        data-kart-menu="1"
        onClick={(e) => {
          e.stopPropagation()
          setAcik((a) => !a)
        }}
        className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>

      {acik && (
        <div
          data-kart-menu-icerik="1"
          className="absolute right-0 z-50 mt-1 w-44 rounded-md border bg-popover py-1 shadow-lg"
        >
          {islemler.map((i) => (
            <button
              key={i.id}
              type="button"
              disabled={!!i.pasifSebep}
              title={i.pasifSebep}
              onClick={(e) => {
                e.stopPropagation()
                setAcik(false)
                onSec(i.id)
              }}
              className={[
                "block w-full px-3 py-1.5 text-left text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40",
                i.tehlikeli ? "text-rose-700 hover:bg-rose-50" : "",
              ].join(" ")}
            >
              {i.etiket}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

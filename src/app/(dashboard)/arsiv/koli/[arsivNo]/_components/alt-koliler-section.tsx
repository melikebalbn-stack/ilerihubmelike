'use client'

/**
 * AltKolilerSection — Alt koli grid + ekle/düzenle/sil modal yönetimi.
 *
 * Slot pattern karar: Mevcut alt-koliler-grid.tsx Server Component'ti ve
 * KoliDetailClient'a slot olarak geçiyordu. Modal state'i için Client
 * gerektiğinden, bu component KoliDetailClient içinden veri ile render
 * edilir (slot'tan çıkarıldı). onChanged callback refreshKey bump +
 * router.refresh() yapar (KoliDetailClient'tan geçer).
 */

import { useState } from 'react'
import { MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { AltKoliFormModal } from './alt-koli-form-modal'
import { AltKoliMetadataEditModal } from './alt-koli-metadata-edit-modal'
import { AltKoliDeleteModal } from './alt-koli-delete-modal'

type Gizlilik = 'KamuyaAcik' | 'SirketIci' | 'Gizli' | 'CokGizli'

export type AltKoli = {
  id: string
  altArsivNo: string
  harf: string
  evrakTuru: { id: number; ad: string; varsayilanSaklamaYili: number }
  saklamaSuresiYil: number
  donemBaslangic: string
  donemSonu: string
  aciklama: string | null
  hazirlayan: string | null
  evrakSayisi: number | null
  gizlilikSeviyesi: Gizlilik
  imhaTarihi: string
}

type Props = {
  arsivNo: string
  bolumId: number
  anaKoliDonemBaslangic: string
  anaKoliDonemSonu: string
  altKoliler: AltKoli[]
  canEdit: boolean
  onChanged: () => void
}

const GIZLILIK_LABEL: Record<Gizlilik, string> = {
  KamuyaAcik: 'Kamuya Açık',
  SirketIci: 'Şirket İçi',
  Gizli: 'Gizli',
  CokGizli: 'Çok Gizli',
}

const GIZLILIK_STYLE: Record<Gizlilik, string> = {
  KamuyaAcik: 'bg-emerald-100 text-emerald-800',
  SirketIci: 'bg-slate-100 text-slate-800',
  Gizli: 'bg-amber-100 text-amber-800',
  CokGizli: 'bg-rose-100 text-rose-800',
}

function formatYearRange(bas: string, son: string): string {
  const by = new Date(bas).getFullYear()
  const sy = new Date(son).getFullYear()
  return by === sy ? `${by}` : `${by}–${sy}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function AltKolilerSection({
  arsivNo,
  bolumId,
  anaKoliDonemBaslangic,
  anaKoliDonemSonu,
  altKoliler,
  canEdit,
  onChanged,
}: Props) {
  const [ekleOpen, setEkleOpen] = useState(false)
  const [duzenleAlt, setDuzenleAlt] = useState<AltKoli | null>(null)
  const [silAlt, setSilAlt] = useState<AltKoli | null>(null)

  const canAddMore = altKoliler.length < 26 && canEdit

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">
        Alt Koliler ({altKoliler.length})
      </h2>

      {altKoliler.length === 0 && !canAddMore ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm">
          Bu koli&apos;de alt koli yok.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {altKoliler.map((alt) => (
            <AltKoliCard
              key={alt.id}
              alt={alt}
              canEdit={canEdit}
              onEdit={() => setDuzenleAlt(alt)}
              onDelete={() => setSilAlt(alt)}
            />
          ))}

          {canAddMore && (
            <button
              type="button"
              onClick={() => setEkleOpen(true)}
              className="border-2 border-dashed border-slate-300 rounded-lg p-4 flex flex-col items-center justify-center gap-2 text-slate-500 hover:bg-slate-50 hover:border-slate-400 transition-colors min-h-[140px]"
            >
              <Plus size={24} />
              <span className="text-sm font-medium">Alt Koli Ekle</span>
              <span className="text-xs">{altKoliler.length}/26</span>
            </button>
          )}
        </div>
      )}

      {altKoliler.length >= 26 && (
        <p className="text-xs text-slate-500">
          Maksimum 26 alt koli sınırına ulaşıldı.
        </p>
      )}

      <AltKoliFormModal
        open={ekleOpen}
        onClose={() => setEkleOpen(false)}
        onSaved={() => {
          setEkleOpen(false)
          onChanged()
        }}
        arsivNo={arsivNo}
        bolumId={bolumId}
        anaKoliDonemBaslangic={anaKoliDonemBaslangic}
        anaKoliDonemSonu={anaKoliDonemSonu}
      />

      {duzenleAlt && (
        <AltKoliMetadataEditModal
          open={!!duzenleAlt}
          onClose={() => setDuzenleAlt(null)}
          onSaved={() => {
            setDuzenleAlt(null)
            onChanged()
          }}
          altArsivNo={duzenleAlt.altArsivNo}
          initial={{
            aciklama: duzenleAlt.aciklama,
            hazirlayan: duzenleAlt.hazirlayan,
            evrakSayisi: duzenleAlt.evrakSayisi,
            gizlilikSeviyesi: duzenleAlt.gizlilikSeviyesi,
          }}
        />
      )}

      {silAlt && (
        <AltKoliDeleteModal
          open={!!silAlt}
          onClose={() => setSilAlt(null)}
          onDeleted={() => {
            setSilAlt(null)
            onChanged()
          }}
          altArsivNo={silAlt.altArsivNo}
          evrakTuruAdi={silAlt.evrakTuru.ad}
        />
      )}
    </section>
  )
}

function AltKoliCard({
  alt,
  canEdit,
  onEdit,
  onDelete,
}: {
  alt: AltKoli
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 text-white text-sm font-semibold">
            {alt.harf}
          </span>
          <span className="font-mono text-xs text-slate-500">
            {alt.altArsivNo}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${GIZLILIK_STYLE[alt.gizlilikSeviyesi]}`}
          >
            {GIZLILIK_LABEL[alt.gizlilikSeviyesi]}
          </span>
          {canEdit && (
            <ActionsDropdown onEdit={onEdit} onDelete={onDelete} />
          )}
        </div>
      </div>
      <div>
        <p className="font-medium text-sm text-slate-900">
          {alt.evrakTuru.ad}
        </p>
        <p className="text-xs text-slate-600 mt-0.5">
          {formatYearRange(alt.donemBaslangic, alt.donemSonu)}
          {alt.evrakSayisi !== null && ` • ~${alt.evrakSayisi} adet`}
        </p>
      </div>
      <div className="text-xs text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100">
        <span>Saklama: {alt.saklamaSuresiYil} yıl</span>
        <span className="text-rose-700 font-medium">
          İmha: {formatDate(alt.imhaTarihi)}
        </span>
      </div>
      {alt.hazirlayan && (
        <p className="text-xs text-slate-600">
          Hazırlayan: {alt.hazirlayan}
        </p>
      )}
      {alt.aciklama && (
        <p className="text-xs text-slate-600 italic">{alt.aciklama}</p>
      )}
    </div>
  )
}

function ActionsDropdown({
  onEdit,
  onDelete,
}: {
  onEdit: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="p-1 hover:bg-slate-100 rounded text-slate-500"
        aria-label="İşlemler"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg py-1 z-10 min-w-[120px]">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              onEdit()
              setOpen(false)
            }}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 flex items-center gap-2"
          >
            <Pencil size={14} />
            Düzenle
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              onDelete()
              setOpen(false)
            }}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-rose-50 text-rose-600 flex items-center gap-2"
          >
            <Trash2 size={14} />
            Sil
          </button>
        </div>
      )}
    </div>
  )
}

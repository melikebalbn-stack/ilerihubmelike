'use client'

/**
 * AltKoliRow — Yeni koli formundaki tek bir alt koli satırı.
 *
 * - Sol üst: Harf rozeti (A, B, C...)
 * - Sağ üst: Sil butonu (canRemove false ise disabled)
 * - 2 kolon grid: Evrak Türü, Saklama Yıl, Açıklama, Hazırlayan, Evrak Sayısı,
 *   Gizlilik Seviyesi, Dönem Başlangıç/Sonu (alt koli kendi dönemini taşır)
 *
 * NOT: Plan'da `saklamaSuresiYil` ve `donemBaslangic/donemSonu` alanları
 * AltKoliFormData'da yoktu, ancak backend zorunlu kılıyor. Eklendi.
 * EvrakTuru seçildiğinde `varsayilanSaklamaYili` saklamaSuresiYil'a auto-fill
 * olur (kullanıcı override edebilir).
 */

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import EvrakTuruSelect, {
  type EvrakTuruOption,
} from './evrak-turu-select'

export type Gizlilik = 'KamuyaAcik' | 'SirketIci' | 'Gizli' | 'CokGizli'

type PendingItem = {
  tempId: string
  ad: string
  varsayilanSaklamaYili: number
  yasalDayanak?: string | null
}

export type AltKoliFormData = {
  // Stable id (form içinde silme/sıralamada referans için, backend'e gönderilmez)
  uid: string
  harf: string
  evrakTuru: EvrakTuruOption | null
  donemBaslangic: string
  donemSonu: string
  saklamaSuresiYil: number
  /** Kullanıcı saklama süresini elle değiştirdiyse, evrak türü değişimi
   *  saklamayı override etmesin (varsayılana geri dönmesin). */
  _saklamaManuelOverride: boolean
  aciklama: string
  hazirlayan: string
  evrakSayisi: number | null
  gizlilikSeviyesi: Gizlilik
}

const GIZLILIK_OPTIONS: { value: Gizlilik; label: string }[] = [
  { value: 'KamuyaAcik', label: 'Kamuya Açık' },
  { value: 'SirketIci', label: 'Şirket İçi' },
  { value: 'Gizli', label: 'Gizli' },
  { value: 'CokGizli', label: 'Çok Gizli' },
]

type Props = {
  data: AltKoliFormData
  onChange: (data: AltKoliFormData) => void
  onRemove: () => void
  bolumId: number | null
  canRemove: boolean
  errors?: Partial<Record<keyof AltKoliFormData, string>>
  pendingEvrakTurleri?: PendingItem[]
  onCreateEvrakTuruPending?: (data: {
    ad: string
    varsayilanSaklamaYili: number
    yasalDayanak?: string
  }) => string
  /** Harf badge'ini ve sil butonunu içeren üst başlık. Modal'da gizlemek için false. */
  showHarf?: boolean
}

export default function AltKoliRow({
  data,
  onChange,
  onRemove,
  bolumId,
  canRemove,
  errors,
  pendingEvrakTurleri,
  onCreateEvrakTuruPending,
  showHarf = true,
}: Props) {
  function update<K extends keyof AltKoliFormData>(
    key: K,
    val: AltKoliFormData[K]
  ) {
    onChange({ ...data, [key]: val })
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      {showHarf && (
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-slate-900 text-white text-base font-semibold">
            {data.harf}
          </span>
          <button
            type="button"
            onClick={onRemove}
            disabled={!canRemove}
            aria-label="Alt koliyi sil"
            className="text-slate-400 hover:text-rose-700 disabled:opacity-30 disabled:cursor-not-allowed text-sm px-2"
          >
            ✕ Sil
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-slate-700 block mb-1">
            Evrak Türü <span className="text-rose-600">*</span>
          </label>
          <EvrakTuruSelect
            value={data.evrakTuru}
            onChange={(opt) => {
              // Auto-fill saklama süresi: kullanıcı manuel override yapmadıysa
              onChange({
                ...data,
                evrakTuru: opt,
                saklamaSuresiYil:
                  !data._saklamaManuelOverride && opt
                    ? opt.varsayilanSaklamaYili
                    : data.saklamaSuresiYil,
              })
            }}
            bolumId={bolumId}
            pendingEvrakTurleri={pendingEvrakTurleri}
            onCreatePending={onCreateEvrakTuruPending}
            required
          />
          {errors?.evrakTuru && (
            <p className="text-xs text-rose-700 mt-1">{errors.evrakTuru}</p>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-slate-700 block mb-1">
            Dönem Başlangıç <span className="text-rose-600">*</span>
          </label>
          <input
            type="date"
            value={data.donemBaslangic}
            onChange={(e) => update('donemBaslangic', e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
          />
          {errors?.donemBaslangic && (
            <p className="text-xs text-rose-700 mt-1">{errors.donemBaslangic}</p>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-slate-700 block mb-1">
            Dönem Sonu <span className="text-rose-600">*</span>
          </label>
          <input
            type="date"
            value={data.donemSonu}
            onChange={(e) => update('donemSonu', e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
          />
          {errors?.donemSonu && (
            <p className="text-xs text-rose-700 mt-1">{errors.donemSonu}</p>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-slate-700 block mb-1">
            Saklama Süresi (yıl) <span className="text-rose-600">*</span>
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={data.saklamaSuresiYil}
            onChange={(e) => {
              const v = Number(e.target.value)
              const next = Number.isFinite(v) ? v : 10
              // Kullanıcı manuel olarak değiştirdi: bayrağı set et ki
              // sonraki evrak türü değişikliği bu değeri override etmesin.
              onChange({
                ...data,
                saklamaSuresiYil: next,
                _saklamaManuelOverride: true,
              })
            }}
            className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
          />
          {errors?.saklamaSuresiYil && (
            <p className="text-xs text-rose-700 mt-1">{errors.saklamaSuresiYil}</p>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-slate-700 block mb-1">
            Gizlilik Seviyesi
          </label>
          <Select
            value={data.gizlilikSeviyesi}
            onValueChange={(v) => update('gizlilikSeviyesi', v as Gizlilik)}
          >
            <SelectTrigger className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GIZLILIK_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-700 block mb-1">
            Hazırlayan
          </label>
          <input
            type="text"
            value={data.hazirlayan}
            onChange={(e) => update('hazirlayan', e.target.value)}
            maxLength={150}
            className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-700 block mb-1">
            Evrak Sayısı (yaklaşık)
          </label>
          <input
            type="number"
            min={0}
            value={data.evrakSayisi ?? ''}
            onChange={(e) => {
              const raw = e.target.value
              if (raw === '') update('evrakSayisi', null)
              else {
                const v = Number(raw)
                update('evrakSayisi', Number.isInteger(v) && v >= 0 ? v : null)
              }
            }}
            placeholder="Opsiyonel"
            className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-slate-700 block mb-1">
            Açıklama
          </label>
          <textarea
            value={data.aciklama}
            onChange={(e) => update('aciklama', e.target.value)}
            maxLength={500}
            rows={2}
            className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>
    </div>
  )
}

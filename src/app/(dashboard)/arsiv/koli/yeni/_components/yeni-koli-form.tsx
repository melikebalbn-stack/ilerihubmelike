'use client'

/**
 * YeniKoliForm — Yeni koli oluşturma formu (Client).
 *
 * - Sol: ana koli alanları (bolum, lokasyon, dönem, sorumlu, açıklama)
 * - Sağ: alt koliler dikey listesi (en az 1, en fazla 26)
 * - Submit: client-side validation → POST /api/arsiv/koli → redirect detay
 *
 * NOT: Plan'da AltKoliFormData'da `saklamaSuresiYil` ve dönem alanları yoktu;
 * backend zorunlu kıldığı için eklendi (AltKoliRow'da tek tek alınıyor).
 * EvrakTuru seçilince saklamaSuresiYil auto-fill olur.
 */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import BolumSelect from '../../../_components/bolum-select'
import LokasyonSelect from '../../../_components/lokasyon-select'
import SorumluKullaniciSelect, {
  type SorumluUser,
} from '../../../_components/sorumlu-kullanici-select'
import AltKoliRow, {
  type AltKoliFormData,
  type Gizlilik,
} from '../../../_components/alt-koli-row'

type Bolum = { id: number; ad: string; kod: string; renkHex: string }
type Lokasyon = {
  id: number
  depoNo: string
  rafKodu: string
  siraNo: number
  kapasite: number
  mevcutDoluluk: number
}

type Props = {
  bolumler: Bolum[]
  lokasyonlar: Lokasyon[]
  currentUser: SorumluUser | null
  defaultBolumId: number | null
  canChangeBolum: boolean
}

let uidCounter = 0
function nextUid() {
  uidCounter += 1
  return `alt-${uidCounter}`
}

function harfFor(idx: number): string {
  return String.fromCharCode(65 + idx)
}

function emptyAltKoli(): AltKoliFormData {
  return {
    uid: nextUid(),
    harf: 'A',
    evrakTuru: null,
    donemBaslangic: '',
    donemSonu: '',
    saklamaSuresiYil: 10,
    _saklamaManuelOverride: false,
    aciklama: '',
    hazirlayan: '',
    evrakSayisi: null,
    gizlilikSeviyesi: 'SirketIci' as Gizlilik,
  }
}

type PendingEvrakTuru = {
  tempId: string
  ad: string
  varsayilanSaklamaYili: number
  yasalDayanak?: string | null
}

function generateTempId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `temp-${crypto.randomUUID()}`
  }
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export default function YeniKoliForm({
  bolumler,
  lokasyonlar,
  currentUser,
  defaultBolumId,
  canChangeBolum,
}: Props) {
  const router = useRouter()

  const [bolumId, setBolumId] = useState<number | null>(defaultBolumId)
  const [lokasyonId, setLokasyonId] = useState<number | null>(null)
  const [tarihAraligiBaslangic, setTarihAraligiBaslangic] = useState('')
  const [tarihAraligiSonu, setTarihAraligiSonu] = useState('')
  const [sorumluUser, setSorumluUser] = useState<SorumluUser | null>(currentUser)
  const [aciklama, setAciklama] = useState('')
  const [altKoliler, setAltKoliler] = useState<AltKoliFormData[]>(() => [
    emptyAltKoli(),
  ])
  const [pendingEvrakTurleri, setPendingEvrakTurleri] = useState<
    PendingEvrakTuru[]
  >([])
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [altErrors, setAltErrors] = useState<
    Record<string, Partial<Record<keyof AltKoliFormData, string>>>
  >({})

  const canAddAlt = altKoliler.length < 26

  function handleCreatePending(data: {
    ad: string
    varsayilanSaklamaYili: number
    yasalDayanak?: string
  }): string {
    const tempId = generateTempId()
    setPendingEvrakTurleri((prev) => [
      ...prev,
      {
        tempId,
        ad: data.ad,
        varsayilanSaklamaYili: data.varsayilanSaklamaYili,
        yasalDayanak: data.yasalDayanak ?? null,
      },
    ])
    return tempId
  }

  function recomputeHarf(list: AltKoliFormData[]): AltKoliFormData[] {
    return list.map((a, i) => ({ ...a, harf: harfFor(i) }))
  }

  function handleBolumChange(newId: number) {
    if (newId === bolumId) return
    const hasEvrakTuru = altKoliler.some((a) => a.evrakTuru !== null)
    const hasPending = pendingEvrakTurleri.length > 0
    if (hasEvrakTuru || hasPending) {
      const ok = window.confirm(
        'Bölüm değiştirilirse alt kolilerin evrak türleri ve eklenen yeni türler sıfırlanacak. Devam edilsin mi?'
      )
      if (!ok) return
      setAltKoliler((list) =>
        list.map((a) => ({
          ...a,
          evrakTuru: null,
          // Manuel override kalksın — yeni bolum'da kullanıcı yeniden override etmek isterse yapar
          _saklamaManuelOverride: false,
        }))
      )
      setPendingEvrakTurleri([])
    }
    setBolumId(newId)
  }

  function addAlt() {
    if (!canAddAlt) return
    setAltKoliler((list) => recomputeHarf([...list, emptyAltKoli()]))
  }

  function removeAlt(uid: string) {
    setAltKoliler((list) => {
      if (list.length <= 1) return list
      return recomputeHarf(list.filter((a) => a.uid !== uid))
    })
    setAltErrors((prev) => {
      const next = { ...prev }
      delete next[uid]
      return next
    })
  }

  function updateAlt(uid: string, data: AltKoliFormData) {
    setAltKoliler((list) =>
      list.map((a) => (a.uid === uid ? { ...data, harf: a.harf } : a))
    )
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    const altErrs: Record<
      string,
      Partial<Record<keyof AltKoliFormData, string>>
    > = {}

    if (bolumId === null) errs.bolumId = 'Bölüm zorunlu'
    if (lokasyonId === null) errs.lokasyonId = 'Lokasyon zorunlu'
    if (!tarihAraligiBaslangic) errs.tarihAraligiBaslangic = 'Başlangıç zorunlu'
    if (!tarihAraligiSonu) errs.tarihAraligiSonu = 'Bitiş zorunlu'
    if (
      tarihAraligiBaslangic &&
      tarihAraligiSonu &&
      new Date(tarihAraligiBaslangic) > new Date(tarihAraligiSonu)
    ) {
      errs.tarihAraligiSonu = 'Bitiş başlangıçtan önce olamaz'
    }
    if (!sorumluUser) errs.sorumluUser = 'Sorumlu zorunlu'
    if (aciklama.length > 500) errs.aciklama = 'Maks 500 karakter'

    if (altKoliler.length === 0) errs.altKoliler = 'En az 1 alt koli zorunlu'

    altKoliler.forEach((a) => {
      const e: Partial<Record<keyof AltKoliFormData, string>> = {}
      if (a.evrakTuru === null) e.evrakTuru = 'Evrak türü zorunlu'
      if (!a.donemBaslangic) e.donemBaslangic = 'Başlangıç zorunlu'
      if (!a.donemSonu) e.donemSonu = 'Bitiş zorunlu'
      if (
        a.donemBaslangic &&
        a.donemSonu &&
        new Date(a.donemBaslangic) > new Date(a.donemSonu)
      ) {
        e.donemSonu = 'Bitiş başlangıçtan önce olamaz'
      }
      if (
        a.donemBaslangic &&
        a.donemSonu &&
        tarihAraligiBaslangic &&
        tarihAraligiSonu
      ) {
        if (
          new Date(a.donemBaslangic) < new Date(tarihAraligiBaslangic) ||
          new Date(a.donemSonu) > new Date(tarihAraligiSonu)
        ) {
          e.donemBaslangic = 'Ana koli aralığının dışında'
        }
      }
      if (
        !Number.isInteger(a.saklamaSuresiYil) ||
        a.saklamaSuresiYil < 1 ||
        a.saklamaSuresiYil > 100
      ) {
        e.saklamaSuresiYil = '1-100 arası'
      }
      if (Object.keys(e).length > 0) altErrs[a.uid] = e
    })

    setErrors(errs)
    setAltErrors(altErrs)
    return Object.keys(errs).length === 0 && Object.keys(altErrs).length === 0
  }

  async function handleSubmit() {
    if (!validate()) {
      toast.error('Form hatalı, kontrol edin')
      return
    }

    setSubmitting(true)
    try {
      // Hangi pending'ler gerçekten kullanıldı? Orphan pending'ler payload'a girmez.
      const usedPending = new Set<string>()
      const altKolilerPayload = altKoliler.map((a) => {
        if (!a.evrakTuru) {
          throw new Error('Evrak türü zorunlu')
        }
        const base = {
          donemBaslangic: a.donemBaslangic,
          donemSonu: a.donemSonu,
          saklamaSuresiYil: a.saklamaSuresiYil,
          gizlilikSeviyesi: a.gizlilikSeviyesi,
          aciklama: a.aciklama.trim() === '' ? null : a.aciklama.trim(),
          hazirlayan: a.hazirlayan.trim() === '' ? null : a.hazirlayan.trim(),
          evrakSayisi: a.evrakSayisi,
        }
        if (a.evrakTuru.kind === 'existing') {
          return {
            ...base,
            evrakTuruId: a.evrakTuru.id,
            pendingEvrakTuruTempId: null,
          }
        }
        usedPending.add(a.evrakTuru.tempId)
        return {
          ...base,
          evrakTuruId: null,
          pendingEvrakTuruTempId: a.evrakTuru.tempId,
        }
      })

      const pendingPayload = pendingEvrakTurleri
        .filter((p) => usedPending.has(p.tempId))
        .map((p) => ({
          tempId: p.tempId,
          ad: p.ad,
          varsayilanSaklamaYili: p.varsayilanSaklamaYili,
          yasalDayanak: p.yasalDayanak ?? null,
        }))

      const payload = {
        bolumId: bolumId!,
        lokasyonId: lokasyonId,
        tarihAraligiBaslangic,
        tarihAraligiSonu,
        sorumluKullaniciId: sorumluUser!.id,
        aciklama: aciklama.trim() === '' ? null : aciklama.trim(),
        pendingEvrakTurleri: pendingPayload,
        altKoliler: altKolilerPayload,
      }

      const res = await fetch('/api/arsiv/koli', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || `Hata: ${res.status}`)
        setSubmitting(false)
        return
      }

      const arsivNo = data?.anaKoli?.arsivNo
      const yeniSayisi: number = Array.isArray(data?.yeniEvrakTurleri)
        ? data.yeniEvrakTurleri.length
        : 0
      const successMsg = arsivNo
        ? yeniSayisi > 0
          ? `${arsivNo} oluşturuldu — ${yeniSayisi} yeni evrak türü kalıcı olarak eklendi`
          : `Koli oluşturuldu: ${arsivNo}`
        : 'Koli oluşturuldu'
      toast.success(successMsg)
      if (arsivNo) {
        router.push(`/arsiv/koli/${arsivNo}`)
      } else {
        router.push('/arsiv/koli')
      }
    } catch (e) {
      toast.error(`Bağlantı hatası: ${(e as Error).message}`)
      setSubmitting(false)
    }
  }

  const selectedBolumKilitli = useMemo(
    () => !canChangeBolum,
    [canChangeBolum]
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Sol — Ana Koli */}
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Ana Koli</h2>

        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1">
            Bölüm <span className="text-rose-600">*</span>
          </label>
          <BolumSelect
            value={bolumId}
            onChange={handleBolumChange}
            bolumler={bolumler}
            disabled={selectedBolumKilitli}
            required
          />
          {errors.bolumId && (
            <p className="text-xs text-rose-700 mt-1">{errors.bolumId}</p>
          )}
          {selectedBolumKilitli && (
            <p className="text-xs text-slate-500 mt-1">
              Kendi bölümünüze kilitli (yetki gerekiyor).
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1">
            Lokasyon <span className="text-rose-600">*</span>
          </label>
          <LokasyonSelect
            value={lokasyonId}
            onChange={setLokasyonId}
            lokasyonlar={lokasyonlar}
            required
          />
          {errors.lokasyonId && (
            <p className="text-xs text-rose-700 mt-1">{errors.lokasyonId}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              Dönem Başlangıç <span className="text-rose-600">*</span>
            </label>
            <input
              type="date"
              value={tarihAraligiBaslangic}
              onChange={(e) => setTarihAraligiBaslangic(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
            />
            {errors.tarihAraligiBaslangic && (
              <p className="text-xs text-rose-700 mt-1">
                {errors.tarihAraligiBaslangic}
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              Dönem Sonu <span className="text-rose-600">*</span>
            </label>
            <input
              type="date"
              value={tarihAraligiSonu}
              onChange={(e) => setTarihAraligiSonu(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
            />
            {errors.tarihAraligiSonu && (
              <p className="text-xs text-rose-700 mt-1">
                {errors.tarihAraligiSonu}
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1">
            Sorumlu Kullanıcı <span className="text-rose-600">*</span>
          </label>
          <SorumluKullaniciSelect
            value={sorumluUser}
            onChange={setSorumluUser}
            required
          />
          {errors.sorumluUser && (
            <p className="text-xs text-rose-700 mt-1">{errors.sorumluUser}</p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1">
            Açıklama
          </label>
          <textarea
            value={aciklama}
            onChange={(e) => setAciklama(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
          />
          <p className="text-xs text-slate-500 mt-1">{aciklama.length}/500</p>
          {errors.aciklama && (
            <p className="text-xs text-rose-700 mt-1">{errors.aciklama}</p>
          )}
        </div>
      </div>

      {/* Sağ — Alt Koliler */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Alt Koliler ({altKoliler.length}/26)
          </h2>
          <button
            type="button"
            onClick={addAlt}
            disabled={!canAddAlt}
            className="rounded-md bg-slate-900 text-white px-3 py-1.5 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
          >
            + Alt Koli Ekle
          </button>
        </div>

        {errors.altKoliler && (
          <p className="text-xs text-rose-700">{errors.altKoliler}</p>
        )}

        <div className="space-y-3">
          {altKoliler.map((alt) => (
            <AltKoliRow
              key={alt.uid}
              data={alt}
              onChange={(d) => updateAlt(alt.uid, d)}
              onRemove={() => removeAlt(alt.uid)}
              bolumId={bolumId}
              canRemove={altKoliler.length > 1}
              errors={altErrors[alt.uid]}
              pendingEvrakTurleri={pendingEvrakTurleri}
              onCreateEvrakTuruPending={handleCreatePending}
            />
          ))}
        </div>
      </div>

      {/* Form footer */}
      <div className="lg:col-span-2 flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
        <Link
          href="/arsiv/koli"
          className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          Vazgeç
        </Link>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded bg-slate-900 text-white px-5 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
        >
          {submitting ? 'Oluşturuluyor...' : 'Oluştur'}
        </button>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Plus, Eye } from 'lucide-react'
import type { BakimYonlendirmeDurumTip } from '@/lib/envanter/bakim-yonlendirme'

// IV / Envanter Faz 2 — 2b-3 · Bakım Yönlendirme (Satın Alma alt sekmesi).
// Fetch yolları /api/envanter/* (sandbox yolu SIZDIRILMAZ).

type BakimYonlendirmeListItem = {
  id: string
  kayitNo: string
  tespitEdenAd: string
  konu: string
  lokasyon: string | null
  aciklama: string | null
  yonlendirilenBirim: string
  durum: BakimYonlendirmeDurumTip
  servisReferansi: string | null
  sonucNotu: string | null
  createdAt: string
  updatedAt: string
}

const BAKIM_DURUM_ETIKET: Record<BakimYonlendirmeDurumTip, string> = {
  TESPIT_EDILDI: 'Tespit Edildi',
  BAKIMA_YONLENDIRILDI: 'Bakıma Yönlendirildi',
  BAKIM_INCELEDI: 'Bakım İnceledi',
  KENDI_COZDU: 'Bakım Çözdü',
  SERVIS_TALEBI_ACILDI: 'Servis Talebi Açıldı',
  TAMAMLANDI: 'Tamamlandı',
  IPTAL: 'İptal',
}

const BAKIM_DURUM_STIL: Record<BakimYonlendirmeDurumTip, string> = {
  TESPIT_EDILDI: 'bg-slate-100 text-slate-600',
  BAKIMA_YONLENDIRILDI: 'bg-amber-50 text-amber-700',
  BAKIM_INCELEDI: 'bg-sky-50 text-sky-700',
  KENDI_COZDU: 'bg-emerald-50 text-emerald-700',
  SERVIS_TALEBI_ACILDI: 'bg-indigo-50 text-indigo-700',
  TAMAMLANDI: 'bg-teal-50 text-teal-700',
  IPTAL: 'bg-slate-100 text-slate-500',
}

// Kapanmış (terminal) kayıtlar tabloda düzenlenemez.
const BAKIM_TERMINAL_DURUMLAR: BakimYonlendirmeDurumTip[] = [
  'KENDI_COZDU',
  'TAMAMLANDI',
  'IPTAL',
]

export function BakimYonlendirmeYonetimi() {
  const [kayitlar, setKayitlar] = useState<BakimYonlendirmeListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [durumFiltre, setDurumFiltre] = useState<BakimYonlendirmeDurumTip | ''>('')

  const [showNewForm, setShowNewForm] = useState(false)
  const [yeniKonu, setYeniKonu] = useState('')
  const [yeniLokasyon, setYeniLokasyon] = useState('')
  const [yeniAciklama, setYeniAciklama] = useState('')
  const [yeniSaving, setYeniSaving] = useState(false)

  const [selectedId, setSelectedId] = useState('')
  const [duzenleDurum, setDuzenleDurum] = useState<BakimYonlendirmeDurumTip>('TESPIT_EDILDI')
  const [duzenleServisRef, setDuzenleServisRef] = useState('')
  const [duzenleSonucNotu, setDuzenleSonucNotu] = useState('')
  const [duzenleSaving, setDuzenleSaving] = useState(false)

  useEffect(() => {
    loadKayitlar(durumFiltre || undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durumFiltre])

  async function loadKayitlar(durum?: BakimYonlendirmeDurumTip) {
    setLoading(true)
    try {
      const url = durum
        ? `/api/envanter/bakim-yonlendirme?durum=${durum}`
        : '/api/envanter/bakim-yonlendirme'
      const res = await fetch(url)
      const json = await res.json()
      if (json.ok) setKayitlar(json.data)
    } finally {
      setLoading(false)
    }
  }

  function handleKayitSec(kayit: BakimYonlendirmeListItem) {
    setSelectedId(kayit.id)
    setDuzenleDurum(kayit.durum)
    setDuzenleServisRef(kayit.servisReferansi ?? '')
    setDuzenleSonucNotu(kayit.sonucNotu ?? '')
    setError('')
    setMessage('')
  }

  async function handleYeniKayit() {
    setError('')
    setMessage('')

    if (!yeniKonu.trim()) {
      setError('Konu zorunludur.')
      return
    }

    setYeniSaving(true)
    try {
      const res = await fetch('/api/envanter/bakim-yonlendirme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          konu: yeniKonu,
          lokasyon: yeniLokasyon || undefined,
          aciklama: yeniAciklama || undefined,
        }),
      })
      const json = await res.json()

      if (json.ok) {
        setMessage(`Kayıt oluşturuldu: ${json.data.kayitNo}`)
        setShowNewForm(false)
        setYeniKonu('')
        setYeniLokasyon('')
        setYeniAciklama('')
        await loadKayitlar(durumFiltre || undefined)
      } else {
        setError(json.message || 'Kayıt oluşturulamadı.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt oluşturulamadı.')
    } finally {
      setYeniSaving(false)
    }
  }

  async function handleGuncelle() {
    if (!selectedId) return
    setError('')
    setMessage('')
    setDuzenleSaving(true)

    try {
      const res = await fetch(`/api/envanter/bakim-yonlendirme/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durum: duzenleDurum,
          servisReferansi: duzenleServisRef || null,
          sonucNotu: duzenleSonucNotu || null,
        }),
      })
      const json = await res.json()

      if (json.ok) {
        setMessage('Kayıt güncellendi.')
        setSelectedId('')
        await loadKayitlar(durumFiltre || undefined)
      } else {
        setError(json.message || 'Güncellenemedi.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Güncellenemedi.')
    } finally {
      setDuzenleSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Bakım Yönlendirme</h2>
            <p className="mt-2 text-sm text-slate-500">
              Tespit edilip bakım birimine yönlendirilen işleri takip et. Bakımın dışarıdan servis /
              satın alma talebi açıp açmadığını buradan izle.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowNewForm((prev) => !prev)}
            className="flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            {showNewForm ? 'Vazgeç' : 'Yeni Kayıt'}
          </button>
        </div>

        {showNewForm && (
          <div className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Konu *</label>
                <input
                  value={yeniKonu}
                  onChange={(e) => setYeniKonu(e.target.value)}
                  placeholder="Örn. 3. kat tavan sızıntısı"
                  className="mt-1 w-full rounded-xl border p-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Lokasyon</label>
                <input
                  value={yeniLokasyon}
                  onChange={(e) => setYeniLokasyon(e.target.value)}
                  placeholder="Örn. A blok ofis / klima"
                  className="mt-1 w-full rounded-xl border p-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Açıklama</label>
              <textarea
                value={yeniAciklama}
                onChange={(e) => setYeniAciklama(e.target.value)}
                className="mt-1 min-h-20 w-full rounded-xl border p-2 text-sm"
              />
            </div>

            <button
              type="button"
              onClick={handleYeniKayit}
              disabled={yeniSaving}
              className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {yeniSaving ? 'Kaydediliyor...' : 'Kaydı Oluştur'}
            </button>
          </div>
        )}

        <div className="mt-4">
          <label className="text-sm font-medium">Durum Filtresi</label>
          <select
            value={durumFiltre}
            onChange={(e) => setDurumFiltre(e.target.value as BakimYonlendirmeDurumTip | '')}
            className="mt-1 w-full max-w-xs rounded-xl border p-2 text-sm"
          >
            <option value="">Tüm durumlar</option>
            {(Object.keys(BAKIM_DURUM_ETIKET) as BakimYonlendirmeDurumTip[]).map((d) => (
              <option key={d} value={d}>
                {BAKIM_DURUM_ETIKET[d]}
              </option>
            ))}
          </select>
        </div>

        {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {message && (
          <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</div>
        )}
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">Yükleniyor...</p>
        ) : kayitlar.length === 0 ? (
          <p className="text-sm text-slate-500">Kayıt bulunamadı.</p>
        ) : (
          <div className="overflow-hidden overflow-x-auto rounded-xl border">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Kayıt No</th>
                  <th className="px-3 py-3">Konu</th>
                  <th className="px-3 py-3">Lokasyon</th>
                  <th className="px-3 py-3">Durum</th>
                  <th className="px-3 py-3">Servis Ref.</th>
                  <th className="px-3 py-3">Tarih</th>
                  <th className="px-3 py-3">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {kayitlar.map((kayit) => {
                  const kapali = BAKIM_TERMINAL_DURUMLAR.includes(kayit.durum)
                  return (
                    <tr key={kayit.id} className={selectedId === kayit.id ? 'bg-slate-50' : ''}>
                      <td className="px-3 py-3 font-medium text-slate-900">{kayit.kayitNo}</td>
                      <td className="px-3 py-3">{kayit.konu}</td>
                      <td className="px-3 py-3">{kayit.lokasyon || '-'}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            BAKIM_DURUM_STIL[kayit.durum] ?? 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {BAKIM_DURUM_ETIKET[kayit.durum] ?? kayit.durum}
                        </span>
                      </td>
                      <td className="px-3 py-3">{kayit.servisReferansi || '-'}</td>
                      <td className="px-3 py-3">
                        {new Date(kayit.createdAt).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => handleKayitSec(kayit)}
                          disabled={kapali}
                          className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {kapali ? 'Kapalı' : 'Güncelle'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedId && (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Durum Güncelle</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Durum</label>
              <select
                value={duzenleDurum}
                onChange={(e) => setDuzenleDurum(e.target.value as BakimYonlendirmeDurumTip)}
                className="mt-1 w-full rounded-xl border p-2 text-sm"
              >
                {(Object.keys(BAKIM_DURUM_ETIKET) as BakimYonlendirmeDurumTip[]).map((d) => (
                  <option key={d} value={d}>
                    {BAKIM_DURUM_ETIKET[d]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Servis / Talep Referansı</label>
              <input
                value={duzenleServisRef}
                onChange={(e) => setDuzenleServisRef(e.target.value)}
                placeholder="Bakımın açtığı servis/talep no"
                className="mt-1 w-full rounded-xl border p-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="text-sm font-medium">Sonuç Notu</label>
            <textarea
              value={duzenleSonucNotu}
              onChange={(e) => setDuzenleSonucNotu(e.target.value)}
              className="mt-1 min-h-20 w-full rounded-xl border p-2 text-sm"
            />
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleGuncelle}
              disabled={duzenleSaving}
              className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {duzenleSaving ? 'Kaydediliyor...' : 'Güncelle'}
            </button>
            <button
              type="button"
              onClick={() => setSelectedId('')}
              className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

// Başvuru Sorgula — Faz 2. PUBLIC sayfa, oturum YOK.
//
// Aday tableti/sekmeyi kapattıktan sonra başvurusuna buradan döner:
//   1. başvuru no + TC  → /api/public/basvuru-sorgula → takip imzası
//   2. imza ile        → /api/public/basvuru-durum   → durum (+ varsa sınav linki)
//
// TABLET EKRANINDAN FARKI — bilinçli: burada YOKLAMA YOK. Tablet ekranı 10 sn'de bir
// yokluyor ve 30 dk sonra duruyor (JobApplicationRenderer); aday oraya dakikalar içinde
// bakıyor. Bu sayfaya ise saatler/günler sonra girilir; sürekli yoklama gereksiz yük ve
// rate-limit baskısı olur. Tek seferlik sorgu + elle "Yenile".
//
// İmza YALNIZ React state'te tutulur — storage'a YAZILMAZ (tablet gerekçesiyle aynı ilke).

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Search } from 'lucide-react'

type Durum = {
  durum: 'BEKLIYOR' | 'SINAV_HAZIR' | 'SINAV_BASLADI' | 'TAMAMLANDI' | 'DUZELTME_BEKLENIYOR'
  sinavAdi?: string
  sinavLink?: string
  duzeltilecekAlanlar?: string[]
}

// Tek hata metni — sunucu da tek metin döndürüyor (hangi alanın yanlış olduğu söylenmez).
const HATA = 'Başvuru doğrulanamadı. Bilgilerinizi kontrol edin.'

export default function BasvuruSorgulaPage() {
  const [applicationNumber, setApplicationNumber] = useState('')
  const [tcKimlikNo, setTcKimlikNo] = useState('')
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  // Doğrulama sonrası: imza + son okunan durum. İmza yalnız burada, storage YOK.
  const [oturum, setOturum] = useState<{ applicationNumber: string; takipImzasi: string } | null>(null)
  const [durum, setDurum] = useState<Durum | null>(null)

  async function durumOku(no: string, imza: string): Promise<boolean> {
    const res = await fetch('/api/public/basvuru-durum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationNumber: no, takipImzasi: imza }),
    })
    if (!res.ok) return false
    setDurum(await res.json())
    return true
  }

  async function sorgula(e: React.FormEvent) {
    e.preventDefault()
    setHata(null)
    setYukleniyor(true)
    try {
      const res = await fetch('/api/public/basvuru-sorgula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationNumber: applicationNumber.trim(), tcKimlikNo: tcKimlikNo.trim() }),
      })
      if (!res.ok) {
        // Sunucu tek metin/tek kod döndürüyor; burada da ayrıştırma YAPILMAZ.
        setHata(HATA)
        return
      }
      const d = await res.json()
      const ok = await durumOku(d.applicationNumber, d.takipImzasi)
      if (!ok) {
        setHata(HATA)
        return
      }
      setOturum({ applicationNumber: d.applicationNumber, takipImzasi: d.takipImzasi })
    } catch {
      setHata('Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.')
    } finally {
      setYukleniyor(false)
    }
  }

  async function yenile() {
    if (!oturum) return
    setYukleniyor(true)
    try {
      await durumOku(oturum.applicationNumber, oturum.takipImzasi)
    } catch {
      /* sessiz — ekrandaki son durum kalır */
    } finally {
      setYukleniyor(false)
    }
  }

  // ── Sonuç ekranı ──────────────────────────────────────────────────────────
  if (oturum && durum) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-md w-full">
          <div className="text-center">
            <p className="text-xs uppercase tracking-wide text-slate-400">Başvuru No</p>
            <p className="text-sm font-semibold text-slate-900 break-all">{oturum.applicationNumber}</p>
          </div>

          <div className="mt-6">
            {durum.durum === 'DUZELTME_BEKLENIYOR' ? (
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-sky-500 mx-auto mb-3" />
                <h1 className="text-xl font-medium text-slate-900">Formunuzda düzeltme bekleniyor</h1>
                <p className="mt-2 text-sm text-slate-500">
                  İnsan Varlıkları ekibi başvurunuzu geri gönderdi.
                  {(durum.duzeltilecekAlanlar?.length ?? 0) > 0
                    ? ' Aşağıdaki alanları kontrol edip formu yeniden gönderin.'
                    : ' Lütfen formu gözden geçirip yeniden gönderin.'}
                </p>
                {(durum.duzeltilecekAlanlar?.length ?? 0) > 0 && (
                  <ul className="mt-4 text-left inline-block">
                    {durum.duzeltilecekAlanlar!.map((a) => (
                      <li key={a} className="flex items-start gap-2 text-sm text-slate-700 py-0.5">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                        {a}
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href="/job-application"
                  className="mt-6 block w-full px-6 py-4 bg-[#1B4F72] text-white rounded-xl font-semibold text-lg text-center hover:bg-[#1B4F72]/90 active:scale-[0.98] transition"
                >
                  Formu Düzenle
                </Link>
                <p className="mt-3 text-xs text-slate-400">
                  Form baştan doldurulur; önceki bilgileriniz saklanmaz.
                </p>
              </div>
            ) : durum.sinavLink ? (
              <div className="text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                <h1 className="text-xl font-medium text-slate-900">Sınavınız Hazır</h1>
                {durum.sinavAdi && (
                  <p className="mt-2 text-sm text-slate-600">
                    Sınav: <strong className="text-slate-900">{durum.sinavAdi}</strong>
                  </p>
                )}
                <a
                  href={durum.sinavLink}
                  className="mt-6 block w-full px-6 py-4 bg-emerald-600 text-white rounded-xl font-semibold text-lg text-center hover:bg-emerald-700 active:scale-[0.98] transition"
                >
                  Sınava Başla
                </a>
              </div>
            ) : durum.durum === 'TAMAMLANDI' ? (
              <div className="text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                <h1 className="text-xl font-medium text-slate-900">Sınavınız tamamlandı</h1>
                <p className="mt-2 text-sm text-slate-500">
                  {durum.sinavAdi ? `${durum.sinavAdi} · ` : ''}
                  İnsan Varlıkları ekibimiz değerlendirme sonrası sizinle iletişime geçecektir.
                </p>
              </div>
            ) : (
              <div className="text-center">
                <Search className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                <h1 className="text-xl font-medium text-slate-900">Başvurunuz inceleniyor</h1>
                <p className="mt-2 text-sm text-slate-500">
                  İnsan Varlıkları ekibimiz değerlendirme sonrası sizinle iletişime geçecektir.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={yenile}
              disabled={yukleniyor}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 border border-slate-300 rounded-xl font-medium text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60 active:scale-[0.98] transition"
            >
              {yukleniyor ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Yenile
            </button>
            <button
              type="button"
              onClick={() => {
                setOturum(null)
                setDurum(null)
                setTcKimlikNo('')
              }}
              className="flex-1 px-5 py-3 border border-slate-300 rounded-xl font-medium text-sm text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition"
            >
              Başka başvuru
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Sorgu formu ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <form
        onSubmit={sorgula}
        className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-md w-full"
      >
        <div className="text-center">
          <Search className="h-10 w-10 text-[#1B4F72] mx-auto mb-3" />
          <h1 className="text-xl font-medium text-slate-900">Başvuru Sorgula</h1>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            Başvuru numaranız ve T.C. kimlik numaranızla başvurunuzun durumunu görebilirsiniz.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="basvuruNo" className="block text-sm font-medium text-slate-700 mb-1">
              Başvuru Numarası
            </label>
            <input
              id="basvuruNo"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={applicationNumber}
              onChange={(e) => setApplicationNumber(e.target.value)}
              placeholder="Başvuru sonrası verilen numara"
              className="w-full px-4 py-3.5 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1B4F72]/30 focus:border-[#1B4F72]"
            />
          </div>

          <div>
            <label htmlFor="tc" className="block text-sm font-medium text-slate-700 mb-1">
              T.C. Kimlik Numarası
            </label>
            <input
              id="tc"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={11}
              autoComplete="off"
              value={tcKimlikNo}
              onChange={(e) => setTcKimlikNo(e.target.value.replace(/\D/g, ''))}
              placeholder="11 haneli"
              className="w-full px-4 py-3.5 text-base tracking-wider border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1B4F72]/30 focus:border-[#1B4F72]"
            />
          </div>
        </div>

        {hata && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{hata}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={yukleniyor || !applicationNumber.trim() || tcKimlikNo.length !== 11}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-[#1B4F72] text-white rounded-xl font-semibold text-lg hover:bg-[#1B4F72]/90 disabled:opacity-50 active:scale-[0.98] transition"
        >
          {yukleniyor && <Loader2 className="h-5 w-5 animate-spin" />}
          Sorgula
        </button>

        <p className="mt-4 text-center text-xs text-slate-400">
          Başvuru numaranızı bilmiyorsanız İnsan Varlıkları ekibi ile görüşün.
        </p>
      </form>
    </div>
  )
}

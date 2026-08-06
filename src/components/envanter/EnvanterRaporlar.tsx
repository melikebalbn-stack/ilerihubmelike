'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import * as XLSX from 'xlsx'

// IV / Envanter Faz 2 — 2b-3 · Raporlar: Sarf Tüketim + Maliyet.
// Fetch yolları /api/envanter/* (sandbox yolu SIZDIRILMAZ). Mevcut KKD Yenileme
// raporu (RaporlarYonetimi) korunur; bu iki rapor onun YANINA eklenir.

type SarfTuketimSatiriTip = {
  urunId: string
  urunKodu: string
  urunAdi: string
  kategori: string
  bolum: string
  alanPersonelAd: string
  toplamMiktar: number
  islemSayisi: number
  sonTarih: string
}
type SarfTuketimSonucTip = {
  satirlar: SarfTuketimSatiriTip[]
  bolumler: string[]
  kategoriler: string[]
  toplamCikis: number
}

type MaliyetSatiriTip = {
  urunId: string
  urunKodu: string
  urunAdi: string
  kategori: string
  varyantAdi: string | null
  paraBirimi: string
  birimMaliyet: number
  cikisAdet: number
  cikisMaliyet: number
  girisAdet: number
  girisMaliyet: number
}
type MaliyetOzetTip = { paraBirimi: string; toplamCikis: number; toplamGiris: number }
type MaliyetRaporuSonucTip = { satirlar: MaliyetSatiriTip[]; ozetler: MaliyetOzetTip[]; kategoriler: string[] }

export function SarfTuketimRaporu() {
  const [veri, setVeri] = useState<SarfTuketimSonucTip | null>(null)
  const [loading, setLoading] = useState(true)
  const [baslangic, setBaslangic] = useState('')
  const [bitis, setBitis] = useState('')
  const [bolumFiltre, setBolumFiltre] = useState('')
  const [kategoriFiltre, setKategoriFiltre] = useState('')

  useEffect(() => {
    loadRapor()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadRapor() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (baslangic) params.set('baslangic', baslangic)
      if (bitis) params.set('bitis', bitis)
      const q = params.toString()
      const res = await fetch(`/api/envanter/sarf-tuketim${q ? '?' + q : ''}`)
      const json = await res.json()
      if (json.ok) setVeri(json.data)
    } finally {
      setLoading(false)
    }
  }

  const satirlar = (veri?.satirlar ?? []).filter((s) => {
    if (bolumFiltre && s.bolum !== bolumFiltre) return false
    if (kategoriFiltre && s.kategori !== kategoriFiltre) return false
    return true
  })

  function fmtTarih(t: string) {
    const [y, m, g] = t.split('-')
    return `${g}.${m}.${y}`
  }

  function handleExcel() {
    const rows = satirlar.map((s) => ({
      'Ürün Kodu': s.urunKodu,
      Ürün: s.urunAdi,
      Kategori: s.kategori,
      Bölüm: s.bolum,
      Personel: s.alanPersonelAd,
      'Toplam Miktar': s.toplamMiktar,
      'İşlem Sayısı': s.islemSayisi,
      'Son Tarih': fmtTarih(s.sonTarih),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sarf Tüketim')
    XLSX.writeFile(wb, `Sarf_Tuketim_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Sarf Tüketim Raporu</h2>
        <p className="mt-2 text-sm text-slate-500">
          Stok çıkışlarının bölüm ve personel bazında dağılımı. Kim, hangi malzemeden ne kadar aldı.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-sm font-medium">Başlangıç</label>
            <input type="date" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} className="mt-1 block rounded-xl border p-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium">Bitiş</label>
            <input type="date" value={bitis} onChange={(e) => setBitis(e.target.value)} className="mt-1 block rounded-xl border p-2 text-sm" />
          </div>
          <button type="button" onClick={loadRapor} className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
            Uygula
          </button>
          <select value={bolumFiltre} onChange={(e) => setBolumFiltre(e.target.value)} className="rounded-xl border p-2 text-sm">
            <option value="">Tüm bölümler</option>
            {(veri?.bolumler ?? []).map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={kategoriFiltre} onChange={(e) => setKategoriFiltre(e.target.value)} className="rounded-xl border p-2 text-sm">
            <option value="">Tüm kategoriler</option>
            {(veri?.kategoriler ?? []).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <button type="button" onClick={handleExcel} disabled={satirlar.length === 0} className="flex items-center gap-2 rounded-xl border border-teal-700 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-60">
            <Download className="h-4 w-4" />
            Excel'e Aktar
          </button>
          <span className="pb-2 text-sm text-slate-500">{loading ? 'Yükleniyor...' : `${satirlar.length} kayıt`}</span>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-2 shadow-sm">
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Yükleniyor...</p>
        ) : satirlar.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Kayıt bulunamadı. Stok çıkışı yapıldıkça burada görünür.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Ürün</th>
                  <th className="px-3 py-3">Kategori</th>
                  <th className="px-3 py-3">Bölüm</th>
                  <th className="px-3 py-3">Personel</th>
                  <th className="px-3 py-3 text-right">Toplam</th>
                  <th className="px-3 py-3 text-right">İşlem</th>
                  <th className="px-3 py-3">Son Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {satirlar.map((s, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5"><span className="font-medium text-slate-700">{s.urunKodu}</span><div className="text-xs text-slate-500">{s.urunAdi}</div></td>
                    <td className="px-3 py-2.5 text-slate-600">{s.kategori}</td>
                    <td className="px-3 py-2.5">{s.bolum}</td>
                    <td className="px-3 py-2.5">{s.alanPersonelAd}</td>
                    <td className="px-3 py-2.5 text-right font-medium">{s.toplamMiktar}</td>
                    <td className="px-3 py-2.5 text-right text-slate-500">{s.islemSayisi}</td>
                    <td className="px-3 py-2.5 text-slate-600">{fmtTarih(s.sonTarih)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export function MaliyetRaporu() {
  const [veri, setVeri] = useState<MaliyetRaporuSonucTip | null>(null)
  const [loading, setLoading] = useState(true)
  const [baslangic, setBaslangic] = useState('')
  const [bitis, setBitis] = useState('')
  const [kategoriFiltre, setKategoriFiltre] = useState('')

  useEffect(() => {
    loadRapor()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadRapor() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (baslangic) params.set('baslangic', baslangic)
      if (bitis) params.set('bitis', bitis)
      const q = params.toString()
      const res = await fetch(`/api/envanter/maliyet-raporu${q ? '?' + q : ''}`)
      const json = await res.json()
      if (json.ok) setVeri(json.data)
    } finally {
      setLoading(false)
    }
  }

  const satirlar = (veri?.satirlar ?? []).filter((s) => !kategoriFiltre || s.kategori === kategoriFiltre)
  const fmt = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  function handleExcel() {
    const rows = satirlar.map((s) => ({
      'Ürün Kodu': s.urunKodu,
      Ürün: s.urunAdi,
      Kategori: s.kategori,
      Varyant: s.varyantAdi || 'Ana Ürün',
      'Birim Maliyet': s.birimMaliyet,
      'Para Birimi': s.paraBirimi,
      'Çıkış Adet': s.cikisAdet,
      'Çıkış Maliyet': s.cikisMaliyet,
      'Giriş Adet': s.girisAdet,
      'Giriş Maliyet': s.girisMaliyet,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Maliyet')
    XLSX.writeFile(wb, `Maliyet_Raporu_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Maliyet Raporu</h2>
        <p className="mt-2 text-sm text-slate-500">
          Tüketim (çıkış) ve satın alma (giriş) maliyetleri. Para birimine göre gruplanır, kur çevrimi yapılmaz.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-sm font-medium">Başlangıç</label>
            <input type="date" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} className="mt-1 block rounded-xl border p-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium">Bitiş</label>
            <input type="date" value={bitis} onChange={(e) => setBitis(e.target.value)} className="mt-1 block rounded-xl border p-2 text-sm" />
          </div>
          <button type="button" onClick={loadRapor} className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">Uygula</button>
          <select value={kategoriFiltre} onChange={(e) => setKategoriFiltre(e.target.value)} className="rounded-xl border p-2 text-sm">
            <option value="">Tüm kategoriler</option>
            {(veri?.kategoriler ?? []).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <button type="button" onClick={handleExcel} disabled={satirlar.length === 0} className="flex items-center gap-2 rounded-xl border border-teal-700 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-60">
            <Download className="h-4 w-4" /> Excel'e Aktar
          </button>
          <span className="pb-2 text-sm text-slate-500">{loading ? 'Yükleniyor...' : `${satirlar.length} kayıt`}</span>
        </div>

        {(veri?.ozetler ?? []).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            {veri!.ozetler.map((o) => (
              <div key={o.paraBirimi} className="rounded-xl border bg-slate-50 px-4 py-3 text-sm">
                <div className="font-semibold text-slate-900">{o.paraBirimi}</div>
                <div className="text-slate-600">Tüketim: <span className="font-medium text-rose-700">{fmt(o.toplamCikis)}</span></div>
                <div className="text-slate-600">Satın Alma: <span className="font-medium text-emerald-700">{fmt(o.toplamGiris)}</span></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-white p-2 shadow-sm">
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Yükleniyor...</p>
        ) : satirlar.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Kayıt bulunamadı. Maliyet girilmiş ürünlerde giriş/çıkış oldukça burada görünür.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Ürün</th>
                  <th className="px-3 py-3">Varyant</th>
                  <th className="px-3 py-3 text-right">Birim</th>
                  <th className="px-3 py-3">PB</th>
                  <th className="px-3 py-3 text-right">Çıkış Adet</th>
                  <th className="px-3 py-3 text-right">Çıkış Maliyet</th>
                  <th className="px-3 py-3 text-right">Giriş Adet</th>
                  <th className="px-3 py-3 text-right">Giriş Maliyet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {satirlar.map((s, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5"><span className="font-medium text-slate-700">{s.urunKodu}</span><div className="text-xs text-slate-500">{s.urunAdi}</div></td>
                    <td className="px-3 py-2.5">{s.varyantAdi || 'Ana Ürün'}</td>
                    <td className="px-3 py-2.5 text-right">{fmt(s.birimMaliyet)}</td>
                    <td className="px-3 py-2.5">{s.paraBirimi}</td>
                    <td className="px-3 py-2.5 text-right">{s.cikisAdet}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-rose-700">{fmt(s.cikisMaliyet)}</td>
                    <td className="px-3 py-2.5 text-right">{s.girisAdet}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-emerald-700">{fmt(s.girisMaliyet)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

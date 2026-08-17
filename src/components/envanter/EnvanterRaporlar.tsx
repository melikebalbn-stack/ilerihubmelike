'use client'

import { useEffect, useState, Fragment, useMemo } from 'react'
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

type IslemKaydiSatiriTip = {
  id: string
  aktorId: string | null
  aktorAd: string
  islemTipi: string
  hedefTip: string
  hedefId: string | null
  detay: unknown
  createdAt: string
}
type IslemKaydiSonucTip = {
  satirlar: IslemKaydiSatiriTip[]
  islemTipleri: string[]
  hedefTipleri: string[]
  toplamKayit: number
}

function islemTipiEtiket(tip: string) {
  return tip.replace(/_/g, ' ')
}

export function IslemKaydiRaporu() {
  const [baslangic, setBaslangic] = useState('')
  const [bitis, setBitis] = useState('')
  const [islemTipiFiltre, setIslemTipiFiltre] = useState('')
  const [hedefTipFiltre, setHedefTipFiltre] = useState('')
  const [veri, setVeri] = useState<IslemKaydiSonucTip | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (baslangic) params.set('baslangic', baslangic)
    if (bitis) params.set('bitis', bitis)
    if (islemTipiFiltre) params.set('islemTipi', islemTipiFiltre)
    if (hedefTipFiltre) params.set('hedefTip', hedefTipFiltre)
    fetch(`/api/envanter/islem-kaydi?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setVeri(d.data ?? null))
      .finally(() => setLoading(false))
  }, [baslangic, bitis, islemTipiFiltre, hedefTipFiltre])

  const satirlar = veri?.satirlar ?? []

  const handleExcel = () => {
    const rows = satirlar.map((s) => ({
      Tarih: new Date(s.createdAt).toLocaleString('tr-TR'),
      'Aktor': s.aktorAd,
      'Islem Tipi': islemTipiEtiket(s.islemTipi),
      'Hedef Tipi': s.hedefTip,
      'Hedef ID': s.hedefId || '',
      Detay: s.detay ? JSON.stringify(s.detay) : '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Islem Kaydi')
    XLSX.writeFile(wb, `islem_kaydi_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Baslangic</label>
          <input type="date" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Bitis</label>
          <input type="date" value={bitis} onChange={(e) => setBitis(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Islem Tipi</label>
          <select value={islemTipiFiltre} onChange={(e) => setIslemTipiFiltre(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
            <option value="">Tumu</option>
            {(veri?.islemTipleri ?? []).map((t) => (
              <option key={t} value={t}>{islemTipiEtiket(t)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Hedef Tipi</label>
          <select value={hedefTipFiltre} onChange={(e) => setHedefTipFiltre(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
            <option value="">Tumu</option>
            {(veri?.hedefTipleri ?? []).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={handleExcel} disabled={satirlar.length === 0} className="flex items-center gap-2 rounded-xl border border-teal-700 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-60">
          <Download className="h-4 w-4" /> Excel'e Aktar
        </button>
        <span className="pb-2 text-sm text-slate-500">
          {loading ? 'Yukleniyor...' : `${satirlar.length} / ${veri?.toplamKayit ?? 0} kayit`}
        </span>
      </div>
      <div className="rounded-2xl border bg-white p-2 shadow-sm">
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Yukleniyor...</p>
        ) : satirlar.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Kayit bulunamadi.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Tarih</th>
                  <th className="px-3 py-3">Aktor</th>
                  <th className="px-3 py-3">Islem Tipi</th>
                  <th className="px-3 py-3">Hedef Tipi</th>
                  <th className="px-3 py-3">Hedef ID</th>
                  <th className="px-3 py-3">Detay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {satirlar.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 whitespace-nowrap">{new Date(s.createdAt).toLocaleString('tr-TR')}</td>
                    <td className="px-3 py-2.5">{s.aktorAd}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{islemTipiEtiket(s.islemTipi)}</span>
                    </td>
                    <td className="px-3 py-2.5">{s.hedefTip}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{s.hedefId || '-'}</td>
                    <td className="px-3 py-2.5 max-w-xs truncate" title={s.detay ? JSON.stringify(s.detay) : ''}>
                      {s.detay ? JSON.stringify(s.detay) : '-'}
                    </td>
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

type PersonelRaporuDetaySatiriTip = {
  urunKodu: string
  urunAdi: string
  kategori: string
  miktar: number
  islemSayisi: number
  sonTarih: string
}
type PersonelRaporuSatiriTip = {
  personelId: string | null
  personelAd: string
  bolum: string
  toplamMiktar: number
  islemSayisi: number
  urunSayisi: number
  sonTarih: string
  detaylar: PersonelRaporuDetaySatiriTip[]
}
type PersonelRaporuSonucTip = { satirlar: PersonelRaporuSatiriTip[]; bolumler: string[]; toplamCikis: number }
type ZimmetKaydiTip = {
  id: string
  miktar: number
  teslimTarihi: string
  iadeTarihi: string | null
  durum: 'AKTIF' | 'IADE_EDILDI' | 'IPTAL'
  aciklama: string | null
  urun: { kod: string; ad: string; olcuBirimi: string }
  stok: { depo: string | null; raf: string | null; varyant: { varyantAdi: string } | null }
}
export function PersonelRaporu() {
  const [veri, setVeri] = useState<PersonelRaporuSonucTip | null>(null)
  const [loading, setLoading] = useState(true)
  const [baslangic, setBaslangic] = useState('')
  const [bitis, setBitis] = useState('')
  const [bolumFiltre, setBolumFiltre] = useState('')
  const [personelFiltre, setPersonelFiltre] = useState('')
  const [acikSatirlar, setAcikSatirlar] = useState<Set<string>>(new Set())
  const [zimmetler, setZimmetler] = useState<ZimmetKaydiTip[]>([])
  const [zimmetlerLoading, setZimmetlerLoading] = useState(false)
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
      const res = await fetch(`/api/envanter/personel-raporu${q ? '?' + q : ''}`)
      const json = await res.json()
      if (json.ok) setVeri(json.data)
    } finally {
      setLoading(false)
    }
  }
  const personelSecenekleri = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of veri?.satirlar ?? []) {
      map.set(s.personelId || `ad::${s.personelAd}`, s.personelAd)
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'tr'))
  }, [veri])
  const satirlar = (veri?.satirlar ?? []).filter((s) => {
    if (bolumFiltre && s.bolum !== bolumFiltre) return false
    if (personelFiltre && (s.personelId || `ad::${s.personelAd}`) !== personelFiltre) return false
    return true
  })
  useEffect(() => {
    if (personelFiltre) {
      setAcikSatirlar((prev) => {
        const yeni = new Set(prev)
        yeni.add(personelFiltre)
        return yeni
      })
    }
  }, [personelFiltre])
  useEffect(() => {
    if (personelFiltre && !personelFiltre.startsWith('ad::')) {
      setZimmetlerLoading(true)
      fetch(`/api/envanter/zimmet?personnelId=${encodeURIComponent(personelFiltre)}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.ok) setZimmetler(json.data)
          else setZimmetler([])
        })
        .catch(() => setZimmetler([]))
        .finally(() => setZimmetlerLoading(false))
    } else {
      setZimmetler([])
    }
  }, [personelFiltre])
  function fmtTarih(t: string) {
    const [y, m, g] = t.split('-')
    return `${g}.${m}.${y}`
  }
  function fmtTarihSaat(t: string) {
    return new Date(t).toLocaleDateString('tr-TR')
  }
  function toggleSatir(key: string) {
    setAcikSatirlar((prev) => {
      const yeni = new Set(prev)
      if (yeni.has(key)) yeni.delete(key)
      else yeni.add(key)
      return yeni
    })
  }
  function handleExcel() {
    const rows = satirlar.map((s) => ({
      Personel: s.personelAd,
      Bölüm: s.bolum,
      'Toplam Miktar': s.toplamMiktar,
      'İşlem Sayısı': s.islemSayisi,
      'Farklı Ürün Sayısı': s.urunSayisi,
      'Son Tarih': fmtTarih(s.sonTarih),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Personel Raporu')
    XLSX.writeFile(wb, `Personel_Raporu_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }
  function handleZimmetExcel(personelAd: string) {
    const rows = zimmetler.map((z) => ({
      Ürün: `${z.urun.kod} ${z.urun.ad}`,
      Varyant: z.stok.varyant?.varyantAdi || '-',
      Miktar: z.miktar,
      Durum: z.durum,
      'Teslim Tarihi': fmtTarihSaat(z.teslimTarihi),
      'İade Tarihi': z.iadeTarihi ? fmtTarihSaat(z.iadeTarihi) : '-',
      Açıklama: z.aciklama || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Zimmetler')
    XLSX.writeFile(wb, `${personelAd.replace(/\s+/g, '_')}_Zimmetler_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }
  const secilenPersonelAdi = personelSecenekleri.find(([k]) => k === personelFiltre)?.[1] || 'personel'
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Personel Raporu</h2>
        <p className="mt-2 text-sm text-slate-500">
          Bir personeli seçerek ona zimmetli KKD/ürünleri (durumuyla birlikte) ve stok çıkışı dökümünü tek ekranda görebilir, Excel'e aktarabilirsin. İşten ayrılış kontrolü için uygundur.
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
          <select value={personelFiltre} onChange={(e) => setPersonelFiltre(e.target.value)} className="rounded-xl border p-2 text-sm">
            <option value="">Tüm personel</option>
            {personelSecenekleri.map(([key, ad]) => <option key={key} value={key}>{ad}</option>)}
          </select>
          <button type="button" onClick={handleExcel} disabled={satirlar.length === 0} className="flex items-center gap-2 rounded-xl border border-teal-700 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-60">
            <Download className="h-4 w-4" />
            Excel'e Aktar
          </button>
          <span className="pb-2 text-sm text-slate-500">{loading ? 'Yükleniyor...' : `${satirlar.length} kayıt`}</span>
        </div>
      </div>
      {personelFiltre && !personelFiltre.startsWith('ad::') && (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Zimmetler</h3>
            <button
              type="button"
              onClick={() => handleZimmetExcel(secilenPersonelAdi)}
              disabled={zimmetler.length === 0}
              className="flex items-center gap-2 rounded-xl border border-teal-700 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Zimmetleri Excel'e Aktar
            </button>
          </div>
          {zimmetlerLoading ? (
            <p className="mt-3 text-sm text-slate-500">Yükleniyor...</p>
          ) : zimmetler.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Bu personele ait zimmet kaydı yok.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Ürün</th>
                    <th className="px-3 py-2">Varyant</th>
                    <th className="px-3 py-2 text-right">Miktar</th>
                    <th className="px-3 py-2">Durum</th>
                    <th className="px-3 py-2">Teslim Tarihi</th>
                    <th className="px-3 py-2">İade Tarihi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {zimmetler.map((z) => (
                    <tr key={z.id}>
                      <td className="px-3 py-2">
                        <span className="font-medium">{z.urun.kod}</span> <span className="text-slate-500">{z.urun.ad}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{z.stok.varyant?.varyantAdi || '-'}</td>
                      <td className="px-3 py-2 text-right">{z.miktar}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            z.durum === 'AKTIF'
                              ? 'bg-amber-100 text-amber-700'
                              : z.durum === 'IADE_EDILDI'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {z.durum === 'AKTIF' ? 'Üzerinde (İade Edilmedi)' : z.durum === 'IADE_EDILDI' ? 'İade Edildi' : 'İptal'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{fmtTarihSaat(z.teslimTarihi)}</td>
                      <td className="px-3 py-2 text-slate-600">{z.iadeTarihi ? fmtTarihSaat(z.iadeTarihi) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      <div className="rounded-2xl border bg-white p-2 shadow-sm">
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Yükleniyor...</p>
        ) : satirlar.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Kayıt bulunamadı. Personel bazlı stok çıkışı yapıldıkça burada görünür.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3"></th>
                  <th className="px-3 py-3">Personel</th>
                  <th className="px-3 py-3">Bölüm</th>
                  <th className="px-3 py-3 text-right">Toplam Miktar</th>
                  <th className="px-3 py-3 text-right">İşlem</th>
                  <th className="px-3 py-3 text-right">Ürün Çeşidi</th>
                  <th className="px-3 py-3">Son Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {satirlar.map((s, i) => {
                  const key = s.personelId || `${s.personelAd}::${i}`
                  const acik = acikSatirlar.has(key)
                  return (
                    <Fragment key={key}>
                      <tr className="cursor-pointer hover:bg-slate-50" onClick={() => toggleSatir(key)}>
                        <td className="px-3 py-2.5 text-slate-400">{acik ? '▾' : '▸'}</td>
                        <td className="px-3 py-2.5 font-medium text-slate-700">{s.personelAd}</td>
                        <td className="px-3 py-2.5 text-slate-600">{s.bolum}</td>
                        <td className="px-3 py-2.5 text-right font-medium">{s.toplamMiktar}</td>
                        <td className="px-3 py-2.5 text-right text-slate-500">{s.islemSayisi}</td>
                        <td className="px-3 py-2.5 text-right text-slate-500">{s.urunSayisi}</td>
                        <td className="px-3 py-2.5 text-slate-600">{fmtTarih(s.sonTarih)}</td>
                      </tr>
                      {acik && (
                        <tr>
                          <td colSpan={7} className="bg-slate-50 px-3 py-2">
                            <table className="w-full text-xs">
                              <thead className="text-left text-xs font-semibold uppercase text-slate-400">
                                <tr>
                                  <th className="px-2 py-1">Ürün</th>
                                  <th className="px-2 py-1">Kategori</th>
                                  <th className="px-2 py-1 text-right">Miktar</th>
                                  <th className="px-2 py-1 text-right">İşlem</th>
                                  <th className="px-2 py-1">Son Tarih</th>
                                </tr>
                              </thead>
                              <tbody>
                                {s.detaylar.map((d, j) => (
                                  <tr key={j}>
                                    <td className="px-2 py-1"><span className="font-medium">{d.urunKodu}</span> <span className="text-slate-500">{d.urunAdi}</span></td>
                                    <td className="px-2 py-1 text-slate-500">{d.kategori}</td>
                                    <td className="px-2 py-1 text-right">{d.miktar}</td>
                                    <td className="px-2 py-1 text-right text-slate-500">{d.islemSayisi}</td>
                                    <td className="px-2 py-1 text-slate-500">{fmtTarih(d.sonTarih)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
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

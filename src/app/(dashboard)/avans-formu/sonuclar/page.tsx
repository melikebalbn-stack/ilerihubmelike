'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Users, Building2, Download, Search, Clock, Lock, LockOpen } from 'lucide-react'

type Satir = {
  avansTalebiId: string
  sorumluAdSoyad: string
  bolum: string
  donemYil: number
  donemAy: number
  calisanId: string
  calisanAdSoyad: string
  calisanSicilNo: string | null
  calisanYakaRengi: 'MAVI' | 'BEYAZ' | null
  avansIstiyorMu: boolean
  gonderimTarihi: string
  vekaletenMi: boolean
  kendiFormuMu: boolean
  geriCekildiMi: boolean
}

type AramaSonucu = { id: string; adSoyad: string; bolum: string | null; sicilNo: string | null }

type DonemDurumu = {
  yil: number
  ay: number
  manuelDurum: 'ACIK' | 'KAPALI' | null
  otomatikDurum: 'ACIK' | 'KILITLI'
  donemAcik: boolean
}

const AYLAR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
]

function baslar(adSoyad: string) {
  return adSoyad
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

export default function AvansSonuclarPage() {
  const [satirlar, setSatirlar] = useState<Satir[]>([])
  const [loading, setLoading] = useState(true)
  const [hataMesaji, setHataMesaji] = useState<string | null>(null)
  const [sonGuncelleme, setSonGuncelleme] = useState<Date | null>(null)

  const [arama, setArama] = useState('')
  const [aramaSonuclari, setAramaSonuclari] = useState<AramaSonucu[]>([])
  const [ekleniyor, setEkleniyor] = useState(false)

  const [donemYilFiltre, setDonemYilFiltre] = useState<string>('tumu')
  const [donemAyFiltre, setDonemAyFiltre] = useState<string>('tumu')
  const [bolumFiltre, setBolumFiltre] = useState<string>('tumu')
  const [kisiFiltre, setKisiFiltre] = useState('')
  const [kisiFiltreOdakta, setKisiFiltreOdakta] = useState(false)
  const [siralama, setSiralama] = useState<'ad' | 'tarih' | 'bolum'>('bolum')

  const [donemDurumu, setDonemDurumu] = useState<DonemDurumu | null>(null)
  const [donemIslemYapiliyor, setDonemIslemYapiliyor] = useState(false)

  // Filtre "tümü" ise cari ay/yıl varsayılan alınır — dönem kapatma
  // butonu/rozeti hep TEK bir somut döneme bakar.
  function hedefDonem(): { yil: number; ay: number } {
    if (donemYilFiltre !== 'tumu' && donemAyFiltre !== 'tumu') {
      return { yil: Number(donemYilFiltre), ay: Number(donemAyFiltre) }
    }
    const now = new Date()
    return { yil: now.getFullYear(), ay: now.getMonth() + 1 }
  }

  function donemDurumuYukle() {
    const { yil, ay } = hedefDonem()
    fetch(`/api/avans-formu/donem-kapat?yil=${yil}&ay=${ay}`)
      .then(async (res) => {
        if (!res.ok) return null
        return (await res.json()) as DonemDurumu
      })
      .then((json) => setDonemDurumu(json))
      .catch(() => setDonemDurumu(null))
  }

  function veriYukle() {
    setLoading(true)
    const params = new URLSearchParams()
    if (donemYilFiltre !== 'tumu') params.set('donemYil', donemYilFiltre)
    if (donemAyFiltre !== 'tumu') params.set('donemAy', donemAyFiltre)
    const qs = params.toString()
    fetch(`/api/avans-formu/sonuclar${qs ? `?${qs}` : ''}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.error ?? 'Liste alınamadı')
        }
        return res.json()
      })
      .then((json: { satirlar?: Satir[] }) => {
        setSatirlar(json.satirlar ?? [])
        setSonGuncelleme(new Date())
      })
      .catch((err) => setHataMesaji(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    veriYukle()
    donemDurumuYukle()
  }, [donemYilFiltre, donemAyFiltre])

  async function handleDonemKapat() {
    const { yil, ay } = hedefDonem()
    const onay = window.confirm(
      `${AYLAR[ay - 1]} ${yil} dönemini kapatmak istediğinize emin misiniz? Kapalı dönemde yeni talep girilemez, geri çekilemez.`
    )
    if (!onay) return
    setDonemIslemYapiliyor(true)
    try {
      const res = await fetch('/api/avans-formu/donem-kapat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yil, ay }),
      })
      const sonucBody = await res.json().catch(() => null)
      if (!res.ok) throw new Error(sonucBody?.error ?? 'Dönem kapatılamadı')
      toast.success(`${AYLAR[ay - 1]} ${yil} dönemi kapatıldı`)
      donemDurumuYukle()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Dönem kapatılamadı')
    } finally {
      setDonemIslemYapiliyor(false)
    }
  }

  async function handleDonemAc() {
    const { yil, ay } = hedefDonem()
    const onay = window.confirm(`${AYLAR[ay - 1]} ${yil} dönemini açmak istediğinize emin misiniz?`)
    if (!onay) return
    setDonemIslemYapiliyor(true)
    try {
      const res = await fetch('/api/avans-formu/donem-kapat', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yil, ay }),
      })
      const sonucBody = await res.json().catch(() => null)
      if (!res.ok) throw new Error(sonucBody?.error ?? 'Dönem açılamadı')
      toast.success(`${AYLAR[ay - 1]} ${yil} dönemi açıldı`)
      donemDurumuYukle()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Dönem açılamadı')
    } finally {
      setDonemIslemYapiliyor(false)
    }
  }

  useEffect(() => {
    if (arama.trim().length < 2) {
      setAramaSonuclari([])
      return
    }
    const zamanlayici = setTimeout(() => {
      fetch(`/api/avans-formu/sonuclar/personel-ara?q=${encodeURIComponent(arama)}`)
        .then(async (res) => {
          if (!res.ok) return []
          const json = (await res.json()) as { sonuclar?: AramaSonucu[] }
          return json.sonuclar ?? []
        })
        .then((sonuclar) => setAramaSonuclari(sonuclar))
        .catch(() => setAramaSonuclari([]))
    }, 300)
    return () => clearTimeout(zamanlayici)
  }, [arama])

  async function kisiEkle(personelId: string, force = false) {
    setEkleniyor(true)
    try {
      const res = await fetch('/api/avans-formu/sonuclar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personelId, force }),
      })
      const sonucBody = await res.json().catch(() => null)

      if (res.status === 409 && sonucBody?.warning) {
        const onay = window.confirm(sonucBody.message)
        if (onay) {
          await kisiEkle(personelId, true)
        }
        return
      }

      if (!res.ok) throw new Error(sonucBody?.error ?? 'Ekleme başarısız')
      toast.success('Kişi listeye eklendi')
      setArama('')
      setAramaSonuclari([])
      veriYukle()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ekleme başarısız')
    } finally {
      setEkleniyor(false)
    }
  }

  async function satirSil(avansTalebiId: string, calisanId: string, adSoyad: string) {
    const onay = window.confirm(
      `${adSoyad} için avans talebini listeden kaldırmak istediğinize emin misiniz?`
    )
    if (!onay) return
    try {
      const res = await fetch('/api/avans-formu/sonuclar', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avansTalebiId, calisanId }),
      })
      if (!res.ok) throw new Error('Silme başarısız')
      toast.success('Kayıt kaldırıldı')
      veriYukle()
    } catch {
      toast.error('Silme başarısız')
    }
  }

  const mevcutBolumler = useMemo(
    () => Array.from(new Set(satirlar.map((s) => s.bolum))).sort(),
    [satirlar]
  )

  const kisiFiltreOnerileri = useMemo(() => {
    if (!kisiFiltre.trim()) return []
    const aranan = kisiFiltre.trim().toLocaleLowerCase('tr-TR')
    const isimler = Array.from(new Set(satirlar.map((s) => s.calisanAdSoyad)))
    return isimler
      .filter((ad) => ad.toLocaleLowerCase('tr-TR').split(' ')[0].startsWith(aranan))
      .slice(0, 8)
  }, [satirlar, kisiFiltre])

  const filtreliVarMi =
    donemYilFiltre !== 'tumu' ||
    donemAyFiltre !== 'tumu' ||
    bolumFiltre !== 'tumu' ||
    kisiFiltre.trim().length > 0

  const filtrelenmisSatirlar = useMemo(() => {
    const sonuc = satirlar.filter((s) => {
      if (bolumFiltre !== 'tumu' && s.bolum !== bolumFiltre) return false
      if (kisiFiltre.trim()) {
        const aranan = kisiFiltre.trim().toLocaleLowerCase('tr-TR')
        const ilkKelime = s.calisanAdSoyad.toLocaleLowerCase('tr-TR').split(' ')[0]
        if (!ilkKelime.startsWith(aranan)) return false
      }
      return true
    })

    const siraliSonuc = [...sonuc]
    if (siralama === 'ad') {
      siraliSonuc.sort((a, b) => a.calisanAdSoyad.localeCompare(b.calisanAdSoyad, 'tr-TR'))
    } else if (siralama === 'tarih') {
      siraliSonuc.sort(
        (a, b) => new Date(b.gonderimTarihi).getTime() - new Date(a.gonderimTarihi).getTime()
      )
    } else {
      siraliSonuc.sort((a, b) => a.bolum.localeCompare(b.bolum, 'tr-TR'))
    }
    return siraliSonuc
  }, [satirlar, bolumFiltre, kisiFiltre, siralama])

  const gruplar = useMemo(() => {
    if (siralama !== 'bolum') return null
    const map = new Map<string, Satir[]>()
    for (const s of filtrelenmisSatirlar) {
      if (!map.has(s.bolum)) map.set(s.bolum, [])
      map.get(s.bolum)!.push(s)
    }
    return Array.from(map.entries())
  }, [filtrelenmisSatirlar, siralama])

  function excelAktar() {
    const basliklar = ['Dönem', 'Bölüm', 'Talep Eden', 'Personel', 'Gönderim Tarihi', 'Durum']
    const satirMetinleri = filtrelenmisSatirlar.map((s) =>
      [
        `${s.donemAy}/${s.donemYil}`,
        s.bolum,
        s.sorumluAdSoyad === 'IK_MANUEL' ? 'İK tarafından eklendi' : s.sorumluAdSoyad,
        s.calisanAdSoyad,
        new Date(s.gonderimTarihi).toLocaleDateString('tr-TR'),
        s.geriCekildiMi ? 'Geri Çekildi' : '',
      ]
        .map((deger) => `"${String(deger).replace(/"/g, '""')}"`)
        .join(';')
    )
    const csv = ['﻿' + basliklar.join(';'), ...satirMetinleri].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `avans-talepleri-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function satirRender(s: Satir, i: number) {
    return (
      <TableRow key={`${s.avansTalebiId}-${i}`}>
        <TableCell className="text-slate-500">{s.calisanSicilNo ?? '—'}</TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
              style={{ backgroundColor: '#1B4F72' }}
            >
              {baslar(s.calisanAdSoyad)}
            </div>
            <span className="font-medium text-slate-900">{s.calisanAdSoyad}</span>
          </div>
        </TableCell>
        <TableCell className="text-slate-600">{s.bolum}</TableCell>
        <TableCell>
          {s.sorumluAdSoyad === 'IK_MANUEL' ? (
            <Badge variant="outline" className="text-xs">
              İK tarafından eklendi
            </Badge>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-slate-600">{s.sorumluAdSoyad}</span>
              {s.vekaletenMi && (
                <Badge variant="outline" className="text-xs">
                  Vekaleten girildi
                </Badge>
              )}
              {s.geriCekildiMi && (
                <Badge variant="outline" className="text-xs">
                  Geri Çekildi
                </Badge>
              )}
            </div>
          )}
        </TableCell>
        <TableCell className="text-slate-600">
          {s.donemAy}/{s.donemYil}
        </TableCell>
        <TableCell className="text-slate-500">
          {new Date(s.gonderimTarihi).toLocaleDateString('tr-TR')}
        </TableCell>
        <TableCell className="text-right">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => satirSil(s.avansTalebiId, s.calisanId, s.calisanAdSoyad)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            Kaldır
          </Button>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 pt-8 pb-24 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ backgroundColor: '#1B4F72' }}
            >
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Avans Talepleri</h1>
              <p className="text-sm text-slate-500">Avans isteyen personel listesi</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={excelAktar}
            disabled={filtrelenmisSatirlar.length === 0}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Excel&apos;e Aktar
          </Button>
        </div>

        {donemDurumu && (
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center gap-2">
              {donemDurumu.donemAcik ? (
                <LockOpen className="h-4 w-4 text-emerald-600" />
              ) : (
                <Lock className="h-4 w-4 text-rose-600" />
              )}
              <span className="text-sm text-slate-700">
                {AYLAR[donemDurumu.ay - 1]} {donemDurumu.yil} —{' '}
                <span className={donemDurumu.donemAcik ? 'text-emerald-700 font-medium' : 'text-rose-700 font-medium'}>
                  Dönem: {donemDurumu.donemAcik ? 'Açık' : 'Kapalı'}
                </span>
              </span>
              {donemDurumu.manuelDurum === null && (
                <span className="text-xs text-slate-400">
                  (otomatik {donemDurumu.otomatikDurum === 'ACIK' ? 'açık' : 'kilitli'})
                </span>
              )}
              {donemDurumu.manuelDurum !== null && (
                <span className="text-xs text-slate-400">(İK elle {donemDurumu.manuelDurum === 'ACIK' ? 'açtı' : 'kapattı'})</span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={donemIslemYapiliyor}
              onClick={donemDurumu.donemAcik ? handleDonemKapat : handleDonemAc}
              className={
                donemDurumu.donemAcik
                  ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-50'
                  : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
              }
            >
              {donemIslemYapiliyor
                ? 'İşleniyor…'
                : donemDurumu.donemAcik
                  ? 'Dönemi Kapat'
                  : 'Dönemi Aç'}
            </Button>
          </div>
        )}

        {!loading && !hataMesaji && (
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-slate-200 shadow-none">
              <CardContent className="py-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                  <Users className="h-4 w-4 text-[#1B4F72]" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Avans İsteyen</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {filtrelenmisSatirlar.length}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-none">
              <CardContent className="py-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                  <Building2 className="h-4 w-4 text-[#1B4F72]" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Bölüm Sayısı</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {new Set(filtrelenmisSatirlar.map((s) => s.bolum)).size}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="border-slate-200 shadow-none bg-slate-50/60">
          <CardContent className="py-4 space-y-2.5">
            <p className="text-sm font-medium text-slate-700">Listeye kişi ekle</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Sicil No veya Ad Soyad ile ara..."
                value={arama}
                onChange={(e) => setArama(e.target.value)}
                disabled={ekleniyor}
                className="pl-9 bg-white"
              />
            </div>
            {aramaSonuclari.length > 0 && (
              <div className="border border-slate-200 rounded-lg divide-y overflow-hidden bg-white">
                {aramaSonuclari.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => kisiEkle(p.id)}
                    disabled={ekleniyor}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                        style={{ backgroundColor: '#64748b' }}
                      >
                        {baslar(p.adSoyad)}
                      </div>
                      <span className="font-medium text-slate-800">{p.adSoyad}</span>
                    </div>
                    <span className="text-slate-400 text-xs">{p.sicilNo ?? p.bolum ?? '—'}</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-none overflow-hidden">
          <CardContent className="p-0">
            <div className="p-4 border-b border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">Sonuçlar</p>
                {sonGuncelleme && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock className="h-3.5 w-3.5" />
                    Son güncelleme: {sonGuncelleme.toLocaleTimeString('tr-TR')}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <Select value={donemYilFiltre} onValueChange={setDonemYilFiltre}>
                  <SelectTrigger><SelectValue placeholder="Yıl" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tumu">Tüm yıllar</SelectItem>
                    {[2025, 2026, 2027].map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={donemAyFiltre} onValueChange={setDonemAyFiltre}>
                  <SelectTrigger><SelectValue placeholder="Ay" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tumu">Tüm aylar</SelectItem>
                    {AYLAR.map((ad, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{ad}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={bolumFiltre} onValueChange={setBolumFiltre}>
                  <SelectTrigger><SelectValue placeholder="Bölüm" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tumu">Tüm bölümler</SelectItem>
                    {mevcutBolumler.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="relative">
                  <Input
                    placeholder="Kişi adıyla filtrele..."
                    value={kisiFiltre}
                    onChange={(e) => setKisiFiltre(e.target.value)}
                    onFocus={() => setKisiFiltreOdakta(true)}
                    onBlur={() => setTimeout(() => setKisiFiltreOdakta(false), 150)}
                  />
                  {kisiFiltreOdakta && kisiFiltreOnerileri.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full border border-slate-200 rounded-lg bg-white shadow-md divide-y overflow-hidden">
                      {kisiFiltreOnerileri.map((ad) => (
                        <button
                          key={ad}
                          type="button"
                          onClick={() => setKisiFiltre(ad)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                        >
                          {ad}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <Select value={siralama} onValueChange={(v) => setSiralama(v as typeof siralama)}>
                  <SelectTrigger><SelectValue placeholder="Sırala" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bolum">Bölüme göre grupla</SelectItem>
                    <SelectItem value="ad">Ada göre sırala</SelectItem>
                    <SelectItem value="tarih">Tarihe göre sırala</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loading && (
              <div className="p-4 space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-11 w-full rounded-md" />
                ))}
              </div>
            )}
            {!loading && hataMesaji && (
              <p className="text-sm text-red-600 p-4">{hataMesaji}</p>
            )}

            {!loading && !hataMesaji && (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Sicil No</TableHead>
                    <TableHead>İsim</TableHead>
                    <TableHead>Bölüm</TableHead>
                    <TableHead>Talep Eden</TableHead>
                    <TableHead>Dönem</TableHead>
                    <TableHead>Gönderim Tarihi</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrelenmisSatirlar.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        {filtreliVarMi
                          ? 'Seçili filtrelere uygun kayıt yok.'
                          : 'Henüz avans isteyen yok.'}
                      </TableCell>
                    </TableRow>
                  )}
                  {gruplar
                    ? gruplar.map(([bolum, grupSatirlari]) => (
                        <Fragment key={`grup-${bolum}`}>
                          <TableRow className="bg-slate-50/80">
                            <TableCell colSpan={7} className="py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                              {bolum} ({grupSatirlari.length})
                            </TableCell>
                          </TableRow>
                          {grupSatirlari.map((s, i) => satirRender(s, i))}
                        </Fragment>
                      ))
                    : filtrelenmisSatirlar.map((s, i) => satirRender(s, i))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

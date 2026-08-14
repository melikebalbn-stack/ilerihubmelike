'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// ───────── tipler (server alanları olduğu gibi) ─────────
type IfsIsEmri = {
  id: string
  isEmriNo: string
  operasyonNo: number
  operasyon: string
  isMerkezi: string
  stokKodu: string
  stokAdi: string
  teslimTarihi: string
  miktar: number
  kalanMiktar: number
  durum: string // ISLENEBILIR | BEKLIYOR
}
type GecmisSatir = {
  id: string
  ifsOrderNo: string | null
  ifsOperationNo: number | null
  ifsPartNo: string | null
  ifsPartDescription: string | null
  qtyComplete: number
  qtyScrap: number
  uretimAdet: number | null
  hesapKaynagi: string | null
  durum: 'ACIK' | 'KAPALI'
  baslatildiAt: string | null
  bitirildiAt: string | null
  operatorAdSoyad: string | null
  operatorSicilNo: string | null
  tezgahKod: string | null
  tezgahAd: string | null
}
type Cursor = { at: string; id: string } | null

// ───────── yardımcılar (client-owns-styling; server yalnız string) ─────────
function trTarihSaat(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' })
}

function ifsDurumRozet(durum: string) {
  const stil =
    durum === 'ISLENEBILIR'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-amber-50 text-amber-700 border-amber-200'
  return (
    <Badge variant="outline" className={`text-[10px] ${stil}`}>
      {durum}
    </Badge>
  )
}

function isDurumRozet(durum: 'ACIK' | 'KAPALI') {
  const stil = durum === 'ACIK' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'
  return (
    <Badge variant="outline" className={`text-[10px] ${stil}`}>
      {durum === 'ACIK' ? 'Açık' : 'Kapalı'}
    </Badge>
  )
}

export function IsEmirleriClient() {
  return (
    <Tabs defaultValue="acik" className="space-y-4">
      <TabsList>
        <TabsTrigger value="acik">Açık İş Emirleri</TabsTrigger>
        <TabsTrigger value="gecmis">İş Geçmişi</TabsTrigger>
      </TabsList>
      <TabsContent value="acik">
        <AcikSekme />
      </TabsContent>
      <TabsContent value="gecmis">
        <GecmisSekme />
      </TabsContent>
    </Tabs>
  )
}

// ───────── Sekme 1: IFS canlı açık iş emirleri ─────────
function AcikSekme() {
  const [items, setItems] = useState<IfsIsEmri[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)
  const [arama, setArama] = useState('')
  const [durumFiltre, setDurumFiltre] = useState<string>('hepsi')

  const cek = useCallback(async () => {
    setYukleniyor(true)
    try {
      const res = await fetch('/api/ipro/is-emirleri/ifs', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setHata(data?.error ?? 'IFS bağlantısı kurulamadı')
        setItems([])
        return
      }
      setItems(Array.isArray(data.items) ? data.items : [])
      setHata(null)
    } catch {
      setHata('IFS bağlantısı kurulamadı')
      setItems([])
    } finally {
      setYukleniyor(false)
    }
  }, [])

  useEffect(() => {
    void cek()
  }, [cek])

  const durumlar = useMemo(() => [...new Set(items.map((i) => i.durum))].sort(), [items])
  const gosterilen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr-TR')
    return items.filter((i) => {
      if (durumFiltre !== 'hepsi' && i.durum !== durumFiltre) return false
      if (!q) return true
      return `${i.isEmriNo} ${i.stokKodu} ${i.stokAdi} ${i.isMerkezi}`.toLocaleLowerCase('tr-TR').includes(q)
    })
  }, [items, arama, durumFiltre])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input value={arama} onChange={(e) => setArama(e.target.value)} placeholder="İş emri, parça veya WC ara…" className="h-9 w-64 pl-8 text-xs" />
        </div>
        <Select value={durumFiltre} onValueChange={setDurumFiltre}>
          <SelectTrigger className="h-9 w-40 text-xs"><SelectValue placeholder="Durum" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="hepsi">Tüm durumlar</SelectItem>
            {durumlar.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-400">{gosterilen.length} / {items.length}</span>
        <Button variant="ghost" size="icon" className="ml-auto h-9 w-9" onClick={() => void cek()} title="Yenile">
          <RefreshCw className={`h-4 w-4 ${yukleniyor ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {hata ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {hata} — <button className="underline" onClick={() => void cek()}>tekrar deneyin</button>.
        </div>
      ) : yukleniyor && items.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Yükleniyor…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>İş Emri / Op</TableHead>
                <TableHead>Parça</TableHead>
                <TableHead>İş Merkezi</TableHead>
                <TableHead className="text-right">Miktar / Kalan</TableHead>
                <TableHead>Teslim</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gosterilen.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-slate-400">Açık iş emri bulunamadı.</TableCell>
                </TableRow>
              ) : (
                gosterilen.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.isEmriNo} / {i.operasyonNo}</TableCell>
                    <TableCell>
                      <div className="font-medium">{i.stokKodu || '—'}</div>
                      <div className="text-[11px] text-slate-400">{i.stokAdi || '—'}</div>
                    </TableCell>
                    <TableCell>{i.isMerkezi || '—'}</TableCell>
                    <TableCell className="text-right">{i.miktar} / {i.kalanMiktar}</TableCell>
                    <TableCell>{i.teslimTarihi || '—'}</TableCell>
                    <TableCell>{ifsDurumRozet(i.durum)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-[11px] text-slate-400">İş merkezi kodu IFS&apos;ten ham gösterilir (tezgah eşlemesi yok). Aksiyon yoktur — iş başlatma kioskta.</p>
    </div>
  )
}

// ───────── Sekme 2: ILERIHub iş geçmişi (IproProductionLog) ─────────
function GecmisSekme() {
  const [items, setItems] = useState<GecmisSatir[]>([])
  const [cursor, setCursor] = useState<Cursor>(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [dahaYukleniyor, setDahaYukleniyor] = useState(false)
  const [durumFiltre, setDurumFiltre] = useState<string>('hepsi')

  const cek = useCallback(async (temiz: boolean, mevcutCursor: Cursor, durum: string) => {
    const params = new URLSearchParams({ take: '100' })
    if (durum !== 'hepsi') params.set('durum', durum)
    if (!temiz && mevcutCursor) {
      params.set('cursorAt', mevcutCursor.at)
      params.set('cursorId', mevcutCursor.id)
    }
    const res = await fetch(`/api/ipro/is-emirleri/gecmis?${params}`, { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    const yeni: GecmisSatir[] = Array.isArray(data.items) ? data.items : []
    setItems((eski) => (temiz ? yeni : [...eski, ...yeni]))
    setCursor(data.nextCursor ?? null)
  }, [])

  useEffect(() => {
    setYukleniyor(true)
    void cek(true, null, durumFiltre).finally(() => setYukleniyor(false))
  }, [cek, durumFiltre])

  async function dahaFazla() {
    if (!cursor) return
    setDahaYukleniyor(true)
    try {
      await cek(false, cursor, durumFiltre)
    } finally {
      setDahaYukleniyor(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={durumFiltre} onValueChange={setDurumFiltre}>
          <SelectTrigger className="h-9 w-40 text-xs"><SelectValue placeholder="Durum" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="hepsi">Tüm durumlar</SelectItem>
            <SelectItem value="ACIK">Açık</SelectItem>
            <SelectItem value="KAPALI">Kapalı</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-400">{items.length} kayıt</span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-9 w-9"
          onClick={() => {
            setYukleniyor(true)
            void cek(true, null, durumFiltre).finally(() => setYukleniyor(false))
          }}
          title="Yenile"
        >
          <RefreshCw className={`h-4 w-4 ${yukleniyor ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {yukleniyor && items.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">Yükleniyor…</p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border py-10 text-center text-sm text-slate-400">
          Henüz iş kaydı yok. Kiosk kullanıldıkça açılan/kapanan işler burada listelenir.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>İş Emri</TableHead>
                  <TableHead>Parça</TableHead>
                  <TableHead>Operatör</TableHead>
                  <TableHead>Tezgah</TableHead>
                  <TableHead className="text-right">Üretim</TableHead>
                  <TableHead className="text-right">İyi / Hurda</TableHead>
                  <TableHead>Başlangıç</TableHead>
                  <TableHead>Bitiş</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.ifsOrderNo ?? '—'}{r.ifsOperationNo != null ? ` / ${r.ifsOperationNo}` : ''}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.ifsPartNo ?? '—'}</div>
                      <div className="text-[11px] text-slate-400">{r.ifsPartDescription ?? '—'}</div>
                    </TableCell>
                    <TableCell>
                      {r.operatorAdSoyad ?? '—'}
                      {r.operatorSicilNo ? <span className="text-[11px] text-slate-400"> ({r.operatorSicilNo})</span> : null}
                    </TableCell>
                    <TableCell>{r.tezgahKod ?? '—'}{r.tezgahAd ? <span className="text-[11px] text-slate-400"> · {r.tezgahAd}</span> : null}</TableCell>
                    <TableCell className="text-right">
                      {r.uretimAdet != null ? r.uretimAdet : '—'}
                      {r.hesapKaynagi ? <Badge variant="outline" className="ml-1 text-[10px]">{r.hesapKaynagi}</Badge> : null}
                    </TableCell>
                    <TableCell className="text-right">{r.qtyComplete} / {r.qtyScrap}</TableCell>
                    <TableCell>{trTarihSaat(r.baslatildiAt)}</TableCell>
                    <TableCell>{trTarihSaat(r.bitirildiAt)}</TableCell>
                    <TableCell>{isDurumRozet(r.durum)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {cursor ? (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={dahaFazla} disabled={dahaYukleniyor}>
                {dahaYukleniyor ? 'Yükleniyor…' : 'Daha fazla yükle'}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

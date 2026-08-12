'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronsUpDown, Plus, Search, Trash2, UserX, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { iproNormalize } from '@/lib/ipro/metin'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { iproFetch, iproYaz, AktifRozet, ListeAracCubugu, SiralanabilirTablo, type SiralanabilirKolon } from './ortak'

type Tezgah = {
  id: string
  kod: string
  ad: string
  aktif: boolean
  operatorSayisi: number
  masGrupAdi: string | null
}
type Esleme = {
  id: string
  personnelId: string
  adSoyad: string | null
  sicilNo: string | null
  bolum: string | null
  personelAktif: boolean | null
  kaynak: string
  aktif: boolean
}

export function OperatorEslemeleriClient({ canEdit }: { canEdit: boolean }) {
  const [tezgahlar, setTezgahlar] = useState<Tezgah[]>([])
  const [tezgahId, setTezgahId] = useState<string>('')
  const [eslemeler, setEslemeler] = useState<Esleme[]>([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [arama, setArama] = useState('')
  const [silinecek, setSilinecek] = useState<Esleme | null>(null)
  const [ekleAcik, setEkleAcik] = useState(false)
  const [topluAcik, setTopluAcik] = useState(false)
  const [eslemeDurum, setEslemeDurum] = useState<'hepsi' | 'aktif' | 'pasif'>('hepsi')
  const [ayrilmis, setAyrilmis] = useState<'goster' | 'gizle'>('goster')

  useEffect(() => {
    void (async () => {
      const { ok, data } = await iproFetch<{ tezgahlar: Tezgah[] }>('/api/ipro/yonetim/tezgahlar')
      if (ok) setTezgahlar(data.tezgahlar)
    })()
  }, [])

  async function eslemeleriYukle(id: string) {
    if (!id) return
    setYukleniyor(true)
    try {
      const { ok, data } = await iproFetch<{ eslemeler: Esleme[] }>(
        `/api/ipro/yonetim/operator-eslemeleri?tezgahId=${id}`,
      )
      if (ok) setEslemeler(data.eslemeler)
    } finally {
      setYukleniyor(false)
    }
  }

  useEffect(() => {
    if (tezgahId) void eslemeleriYukle(tezgahId)
    else setEslemeler([])
  }, [tezgahId])

  const gosterilen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr')
    return eslemeler.filter((e) => {
      if (eslemeDurum === 'aktif' && !e.aktif) return false
      if (eslemeDurum === 'pasif' && e.aktif) return false
      // personelAktif === null → personel kaydı silinmiş; "ayrılmış" sayılmaz.
      if (ayrilmis === 'gizle' && e.personelAktif === false) return false
      if (!q) return true
      return (
        (e.adSoyad ?? '').toLocaleLowerCase('tr').includes(q) ||
        (e.sicilNo ?? '').toLocaleLowerCase('tr').includes(q)
      )
    })
  }, [eslemeler, arama, eslemeDurum, ayrilmis])

  const secili = tezgahlar.find((t) => t.id === tezgahId)

  const kolonlar: SiralanabilirKolon<Esleme>[] = [
    {
      key: 'adSoyad',
      label: 'Personel',
      primary: true,
      siralanabilir: true,
      siraDeger: (e) => e.adSoyad ?? '',
      // "Ayrılmış" göstergesi burada, ayrı kolonda DEĞİL: ayrı kolon başlığı da
      // "Personel" oluyordu (çift başlık) ve aktif kişilerde boş '—' basıyordu.
      render: (e) =>
        e.adSoyad ? (
          <span className="inline-flex items-center gap-2">
            {e.adSoyad}
            {e.personelAktif === false && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                <UserX className="h-3.5 w-3.5" /> ayrılmış
              </span>
            )}
          </span>
        ) : (
          <span className="text-slate-400">(personel kaydı bulunamadı: {e.personnelId.slice(0, 8)}…)</span>
        ),
    },
    { key: 'sicilNo', label: 'Sicil', siralanabilir: true, render: (e) => e.sicilNo ?? '—' },
    { key: 'bolum', label: 'Bölüm', hideOnMobile: true, siralanabilir: true, render: (e) => e.bolum ?? '—' },
    { key: 'kaynak', label: 'Kaynak', hideOnMobile: true, siralanabilir: true, render: (e) => <Badge variant="outline">{e.kaynak}</Badge> },
    {
      key: 'aktif',
      label: 'Eşleme',
      siralanabilir: true,
      siraTipi: 'bool',
      render: (e) =>
        canEdit ? (
          <Switch
            checked={e.aktif}
            onCheckedChange={async (v) => {
              const ok = await iproYaz(
                `/api/ipro/yonetim/operator-eslemeleri/${e.id}`,
                { method: 'PATCH', body: JSON.stringify({ aktif: v }) },
                v ? 'Eşleme aktifleştirildi' : 'Eşleme pasifleştirildi',
              )
              if (ok) void eslemeleriYukle(tezgahId)
            }}
          />
        ) : (
          <AktifRozet aktif={e.aktif} />
        ),
    },
    ...(canEdit
      ? [
          {
            key: 'islem', label: '', actions: true,
            render: (e: Esleme) => (
              <Button variant="ghost" size="sm" onClick={() => setSilinecek(e)}>
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            ),
          } as SiralanabilirKolon<Esleme>,
        ]
      : []),
  ]

  async function sil() {
    if (!silinecek) return
    const ok = await iproYaz(
      `/api/ipro/yonetim/operator-eslemeleri/${silinecek.id}`,
      { method: 'DELETE' },
      'Eşleme kaldırıldı',
    )
    setSilinecek(null)
    if (ok) void eslemeleriYukle(tezgahId)
  }

  async function personelEkle(personnelId: string) {
    const ok = await iproYaz(
      '/api/ipro/yonetim/operator-eslemeleri',
      { method: 'POST', body: JSON.stringify({ tezgahId, personnelId }) },
      'Operatör eklendi',
    )
    if (ok) {
      setEkleAcik(false)
      void eslemeleriYukle(tezgahId)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[320px] flex-1 space-y-1.5">
          <label className="text-sm font-medium">Tezgah</label>
          <TezgahSecici tezgahlar={tezgahlar} secili={secili ?? null} onSec={setTezgahId} />
        </div>
        {tezgahId && canEdit && (
          <div className="flex gap-2">
            <Button onClick={() => setEkleAcik((a) => !a)}>
              <Plus className="mr-1 h-4 w-4" /> Operatör ekle
            </Button>
            <Button variant="outline" onClick={() => setTopluAcik(true)}>
              <Users className="mr-1 h-4 w-4" /> Toplu ekle
            </Button>
          </div>
        )}
      </div>

      {ekleAcik && tezgahId && <PersonelSecici onSec={personelEkle} />}

      {tezgahId && (
        <TopluEkleDialog
          tezgahId={tezgahId}
          acik={topluAcik}
          onKapat={() => setTopluAcik(false)}
          onEklendi={() => void eslemeleriYukle(tezgahId)}
        />
      )}

      {tezgahId && (
        <>
          <ListeAracCubugu
            arama={arama}
            onArama={setArama}
            placeholder="Ad veya sicil ara…"
            gosterilen={gosterilen.length}
            toplam={eslemeler.length}
            gruplar={[
              {
                ad: 'Eşleme',
                secili: eslemeDurum,
                sec: (v) => setEslemeDurum(v as typeof eslemeDurum),
                secenekler: [
                  { deger: 'hepsi', etiket: 'Hepsi' },
                  { deger: 'aktif', etiket: 'Aktif' },
                  { deger: 'pasif', etiket: 'Pasif' },
                ],
              },
              {
                ad: 'Ayrılmış',
                secili: ayrilmis,
                sec: (v) => setAyrilmis(v as typeof ayrilmis),
                secenekler: [
                  { deger: 'goster', etiket: 'Göster' },
                  { deger: 'gizle', etiket: 'Gizle' },
                ],
              },
            ]}
          >
            {secili && !secili.aktif && <Badge variant="destructive">Tezgah pasif</Badge>}
          </ListeAracCubugu>

          {yukleniyor ? (
            <p className="py-8 text-center text-sm text-slate-500">Yükleniyor…</p>
          ) : (
            <SiralanabilirTablo
              kolonlar={kolonlar}
              veri={gosterilen}
              emptyMessage="Bu tezgaha bağlı operatör yok"
            />
          )}
        </>
      )}

      {!tezgahId && (
        <p className="py-12 text-center text-sm text-slate-500">
          Operatörlerini görmek için yukarıdan bir tezgah seçin.
        </p>
      )}

      <AlertDialog open={!!silinecek} onOpenChange={(a) => !a && setSilinecek(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eşleme kaldırılsın mı?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{silinecek?.adSoyad ?? silinecek?.personnelId}</strong> bu tezgahtan tamamen kaldırılacak.
              Geçmişi korumak isterseniz silmek yerine <em>Eşleme</em> anahtarını kapatın (pasifleştirme).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={sil}>Kaldır</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/**
 * Personel arayıcı. Mevcut `PersonnelAutocomplete` isim string'i döndürdüğü için
 * (id değil) burada kendi ucumuz kullanılıyor: /api/ipro/yonetim/personel-ara.
 */
type Aday = { id: string; adSoyad: string | null; sicilNo: string | null; bolum: string | null }

// Toplu operatör ekleme — bölüm filtresi + çoklu-seçim (Melike #4). "Görünenleri seç" = bölümden çekme.
// Aday listesi: aktif personel − zaten aktif eşli olanlar (server hesaplar).
function TopluEkleDialog({
  tezgahId,
  acik,
  onKapat,
  onEklendi,
}: {
  tezgahId: string
  acik: boolean
  onKapat: () => void
  onEklendi: () => void
}) {
  const [adaylar, setAdaylar] = useState<Aday[]>([])
  const [secililer, setSecililer] = useState<Set<string>>(new Set())
  const [bolum, setBolum] = useState<string>('hepsi')
  const [yukleniyor, setYukleniyor] = useState(false)
  const [gonderiliyor, setGonderiliyor] = useState(false)

  useEffect(() => {
    if (!acik) return
    setSecililer(new Set())
    setBolum('hepsi')
    void (async () => {
      setYukleniyor(true)
      const { ok, data } = await iproFetch<{ adaylar: Aday[] }>(
        `/api/ipro/yonetim/operator-eslemeleri/toplu?tezgahId=${tezgahId}`,
      )
      if (ok) setAdaylar(data.adaylar)
      setYukleniyor(false)
    })()
  }, [acik, tezgahId])

  const bolumler = useMemo(
    () => [...new Set(adaylar.map((a) => a.bolum).filter((b): b is string => !!b))].sort((a, b) => a.localeCompare(b, 'tr')),
    [adaylar],
  )
  const gosterilen = useMemo(
    () => (bolum === 'hepsi' ? adaylar : adaylar.filter((a) => a.bolum === bolum)),
    [adaylar, bolum],
  )

  function toggle(id: string) {
    setSecililer((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function gonder() {
    const ids = [...secililer]
    if (ids.length === 0) return
    setGonderiliyor(true)
    try {
      const { ok, data } = await iproFetch<{ eklenen: number; reaktiveEdilen: number; zatenAktif: number; error?: string }>(
        '/api/ipro/yonetim/operator-eslemeleri/toplu',
        { method: 'POST', body: JSON.stringify({ tezgahId, personnelIds: ids }) },
      )
      if (!ok) {
        toast.error(data?.error ?? 'Toplu eşleme başarısız')
        return
      }
      toast.success(`${data.eklenen} eklendi, ${data.reaktiveEdilen} yeniden aktifleştirildi`)
      onEklendi()
      onKapat()
    } finally {
      setGonderiliyor(false)
    }
  }

  return (
    <Dialog open={acik} onOpenChange={(o) => !o && onKapat()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Toplu Operatör Ekle</DialogTitle>
          <DialogDescription>Bölüm seçip operatörleri işaretleyin. Zaten eşli olanlar listede yoktur.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={bolum} onValueChange={setBolum}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Bölüm" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hepsi">Tüm bölümler</SelectItem>
                {bolumler.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSecililer((s) => new Set([...s, ...gosterilen.map((a) => a.id)]))}
              disabled={gosterilen.length === 0}
            >
              Görünenleri seç
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSecililer(new Set())} disabled={secililer.size === 0}>
              Temizle
            </Button>
          </div>

          <div className="max-h-72 space-y-1 overflow-y-auto rounded border p-2">
            {yukleniyor ? (
              <p className="py-4 text-center text-sm text-slate-400">Yükleniyor…</p>
            ) : gosterilen.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">Eklenebilecek operatör yok.</p>
            ) : (
              gosterilen.map((a) => (
                <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50">
                  <Checkbox checked={secililer.has(a.id)} onCheckedChange={() => toggle(a.id)} />
                  <span className="flex-1 text-sm">{a.adSoyad ?? '—'}</span>
                  <span className="text-xs text-slate-400">{a.sicilNo ?? '—'} · {a.bolum ?? '—'}</span>
                </label>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onKapat}>Vazgeç</Button>
          <Button onClick={gonder} disabled={secililer.size === 0 || gonderiliyor}>
            {gonderiliyor ? 'Ekleniyor…' : `Ekle (${secililer.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PersonelSecici({ onSec }: { onSec: (personnelId: string) => void }) {
  const [q, setQ] = useState('')
  const [sonuclar, setSonuclar] = useState<
    { id: string; adSoyad: string; sicilNo: string | null; bolum: string; gorev: string }[]
  >([])
  const [araniyor, setAraniyor] = useState(false)

  useEffect(() => {
    if (q.trim().length < 2) {
      setSonuclar([])
      return
    }
    // Yazarken her tuşta istek atmamak için kısa gecikme.
    const zamanlayici = setTimeout(async () => {
      setAraniyor(true)
      const { ok, data } = await iproFetch<{ personeller: typeof sonuclar }>(
        `/api/ipro/yonetim/personel-ara?q=${encodeURIComponent(q)}`,
      )
      if (ok) setSonuclar(data.personeller)
      setAraniyor(false)
    }, 300)
    return () => clearTimeout(zamanlayici)
  }, [q])

  return (
    <div className="space-y-2 rounded-lg border bg-slate-50 p-4">
      <label className="text-sm font-medium">Personel ara ve seç</label>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="En az 2 karakter — ad veya sicil…"
          className="pl-8"
          autoFocus
        />
      </div>

      {araniyor && <p className="text-xs text-slate-500">Aranıyor…</p>}
      {!araniyor && q.trim().length >= 2 && sonuclar.length === 0 && (
        <p className="text-xs text-slate-500">Sonuç yok (yalnız aktif personel aranır).</p>
      )}

      {sonuclar.length > 0 && (
        <div className="max-h-64 divide-y overflow-y-auto rounded-md border bg-white">
          {sonuclar.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSec(p.id)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span>
                <span className="font-medium">{p.adSoyad}</span>
                <span className="ml-2 text-slate-500">{p.sicilNo ?? '—'}</span>
              </span>
              <span className="text-xs text-slate-500">{p.bolum} · {p.gorev}</span>
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-500">
        Zaten pasif bir eşleme varsa yeniden aktifleştirilir, kopya kayıt oluşmaz.
      </p>
    </div>
  )
}

/**
 * Aranabilir tezgah seçici (shadcn Combobox deseni: Popover + Command).
 *
 * 203 tezgah düz dropdown'da kullanışsızdı.
 *
 * FİLTRELEME KENDİMİZDE (`shouldFilter={false}`). cmdk'nın varsayılan filtresi
 * `command-score` ile BULANIK eşleşme yapıyor: "preshane" harflerini KALIPHANE
 * içinde boşluklu alt-dizi olarak tutturup alakasız grubu listede bırakıyordu.
 * Yerine birebir `includes` kullanılıyor — kod, ad ve MAS grubu ayrı ayrı.
 *
 * Grup adı eşleşirse o grubun TÜM tezgahları görünür (preshane → PRESHANE'nin
 * 17 tezgahı) — istenen davranış bu; sorun bulanık eşleşmeydi.
 *
 * Normalizasyon ortak `iproNormalize` ile: aksan katlamalı — "sasi" de "şasi"
 * de ŞASİ KAYNAK'ı bulur, "kaliphane" de KALIPHANE'yi.
 */
function TezgahSecici({
  tezgahlar,
  secili,
  onSec,
}: {
  tezgahlar: Tezgah[]
  secili: Tezgah | null
  onSec: (id: string) => void
}) {
  const [acik, setAcik] = useState(false)
  const [sorgu, setSorgu] = useState('')

  const gruplar = useMemo(() => {
    const norm = iproNormalize
    const q = norm(sorgu)

    const uygun = tezgahlar.filter((t) => {
      if (!q) return true
      return (
        norm(t.kod).includes(q) ||
        norm(t.ad).includes(q) ||
        norm(t.masGrupAdi ?? '').includes(q)
      )
    })

    const m = new Map<string, Tezgah[]>()
    for (const t of uygun) {
      const g = t.masGrupAdi ?? '(grupsuz)'
      if (!m.has(g)) m.set(g, [])
      m.get(g)!.push(t)
    }
    // Gruplar alfabetik, grup içi tezgahlar kod sırasında.
    return [...m.entries()]
      .map(([grup, liste]) => [grup, [...liste].sort((a, b) => a.kod.localeCompare(b.kod, 'tr', { numeric: true }))] as const)
      .sort((a, b) => a[0].localeCompare(b[0], 'tr'))
  }, [tezgahlar, sorgu])

  const sonucVar = gruplar.length > 0

  return (
    <Popover open={acik} onOpenChange={setAcik}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={acik} className="w-full justify-between font-normal">
          {secili ? (
            <span className="truncate">
              <span className="font-medium">{secili.kod}</span>
              <span className="text-slate-500"> — {secili.ad}</span>
              <span className="text-slate-500"> ({secili.operatorSayisi})</span>
            </span>
          ) : (
            <span className="text-slate-500">Tezgah seçin…</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        {/* shouldFilter=false → eşleşme yukarıdaki useMemo'da, cmdk yalnız
            klavye gezinme ve seçim işini yapar. */}
        <Command shouldFilter={false}>
          <CommandInput placeholder="Kod, ad veya MAS grubu ara…" value={sorgu} onValueChange={setSorgu} />
          <CommandList className="max-h-80">
            {!sonucVar && <CommandEmpty>Tezgah bulunamadı.</CommandEmpty>}
            {gruplar.map(([grup, liste]) => (
              <CommandGroup key={grup} heading={`${grup} (${liste.length})`}>
                {liste.map((t) => (
                  <CommandItem
                    key={t.id}
                    value={t.id}
                    onSelect={() => {
                      onSec(t.id)
                      setSorgu('')
                      setAcik(false)
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', secili?.id === t.id ? 'opacity-100' : 'opacity-0')} />
                    <span className="flex-1 truncate">
                      <span className="font-medium">{t.kod}</span>
                      <span className="text-slate-500"> — {t.ad}</span>
                    </span>
                    <span className="ml-2 shrink-0 text-xs text-slate-400">{t.operatorSayisi}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

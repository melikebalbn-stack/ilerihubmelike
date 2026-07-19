'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Trash2, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/responsive-table'
import { iproFetch, iproYaz, AktifRozet } from './ortak'

type Tezgah = { id: string; kod: string; ad: string; aktif: boolean; operatorSayisi: number }
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
    if (!q) return eslemeler
    return eslemeler.filter(
      (e) =>
        (e.adSoyad ?? '').toLocaleLowerCase('tr').includes(q) ||
        (e.sicilNo ?? '').toLocaleLowerCase('tr').includes(q),
    )
  }, [eslemeler, arama])

  const secili = tezgahlar.find((t) => t.id === tezgahId)

  const kolonlar: ResponsiveColumn<Esleme>[] = [
    {
      key: 'adSoyad',
      label: 'Personel',
      primary: true,
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
    { key: 'sicilNo', label: 'Sicil', render: (e) => e.sicilNo ?? '—' },
    { key: 'bolum', label: 'Bölüm', hideOnMobile: true, render: (e) => e.bolum ?? '—' },
    { key: 'kaynak', label: 'Kaynak', hideOnMobile: true, render: (e) => <Badge variant="outline">{e.kaynak}</Badge> },
    {
      key: 'aktif',
      label: 'Eşleme',
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
          } as ResponsiveColumn<Esleme>,
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
        <div className="min-w-[260px] flex-1 space-y-1.5">
          <label className="text-sm font-medium">Tezgah</label>
          <Select value={tezgahId} onValueChange={setTezgahId}>
            <SelectTrigger>
              <SelectValue placeholder="Tezgah seçin…" />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {tezgahlar.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.kod} — {t.ad} ({t.operatorSayisi})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {tezgahId && canEdit && (
          <Button onClick={() => setEkleAcik((a) => !a)}>
            <Plus className="mr-1 h-4 w-4" /> Operatör ekle
          </Button>
        )}
      </div>

      {ekleAcik && tezgahId && <PersonelSecici onSec={personelEkle} />}

      {tezgahId && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={arama}
                onChange={(e) => setArama(e.target.value)}
                placeholder="Ad veya sicil ara…"
                className="pl-8"
              />
            </div>
            <Badge variant="outline">
              {gosterilen.length} / {eslemeler.length}
            </Badge>
            {secili && !secili.aktif && <Badge variant="destructive">Tezgah pasif</Badge>}
          </div>

          {yukleniyor ? (
            <p className="py-8 text-center text-sm text-slate-500">Yükleniyor…</p>
          ) : (
            <ResponsiveTable
              columns={kolonlar}
              data={gosterilen}
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

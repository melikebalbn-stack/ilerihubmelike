'use client'

import { useEffect, useState } from 'react'
import { Copy, KeyRound, MonitorSmartphone, Pencil, Plus, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/responsive-table'
import { iproFetch, iproYaz, AktifRozet } from './ortak'

type Tezgah = { id: string; kod: string; ad: string }
type Kiosk = {
  id: string
  kod: string
  ad: string
  aktif: boolean
  sonGirisAt: string | null
  userEmail: string
  userAktif: boolean
  tezgahlar: Tezgah[]
}

export function KiosklarClient({ canEdit }: { canEdit: boolean }) {
  const [kiosklar, setKiosklar] = useState<Kiosk[]>([])
  const [tezgahlar, setTezgahlar] = useState<Tezgah[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [yeniAcik, setYeniAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<Kiosk | null>(null)
  const [sifreYenilenecek, setSifreYenilenecek] = useState<Kiosk | null>(null)
  /** Üretilen şifre — YALNIZ bir kez gösterilir, sunucudan tekrar alınamaz. */
  const [gosterilecekSifre, setGosterilecekSifre] = useState<{ kod: string; sifre: string } | null>(null)

  async function yukle() {
    setYukleniyor(true)
    try {
      const [k, t] = await Promise.all([
        iproFetch<{ kiosklar: Kiosk[] }>('/api/ipro/yonetim/kiosklar'),
        iproFetch<{ tezgahlar: Tezgah[] }>('/api/ipro/yonetim/tezgahlar'),
      ])
      if (k.ok) setKiosklar(k.data.kiosklar)
      if (t.ok) setTezgahlar(t.data.tezgahlar)
    } finally {
      setYukleniyor(false)
    }
  }
  useEffect(() => {
    void yukle()
  }, [])

  const kolonlar: ResponsiveColumn<Kiosk>[] = [
    { key: 'kod', label: 'Cihaz kodu', primary: true },
    { key: 'ad', label: 'Ad' },
    {
      key: 'tezgahlar',
      label: 'Tezgahlar',
      render: (k) =>
        k.tezgahlar.length === 0 ? (
          <span className="text-amber-600">bağlı tezgah yok</span>
        ) : (
          <span className="text-sm">{k.tezgahlar.map((t) => t.kod).join(', ')}</span>
        ),
    },
    { key: 'userEmail', label: 'Hesap', hideOnMobile: true },
    {
      key: 'sonGirisAt',
      label: 'Son giriş',
      hideOnMobile: true,
      render: (k) => (k.sonGirisAt ? new Date(k.sonGirisAt).toLocaleString('tr-TR') : 'hiç'),
    },
    { key: 'aktif', label: 'Durum', render: (k) => <AktifRozet aktif={k.aktif} /> },
    ...(canEdit
      ? [
          {
            key: 'islem', label: '', actions: true,
            render: (k: Kiosk) => (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setDuzenlenen(k)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSifreYenilenecek(k)} title="Şifre yenile">
                  <KeyRound className="h-4 w-4" />
                </Button>
              </div>
            ),
          } as ResponsiveColumn<Kiosk>,
        ]
      : []),
  ]

  async function sifreYenile() {
    if (!sifreYenilenecek) return
    const { ok, data } = await iproFetch<{ kiosk: { kod: string; sifre: string }; error?: string }>(
      `/api/ipro/yonetim/kiosklar/${sifreYenilenecek.id}/sifre`,
      { method: 'POST' },
    )
    setSifreYenilenecek(null)
    if (ok) {
      setGosterilecekSifre(data.kiosk)
      void yukle()
    } else {
      toast.error(data?.error ?? 'Şifre yenilenemedi')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="outline">{kiosklar.length} cihaz</Badge>
        {canEdit && (
          <Button onClick={() => setYeniAcik(true)}>
            <Plus className="mr-1 h-4 w-4" /> Yeni cihaz
          </Button>
        )}
      </div>

      {yukleniyor ? (
        <p className="py-8 text-center text-sm text-slate-500">Yükleniyor…</p>
      ) : (
        <ResponsiveTable columns={kolonlar} data={kiosklar} emptyMessage="Kayıtlı kiosk cihazı yok" />
      )}

      <YeniCihazDialog
        acik={yeniAcik}
        tezgahlar={tezgahlar}
        onKapat={() => setYeniAcik(false)}
        onOlusturuldu={(s) => {
          setYeniAcik(false)
          setGosterilecekSifre(s)
          void yukle()
        }}
      />

      <DuzenleDialog
        kiosk={duzenlenen}
        tezgahlar={tezgahlar}
        onKapat={() => setDuzenlenen(null)}
        onKaydedildi={() => {
          setDuzenlenen(null)
          void yukle()
        }}
      />

      <AlertDialog open={!!sifreYenilenecek} onOpenChange={(a) => !a && setSifreYenilenecek(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Şifre yenilensin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{sifreYenilenecek?.kod}</strong> cihazının şifresi yenilenecek. Eski şifre <strong>anında
              geçersiz</strong> olur; cihaz atölyede yeniden giriş yapmak zorunda kalır. Yeni şifre yalnızca bir kez
              gösterilecek.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={sifreYenile}>Yenile</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SifreDialog deger={gosterilecekSifre} onKapat={() => setGosterilecekSifre(null)} />
    </div>
  )
}

// ── Şifre gösterimi (tek seferlik) ───────────────────────────────────────

function SifreDialog({
  deger, onKapat,
}: { deger: { kod: string; sifre: string } | null; onKapat: () => void }) {
  return (
    <Dialog open={!!deger} onOpenChange={(a) => !a && onKapat()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            Cihaz şifresi — bir kez gösterilir
          </DialogTitle>
          <DialogDescription>
            Bu şifre veritabanında geri döndürülemez biçimde saklanır. Şimdi kaydedin; kapattıktan sonra tekrar
            görüntülenemez, yalnızca yenilenebilir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Cihaz kodu</p>
            <p className="font-mono text-lg font-semibold">{deger?.kod}</p>
          </div>
          <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
            <p className="text-xs text-amber-700">Şifre</p>
            <div className="flex items-center justify-between gap-3">
              <p className="select-all font-mono text-2xl font-bold tracking-wider">{deger?.sifre}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!deger) return
                  await navigator.clipboard.writeText(deger.sifre)
                  toast.success('Şifre panoya kopyalandı')
                }}
              >
                <Copy className="mr-1 h-4 w-4" /> Kopyala
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onKapat}>Kaydettim, kapat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Tezgah seçici ────────────────────────────────────────────────────────

function TezgahSecici({
  tezgahlar, secili, onDegis,
}: { tezgahlar: Tezgah[]; secili: string[]; onDegis: (ids: string[]) => void }) {
  const [q, setQ] = useState('')
  const gosterilen = tezgahlar.filter((t) => {
    const s = q.trim().toLocaleLowerCase('tr')
    return !s || t.kod.toLocaleLowerCase('tr').includes(s) || t.ad.toLocaleLowerCase('tr').includes(s)
  })

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Bağlı tezgahlar</Label>
        <Badge variant="outline">{secili.length} seçili</Badge>
      </div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tezgah ara…" />
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
        {gosterilen.map((t) => (
          <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50">
            <Checkbox
              checked={secili.includes(t.id)}
              onCheckedChange={(v) =>
                onDegis(v ? [...secili, t.id] : secili.filter((x) => x !== t.id))
              }
            />
            <span className="text-sm">
              <span className="font-medium">{t.kod}</span> <span className="text-slate-500">{t.ad}</span>
            </span>
          </label>
        ))}
        {gosterilen.length === 0 && <p className="px-2 py-3 text-sm text-slate-500">Sonuç yok</p>}
      </div>
    </div>
  )
}

// ── Yeni cihaz ───────────────────────────────────────────────────────────

function YeniCihazDialog({
  acik, tezgahlar, onKapat, onOlusturuldu,
}: {
  acik: boolean
  tezgahlar: Tezgah[]
  onKapat: () => void
  onOlusturuldu: (s: { kod: string; sifre: string }) => void
}) {
  const [kod, setKod] = useState('')
  const [ad, setAd] = useState('')
  const [tezgahIds, setTezgahIds] = useState<string[]>([])
  const [onayAcik, setOnayAcik] = useState(false)
  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => {
    if (acik) {
      setKod('')
      setAd('')
      setTezgahIds([])
    }
  }, [acik])

  async function olustur() {
    setKaydediliyor(true)
    const { ok, data } = await iproFetch<{ kiosk: { kod: string; sifre: string }; error?: string }>(
      '/api/ipro/yonetim/kiosklar',
      { method: 'POST', body: JSON.stringify({ kod, ad, tezgahIds }) },
    )
    setKaydediliyor(false)
    setOnayAcik(false)
    if (ok) {
      toast.success('Cihaz oluşturuldu')
      onOlusturuldu(data.kiosk)
    } else {
      toast.error(data?.error ?? 'Cihaz oluşturulamadı')
    }
  }

  return (
    <>
      <Dialog open={acik} onOpenChange={(a) => !a && onKapat()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MonitorSmartphone className="h-5 w-5" />
              Yeni kiosk cihazı
            </DialogTitle>
            <DialogDescription>
              Cihaz için KIOSK rollü bir kullanıcı hesabı oluşturulur. Bu hesap yalnız kiosk ekranına giriş yapar,
              İK listelerine düşmez.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="k-kod">Cihaz kodu</Label>
              <Input
                id="k-kod"
                value={kod}
                onChange={(e) => setKod(e.target.value.toLocaleUpperCase('tr'))}
                placeholder="ör. KIOSK-CN01"
              />
              <p className="text-xs text-slate-500">Atölyede girişte kullanılır. Büyük harfe çevrilir.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k-ad">Cihaz adı</Label>
              <Input id="k-ad" value={ad} onChange={(e) => setAd(e.target.value)} placeholder="ör. CNC Hattı Terminal 1" />
            </div>
            <TezgahSecici tezgahlar={tezgahlar} secili={tezgahIds} onDegis={setTezgahIds} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onKapat}>Vazgeç</Button>
            <Button onClick={() => setOnayAcik(true)} disabled={!kod.trim() || !ad.trim()}>
              Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={onayAcik} onOpenChange={setOnayAcik}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cihaz ve kullanıcı hesabı oluşturulsun mu?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{kod}</strong> için sisteme giriş yapabilen <strong>KIOSK rollü bir kullanıcı hesabı</strong>{' '}
              açılacak. Şifre otomatik üretilecek ve <strong>yalnızca bir kez</strong> gösterilecek.
              {tezgahIds.length === 0 && (
                <span className="mt-2 block text-amber-600">
                  Hiç tezgah seçilmedi — cihaz giriş yapar ama tezgah listesi boş görünür.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={olustur} disabled={kaydediliyor}>
              {kaydediliyor ? 'Oluşturuluyor…' : 'Oluştur'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ── Düzenle ──────────────────────────────────────────────────────────────

function DuzenleDialog({
  kiosk, tezgahlar, onKapat, onKaydedildi,
}: { kiosk: Kiosk | null; tezgahlar: Tezgah[]; onKapat: () => void; onKaydedildi: () => void }) {
  const [ad, setAd] = useState('')
  const [aktif, setAktif] = useState(true)
  const [tezgahIds, setTezgahIds] = useState<string[]>([])
  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => {
    if (!kiosk) return
    setAd(kiosk.ad)
    setAktif(kiosk.aktif)
    setTezgahIds(kiosk.tezgahlar.map((t) => t.id))
  }, [kiosk])

  async function kaydet() {
    if (!kiosk) return
    setKaydediliyor(true)
    const ok = await iproYaz(
      `/api/ipro/yonetim/kiosklar/${kiosk.id}`,
      { method: 'PATCH', body: JSON.stringify({ ad, aktif, tezgahIds }) },
      `${kiosk.kod} güncellendi`,
    )
    setKaydediliyor(false)
    if (ok) onKaydedildi()
  }

  return (
    <Dialog open={!!kiosk} onOpenChange={(a) => !a && onKapat()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cihaz düzenle — {kiosk?.kod}</DialogTitle>
          <DialogDescription>
            Cihaz kodu ve şifresi buradan değişmez. Şifre için listedeki anahtar simgesini kullanın.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="kd-ad">Cihaz adı</Label>
            <Input id="kd-ad" value={ad} onChange={(e) => setAd(e.target.value)} />
          </div>
          <TezgahSecici tezgahlar={tezgahlar} secili={tezgahIds} onDegis={setTezgahIds} />
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div>
              <Label htmlFor="kd-aktif" className="font-normal">Aktif</Label>
              <p className="text-xs text-slate-500">Pasifleştirilirse bağlı kullanıcı hesabı da devre dışı kalır.</p>
            </div>
            <Switch id="kd-aktif" checked={aktif} onCheckedChange={setAktif} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onKapat}>Vazgeç</Button>
          <Button onClick={kaydet} disabled={kaydediliyor || !ad.trim()}>
            {kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

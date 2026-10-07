'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, Bar, LabelList,
} from 'recharts'
import { Loader2, PlusCircle, Target, Pencil, Trash2 } from 'lucide-react'

const NAVY = '#1B4F72'
const YESIL = '#16a34a'
const KIRMIZI = '#dc2626'
const AY_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
const AY_ADI = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

interface Olcum {
  id: string
  year: number
  month: number
  target: number | null
  actual: number | null
  hedefNA: boolean
  gerceklesenNA: boolean
  manuelOran: number | null
}

interface OzelAlanDeger {
  year: number
  month: number
  value: number | null
  naMi: boolean
}

// KPI-FORMUL: bkz. api/sandbox/melike/kpi/formul-motoru.ts — aynı şekil.
interface FormulReferans { token: string; kpiId: string; kaynak: string }
interface FormulTanimi { ifade: string; referanslar: FormulReferans[] }

interface OzelAlan {
  id: string
  key: string
  label: string
  siraNo: number
  formul: FormulTanimi | null
  formulMu: boolean
  degerler: OzelAlanDeger[]
}

interface Aksiyon {
  id: string
  reason: string | null
  action: string | null
  completionPercent: number | null
  status: string
  responsibleId: string | null
  sorumluPersonelId: string | null
  responsibleName: string | null
  startDate: string | null
  endDate: string | null
}

interface Baseline {
  year: number
  average: number
}

interface Kpi {
  id: string
  name: string
  unit: string | null
  direction: string
  frequency: string
  gerceklesenEtiketi: string
  hedefEtiketi: string
  oranYonu: string
  oranPayKaynagi: string
  oranBirimi: string
  ortalamaKaynagi: string
  yuzdeOlcek: string
  gerceklesenFormul: FormulTanimi | null
  hedefFormul: FormulTanimi | null
  gerceklesenFormulMu: boolean
  hedefFormulMu: boolean
  ozelAlanlar: OzelAlan[]
  measurements: Olcum[]
  baselines: Baseline[]
  actions: Aksiyon[]
}

const CEYREK_ADI = ['Ç1', 'Ç2', 'Ç3', 'Ç4']
const CEYREK_ADI_UZUN = ['1. Çeyrek', '2. Çeyrek', '3. Çeyrek', '4. Çeyrek']

function donemKisaEtiketleri(kpi: Kpi): string[] {
  return kpi.frequency === 'quarterly' ? CEYREK_ADI : AY_KISA
}
function donemUzunEtiketleri(kpi: Kpi): string[] {
  return kpi.frequency === 'quarterly' ? CEYREK_ADI_UZUN : AY_ADI
}
function donemSayisi(kpi: Kpi): number {
  return kpi.frequency === 'quarterly' ? 4 : 12
}

// Yıl → ortalama haritası. Aylık ölçümü olan yıllarda KENDİSİ hesaplanır;
// aylık kırılımı olmayan eski yıllarda (2020-2023 gibi) Excel'den/elle
// girilmiş KPIYearlyBaseline değeri kullanılır. Grafik ve tablo aynı
// fonksiyonu kullanır ki ikisi hep tutarlı olsun.
// "Ort." (yıllık ortalama) ve oranın payı gibi yerlerde, seçili kaynağın (Gerçekleşen ya da bir
// özel alan) belirli bir ay/yıldaki değerini okur.
function kaynakDegeriAl(kpi: Kpi, kaynak: string, yil: number, ay: number): number | null {
  if (kaynak === 'actual') {
    return kpi.measurements.find(m => m.year === yil && m.month === ay)?.actual ?? null
  }
  const alan = kpi.ozelAlanlar.find(a => a.key === kaynak)
  return alan?.degerler.find(d => d.year === yil && d.month === ay)?.value ?? null
}

function hesaplaOrtYillar(kpi: Kpi): [number, number][] {
  const yillarKumesi = new Set<number>([
    ...kpi.measurements.map(m => m.year),
    ...kpi.ozelAlanlar.flatMap(a => a.degerler.map(d => d.year)),
    ...kpi.baselines.map(b => b.year),
  ])
  const hesaplanan = new Map<number, number>()
  for (const yil of yillarKumesi) {
    const degerler: number[] = []
    for (let ay = 1; ay <= donemSayisi(kpi); ay++) {
      const d = kaynakDegeriAl(kpi, kpi.ortalamaKaynagi, yil, ay)
      if (d != null) degerler.push(d)
    }
    if (degerler.length > 0) hesaplanan.set(yil, degerler.reduce((a, b) => a + b, 0) / degerler.length)
  }
  for (const b of kpi.baselines) {
    if (!hesaplanan.has(b.year)) hesaplanan.set(b.year, b.average)
  }
  return Array.from(hesaplanan.entries()).sort(([a], [b]) => a - b)
}

// Ort. hücresinin rengi için: o yılın Hedef ortalamasına karşı, seçili ortalamaKaynagi'nın
// ortalamasını (basariSeviyesi ile) kıyaslar — aylık Gerçekleşen hücreleriyle aynı kural.
function yillikHedefOrtalamasi(kpi: Kpi): Map<number, number> {
  const sonuc = new Map<number, number>()
  const yillar = new Set(kpi.measurements.map(m => m.year))
  for (const yil of yillar) {
    const degerler = kpi.measurements
      .filter(m => m.year === yil && m.target != null && !m.hedefNA)
      .map(m => m.target as number)
    if (degerler.length > 0) sonuc.set(yil, degerler.reduce((a, b) => a + b, 0) / degerler.length)
  }
  return sonuc
}

interface OzelAlanTaslak { key: string; label: string; formul: FormulTanimi | null }

interface FormulKpiSecenegi {
  id: string
  name: string
  departman: string
  kaynaklar: { kaynak: string; label: string }[]
}

// KPI-FORMUL: bir alanı (Gerçekleşen/Hedef/özel alan) elle giriş yerine başka KPI'ların
// (farklı departmanlar dahil) değerlerinden hesaplayan formülü düzenler. Referans eklenince
// otomatik t1, t2... token'ı atanır; formül ifadesi bu token'ları kullanır (ör. "(t1*100)/t2").
function FormulDuzenleyici({
  formul, onChange, tumKpiler,
}: {
  formul: FormulTanimi | null
  onChange: (f: FormulTanimi | null) => void
  tumKpiler: FormulKpiSecenegi[]
}) {
  const aktif = formul != null

  function aktifDegistir(v: boolean) {
    onChange(v ? { ifade: '', referanslar: [] } : null)
  }
  function referansEkle() {
    if (!formul) return
    const sonrakiToken = `t${formul.referanslar.length + 1}`
    onChange({ ...formul, referanslar: [...formul.referanslar, { token: sonrakiToken, kpiId: '', kaynak: 'actual' }] })
  }
  function referansGuncelle(i: number, degisiklik: Partial<FormulReferans>) {
    if (!formul) return
    const yeni = [...formul.referanslar]
    yeni[i] = { ...yeni[i], ...degisiklik }
    onChange({ ...formul, referanslar: yeni })
  }
  function referansSil(i: number) {
    if (!formul) return
    onChange({ ...formul, referanslar: formul.referanslar.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="space-y-2 rounded-md border p-2 bg-slate-50">
      <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
        <input type="checkbox" checked={aktif} onChange={e => aktifDegistir(e.target.checked)} />
        Formülden hesapla (başka KPI'lardan otomatik)
      </label>
      {aktif && formul && (
        <div className="space-y-2 pl-1">
          {formul.referanslar.map((r, i) => {
            const secilenKpi = tumKpiler.find(k => k.id === r.kpiId)
            return (
              <div key={i} className="flex items-center gap-1 text-xs">
                <span className="font-mono bg-white border rounded px-1.5 py-1">{r.token}</span>
                <Select value={r.kpiId} onValueChange={v => referansGuncelle(i, { kpiId: v, kaynak: 'actual' })}>
                  <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue placeholder="KPI seç..." /></SelectTrigger>
                  <SelectContent>
                    {tumKpiler.map(k => (
                      <SelectItem key={k.id} value={k.id}>{k.departman} — {k.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={r.kaynak} onValueChange={v => referansGuncelle(i, { kaynak: v })} disabled={!secilenKpi}>
                  <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(secilenKpi?.kaynaklar ?? []).map(kay => (
                      <SelectItem key={kay.kaynak} value={kay.kaynak}>{kay.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => referansSil(i)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )
          })}
          <Button type="button" size="sm" variant="outline" className="h-6 text-xs" onClick={referansEkle}>
            <PlusCircle className="h-3 w-3 mr-1" /> Referans ekle
          </Button>
          <div>
            <Label className="text-xs">Formül (ör. (t1*100)/(t2*1000000))</Label>
            <Input
              value={formul.ifade}
              onChange={e => onChange({ ...formul, ifade: e.target.value })}
              placeholder="(t1*100)/(t2*1000000)"
              className="font-mono text-xs h-8"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// KPI-OZEL-ALAN: Türkçe karakterleri sadeleştirip etiketten bir anahtar (key) üretir —
// kullanıcı sadece etiketi (görünen ismi) girer, key arka planda otomatik oluşur.
function slugOlustur(etiket: string): string {
  const harfler: Record<string, string> = { ğ: 'g', ü: 'u', ş: 's', ı: 'i', ö: 'o', ç: 'c' }
  return etiket
    .trim()
    .toLocaleLowerCase('tr')
    .split('').map(c => harfler[c] ?? c).join('')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'alan'
}

function OzelAlanlarDuzenleyici({
  alanlar, onChange, oranPayKaynagi, onOranPayKaynagiChange, ortalamaKaynagi, onOrtalamaKaynagiChange, tumKpiler,
}: {
  alanlar: OzelAlanTaslak[]
  onChange: (a: OzelAlanTaslak[]) => void
  oranPayKaynagi: string
  onOranPayKaynagiChange: (v: string) => void
  ortalamaKaynagi: string
  onOrtalamaKaynagiChange: (v: string) => void
  tumKpiler: FormulKpiSecenegi[]
}) {
  function etiketDegistir(i: number, label: string) {
    const yeni = [...alanlar]
    yeni[i] = { ...yeni[i], key: slugOlustur(label), label }
    onChange(yeni)
  }
  function formulDegistir(i: number, formul: FormulTanimi | null) {
    const yeni = [...alanlar]
    yeni[i] = { ...yeni[i], formul }
    onChange(yeni)
  }
  function alanEkle() {
    onChange([...alanlar, { key: '', label: '', formul: null }])
  }
  function alanSil(i: number) {
    const silinen = alanlar[i]
    onChange(alanlar.filter((_, idx) => idx !== i))
    if (silinen && oranPayKaynagi === silinen.key) onOranPayKaynagiChange('actual')
    if (silinen && ortalamaKaynagi === silinen.key) onOrtalamaKaynagiChange('actual')
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <Label>Ek alanlar (opsiyonel)</Label>
        <Button type="button" size="sm" variant="outline" className="h-6 text-xs" onClick={alanEkle}>
          <PlusCircle className="h-3 w-3 mr-1" /> Alan ekle
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Gerçekleşen/Hedef'e ek, bu KPI'ya özel etiketli sayısal alanlar (ör. Gelen, Çözülen, Toplam).
      </p>
      {alanlar.map((a, i) => (
        <div key={i} className="space-y-1 border-b pb-2 last:border-b-0">
          <div className="flex items-center gap-2">
            <Input value={a.label} onChange={e => etiketDegistir(i, e.target.value)} placeholder="Örn: Toplam" className="flex-1" />
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => alanSil(i)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <FormulDuzenleyici formul={a.formul} onChange={f => formulDegistir(i, f)} tumKpiler={tumKpiler} />
        </div>
      ))}
      <div>
        <Label>Oranın payı (G/H'nin üst kısmı) hangi alandan gelsin</Label>
        <Select value={oranPayKaynagi} onValueChange={onOranPayKaynagiChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="actual">Gerçekleşen</SelectItem>
            {alanlar.filter(a => a.label.trim()).map(a => (
              <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>"Ort." (yıllık ortalama) hangi alandan hesaplansın</Label>
        <Select value={ortalamaKaynagi} onValueChange={onOrtalamaKaynagiChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="actual">Gerçekleşen</SelectItem>
            {alanlar.filter(a => a.label.trim()).map(a => (
              <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function YeniKpiDialog({ orgUnitId, onCreated }: { orgUnitId: string; onCreated: () => void }) {
  const [acik, setAcik] = useState(false)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [direction, setDirection] = useState('higher_is_better')
  const [frequency, setFrequency] = useState('monthly')
  const [gerceklesenEtiketi, setGerceklesenEtiketi] = useState('Gerçekleşen')
  const [hedefEtiketi, setHedefEtiketi] = useState('Hedef')
  const [oranYonu, setOranYonu] = useState('G_H')
  const [oranBirimi, setOranBirimi] = useState('yuzde')
  const [yuzdeOlcek, setYuzdeOlcek] = useState('oran')
  const [ozelAlanlar, setOzelAlanlar] = useState<OzelAlanTaslak[]>([])
  const [oranPayKaynagi, setOranPayKaynagi] = useState('actual')
  const [ortalamaKaynagi, setOrtalamaKaynagi] = useState('actual')
  const [gerceklesenFormul, setGerceklesenFormul] = useState<FormulTanimi | null>(null)
  const [hedefFormul, setHedefFormul] = useState<FormulTanimi | null>(null)
  const [tumKpiler, setTumKpiler] = useState<FormulKpiSecenegi[]>([])
  const [hedef, setHedef] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => {
    if (!acik) return
    fetch('/api/sandbox/melike/kpi/tum-liste').then(r => r.json()).then(d => setTumKpiler(d.kpiler ?? [])).catch(() => {})
  }, [acik])

  async function kaydet() {
    if (!name.trim()) return
    setKaydediliyor(true)
    try {
      const res = await fetch('/api/sandbox/melike/kpi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, unit, direction, orgUnitId, frequency,
          gerceklesenEtiketi: gerceklesenEtiketi.trim() || 'Gerçekleşen',
          hedefEtiketi: hedefEtiketi.trim() || 'Hedef',
          oranYonu,
          oranBirimi,
          yuzdeOlcek,
          ozelAlanlar,
          oranPayKaynagi,
          ortalamaKaynagi,
          gerceklesenFormul,
          hedefFormul,
        }),
      })
      if (res.ok) {
        const { kpi } = await res.json()
        // Hedef girildiyse bu yılın tüm dönemlerine (aylık: 12, çeyreklik: 4) tek seferde uygula.
        if (!hedefFormul && hedef.trim() && !Number.isNaN(Number(hedef))) {
          const yil = new Date().getFullYear()
          const donemSayisi = frequency === 'quarterly' ? 4 : 12
          await Promise.all(
            Array.from({ length: donemSayisi }, (_, i) =>
              fetch(`/api/sandbox/melike/kpi/${kpi.id}/olcum`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ year: yil, month: i + 1, target: Number(hedef), actual: null }),
              }),
            ),
          )
        }
        setName(''); setUnit(''); setDirection('higher_is_better'); setFrequency('monthly')
        setGerceklesenEtiketi('Gerçekleşen'); setHedefEtiketi('Hedef'); setOranYonu('G_H'); setHedef('')
        setOranBirimi('yuzde'); setYuzdeOlcek('oran')
        setOzelAlanlar([]); setOranPayKaynagi('actual'); setOrtalamaKaynagi('actual')
        setGerceklesenFormul(null); setHedefFormul(null)
        setAcik(false)
        onCreated()
      }
    } finally {
      setKaydediliyor(false)
    }
  }

  return (
    <Dialog open={acik} onOpenChange={setAcik}>
      <DialogTrigger asChild>
        <Button size="sm" style={{ backgroundColor: NAVY }}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Yeni KPI Ekle
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni KPI Ekle</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>KPI Adı</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Örn: Devir Hızı" />
          </div>
          <div>
            <Label>Birim (opsiyonel)</Label>
            <Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="%, Adet, Saat..." />
          </div>
          <div>
            <Label>Yön</Label>
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="higher_is_better">Yüksek değer iyi</SelectItem>
                <SelectItem value="lower_is_better">Düşük değer iyi</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Periyot</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Aylık</SelectItem>
                <SelectItem value="quarterly">Çeyreklik</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label>Gerçekleşen etiketi</Label>
              <Input value={gerceklesenEtiketi} onChange={e => setGerceklesenEtiketi(e.target.value)} placeholder="Gerçekleşen, Gelen..." />
            </div>
            <div className="flex-1">
              <Label>Hedef etiketi</Label>
              <Input value={hedefEtiketi} onChange={e => setHedefEtiketi(e.target.value)} placeholder="Hedef..." />
            </div>
          </div>
          <FormulDuzenleyici formul={gerceklesenFormul} onChange={setGerceklesenFormul} tumKpiler={tumKpiler} />
          <FormulDuzenleyici formul={hedefFormul} onChange={setHedefFormul} tumKpiler={tumKpiler} />
          <div className="flex gap-3">
            <div className="flex-1">
              <Label>Oran yönü</Label>
              <Select value={oranYonu} onValueChange={setOranYonu}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="G_H">G/H (gerçekleşen ÷ hedef)</SelectItem>
                  <SelectItem value="H_G">H/G (hedef ÷ gerçekleşen)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Oran birimi</Label>
              <Select value={oranBirimi} onValueChange={setOranBirimi}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yuzde">Yüzde (%)</SelectItem>
                  <SelectItem value="kat">Kat (x)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {unit.trim() === '%' && (
            <div>
              <Label>Yüzde değerleri nasıl giriliyor</Label>
              <Select value={yuzdeOlcek} onValueChange={setYuzdeOlcek}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="oran">0-1 arası oran (0,64 = %64)</SelectItem>
                  <SelectItem value="dogrudan">Doğrudan yüzde (64 = %64)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {!hedefFormul && (
            <div>
              <Label>Hedef (opsiyonel)</Label>
              <Input
                type="number"
                value={hedef}
                onChange={e => setHedef(e.target.value)}
                placeholder="Girilirse bu yılın tüm dönemlerine otomatik uygulanır"
              />
            </div>
          )}
          <OzelAlanlarDuzenleyici
            alanlar={ozelAlanlar}
            onChange={setOzelAlanlar}
            oranPayKaynagi={oranPayKaynagi}
            onOranPayKaynagiChange={setOranPayKaynagi}
            ortalamaKaynagi={ortalamaKaynagi}
            onOrtalamaKaynagiChange={setOrtalamaKaynagi}
            tumKpiler={tumKpiler}
          />
        </div>
        <DialogFooter>
          <Button onClick={kaydet} disabled={kaydediliyor || !name.trim()} style={{ backgroundColor: NAVY }}>
            {kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ExcelIslemleri({ orgUnitId, onImported }: { orgUnitId: string; onImported: () => void }) {
  const [yukleniyor, setYukleniyor] = useState(false)
  const dosyaInputRef = useRef<HTMLInputElement>(null)

  async function dosyaSecildi(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setYukleniyor(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('orgUnitId', orgUnitId)
      const res = await fetch('/api/sandbox/melike/kpi/import', { method: 'POST', body: form })
      const d = await res.json()
      if (!res.ok) {
        alert(d.error ?? 'İçeri alma başarısız')
        return
      }
      let mesaj = `İçeri alındı: ${d.kpiSayisi} KPI, ${d.olcumSayisi} ölçüm, ${d.aksiyonSayisi} aksiyon.`
      if (d.eslesmeyenSorumlular?.length > 0) {
        mesaj += `\n\nEşleşmeyen sorumlu isimleri (personel listesinde bulunamadı): ${d.eslesmeyenSorumlular.join(', ')}`
      }
      alert(mesaj)
      onImported()
    } finally {
      setYukleniyor(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 -mt-2">
      <a href="/api/sandbox/melike/kpi/sablon">
        <Button size="sm" variant="outline">Şablon İndir</Button>
      </a>
      <a href={`/api/sandbox/melike/kpi/export?orgUnitId=${orgUnitId}`}>
        <Button size="sm" variant="outline">Excel'e Aktar</Button>
      </a>
      <Button size="sm" variant="outline" disabled={yukleniyor} onClick={() => dosyaInputRef.current?.click()}>
        {yukleniyor ? 'İçeri alınıyor...' : "Excel'den İçeri Al"}
      </Button>
      <input
        ref={dosyaInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={dosyaSecildi}
        disabled={yukleniyor}
      />
    </div>
  )
}

function KpiDuzenleDialog({ kpi, onSaved }: { kpi: Kpi; onSaved: () => void }) {
  const [acik, setAcik] = useState(false)
  const [name, setName] = useState(kpi.name)
  const [unit, setUnit] = useState(kpi.unit ?? '')
  const [direction, setDirection] = useState(kpi.direction)
  const [frequency, setFrequency] = useState(kpi.frequency)
  const [gerceklesenEtiketi, setGerceklesenEtiketi] = useState(kpi.gerceklesenEtiketi)
  const [hedefEtiketi, setHedefEtiketi] = useState(kpi.hedefEtiketi)
  const [oranYonu, setOranYonu] = useState(kpi.oranYonu)
  const [oranBirimi, setOranBirimi] = useState(kpi.oranBirimi)
  const [yuzdeOlcek, setYuzdeOlcek] = useState(kpi.yuzdeOlcek)
  const [ozelAlanlar, setOzelAlanlar] = useState<OzelAlanTaslak[]>(
    kpi.ozelAlanlar.map(a => ({ key: a.key, label: a.label, formul: a.formul })),
  )
  const [oranPayKaynagi, setOranPayKaynagi] = useState(kpi.oranPayKaynagi)
  const [ortalamaKaynagi, setOrtalamaKaynagi] = useState(kpi.ortalamaKaynagi)
  const [gerceklesenFormul, setGerceklesenFormul] = useState<FormulTanimi | null>(kpi.gerceklesenFormul)
  const [hedefFormul, setHedefFormul] = useState<FormulTanimi | null>(kpi.hedefFormul)
  const [tumKpiler, setTumKpiler] = useState<FormulKpiSecenegi[]>([])
  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => {
    if (!acik) return
    setName(kpi.name); setUnit(kpi.unit ?? ''); setDirection(kpi.direction); setFrequency(kpi.frequency)
    setGerceklesenEtiketi(kpi.gerceklesenEtiketi); setHedefEtiketi(kpi.hedefEtiketi); setOranYonu(kpi.oranYonu)
    setOranBirimi(kpi.oranBirimi); setYuzdeOlcek(kpi.yuzdeOlcek)
    setOzelAlanlar(kpi.ozelAlanlar.map(a => ({ key: a.key, label: a.label, formul: a.formul })))
    setOranPayKaynagi(kpi.oranPayKaynagi); setOrtalamaKaynagi(kpi.ortalamaKaynagi)
    setGerceklesenFormul(kpi.gerceklesenFormul); setHedefFormul(kpi.hedefFormul)
    fetch('/api/sandbox/melike/kpi/tum-liste').then(r => r.json()).then(d => setTumKpiler(d.kpiler ?? [])).catch(() => {})
  }, [acik, kpi])

  async function kaydet() {
    if (!name.trim()) return
    setKaydediliyor(true)
    try {
      const res = await fetch(`/api/sandbox/melike/kpi/${kpi.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, unit, direction, frequency,
          gerceklesenEtiketi: gerceklesenEtiketi.trim() || 'Gerçekleşen',
          hedefEtiketi: hedefEtiketi.trim() || 'Hedef',
          oranYonu,
          oranBirimi,
          yuzdeOlcek,
          ozelAlanlar,
          oranPayKaynagi,
          ortalamaKaynagi,
          gerceklesenFormul,
          hedefFormul,
        }),
      })
      if (res.ok) {
        setAcik(false)
        onSaved()
      }
    } finally {
      setKaydediliyor(false)
    }
  }

  return (
    <Dialog open={acik} onOpenChange={setAcik}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-slate-900">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>KPI'yı Düzenle</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>KPI Adı</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <Label>Birim (opsiyonel)</Label>
            <Input value={unit} onChange={e => setUnit(e.target.value)} />
          </div>
          <div>
            <Label>Yön</Label>
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="higher_is_better">Yüksek değer iyi</SelectItem>
                <SelectItem value="lower_is_better">Düşük değer iyi</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Periyot</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Aylık</SelectItem>
                <SelectItem value="quarterly">Çeyreklik</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label>Gerçekleşen etiketi</Label>
              <Input value={gerceklesenEtiketi} onChange={e => setGerceklesenEtiketi(e.target.value)} />
            </div>
            <div className="flex-1">
              <Label>Hedef etiketi</Label>
              <Input value={hedefEtiketi} onChange={e => setHedefEtiketi(e.target.value)} />
            </div>
          </div>
          <FormulDuzenleyici formul={gerceklesenFormul} onChange={setGerceklesenFormul} tumKpiler={tumKpiler} />
          <FormulDuzenleyici formul={hedefFormul} onChange={setHedefFormul} tumKpiler={tumKpiler} />
          <div className="flex gap-3">
            <div className="flex-1">
              <Label>Oran yönü</Label>
              <Select value={oranYonu} onValueChange={setOranYonu}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="G_H">G/H (gerçekleşen ÷ hedef)</SelectItem>
                  <SelectItem value="H_G">H/G (hedef ÷ gerçekleşen)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Oran birimi</Label>
              <Select value={oranBirimi} onValueChange={setOranBirimi}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yuzde">Yüzde (%)</SelectItem>
                  <SelectItem value="kat">Kat (x)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {unit.trim() === '%' && (
            <div>
              <Label>Yüzde değerleri nasıl giriliyor</Label>
              <Select value={yuzdeOlcek} onValueChange={setYuzdeOlcek}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="oran">0-1 arası oran (0,64 = %64)</SelectItem>
                  <SelectItem value="dogrudan">Doğrudan yüzde (64 = %64)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <OzelAlanlarDuzenleyici
            alanlar={ozelAlanlar}
            onChange={setOzelAlanlar}
            oranPayKaynagi={oranPayKaynagi}
            onOranPayKaynagiChange={setOranPayKaynagi}
            ortalamaKaynagi={ortalamaKaynagi}
            onOrtalamaKaynagiChange={setOrtalamaKaynagi}
            tumKpiler={tumKpiler}
          />
        </div>
        <DialogFooter>
          <Button onClick={kaydet} disabled={kaydediliyor || !name.trim()} style={{ backgroundColor: NAVY }}>
            {kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface SorumluAday {
  id: string
  displayName: string
  positionTitle: string | null
}

function tarihGirdi(v: string | null): string {
  if (!v) return ''
  return v.slice(0, 10)
}

function AksiyonFormDialog({
  kpiId, mevcut, onSaved,
}: { kpiId: string; mevcut?: Aksiyon; onSaved: () => void }) {
  const duzenlemeModu = !!mevcut
  const [acik, setAcik] = useState(false)
  const [reason, setReason] = useState(mevcut?.reason ?? '')
  const [action, setAction] = useState(mevcut?.action ?? '')
  const [sorumluPersonelId, setSorumluPersonelId] = useState(mevcut?.sorumluPersonelId ?? '')
  const [startDate, setStartDate] = useState(tarihGirdi(mevcut?.startDate ?? null))
  const [endDate, setEndDate] = useState(tarihGirdi(mevcut?.endDate ?? null))
  const [completionPercent, setCompletionPercent] = useState(String(mevcut?.completionPercent ?? 0))
  const [adaylar, setAdaylar] = useState<SorumluAday[]>([])
  const [kaydediliyor, setKaydediliyor] = useState(false)

  useEffect(() => {
    if (!acik) return
    fetch(`/api/sandbox/melike/kpi/${kpiId}/aksiyon`)
      .then(res => res.json())
      .then(d => setAdaylar(d.sorumluAdaylari ?? []))
      .catch(() => setAdaylar([]))
  }, [acik, kpiId])

  async function kaydet() {
    if (!action.trim()) return
    setKaydediliyor(true)
    try {
      const url = duzenlemeModu
        ? `/api/sandbox/melike/kpi/${kpiId}/aksiyon/${mevcut!.id}`
        : `/api/sandbox/melike/kpi/${kpiId}/aksiyon`
      const res = await fetch(url, {
        method: duzenlemeModu ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          action,
          sorumluPersonelId: sorumluPersonelId || null,
          startDate: startDate || null,
          endDate: endDate || null,
          completionPercent: completionPercent === '' ? 0 : Number(completionPercent),
        }),
      })
      if (res.ok) {
        if (!duzenlemeModu) {
          setReason(''); setAction(''); setSorumluPersonelId(''); setStartDate(''); setEndDate(''); setCompletionPercent('0')
        }
        setAcik(false)
        onSaved()
      }
    } finally {
      setKaydediliyor(false)
    }
  }

  return (
    <Dialog open={acik} onOpenChange={setAcik}>
      <DialogTrigger asChild>
        {duzenlemeModu ? (
          <Button size="icon" variant="ghost" className="h-7 w-7">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm" variant="outline">
            <PlusCircle className="h-4 w-4 mr-2" />
            Aksiyon Ekle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{duzenlemeModu ? 'Aksiyonu Düzenle' : 'Yeni Aksiyon Ekle'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Neden (opsiyonel)</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Örn: Anket katılımı düşük" />
          </div>
          <div>
            <Label>Aksiyon</Label>
            <Input value={action} onChange={e => setAction(e.target.value)} placeholder="Yapılacak iş" />
          </div>
          <div>
            <Label>Sorumlu</Label>
            <Select value={sorumluPersonelId} onValueChange={setSorumluPersonelId}>
              <SelectTrigger><SelectValue placeholder="Kişi seç (departmandan)" /></SelectTrigger>
              <SelectContent>
                {adaylar.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">Bu departmanda kayıtlı kişi yok</div>
                ) : (
                  adaylar.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.displayName}{a.positionTitle ? ` — ${a.positionTitle}` : ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label>Başlangıç Tarihi</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="flex-1">
              <Label>Bitiş Tarihi</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Tamamlanma Yüzdesi</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={completionPercent}
              onChange={e => setCompletionPercent(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={kaydet} disabled={kaydediliyor || !action.trim()} style={{ backgroundColor: NAVY }}>
            {kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Hücre renklendirmesi için 3 kademeli: tam/üstünde tutturma yeşil, hedefe yakın
// (%90 ve üzeri başarı) sarı, daha uzak kırmızı — ikili yeşil/kırmızıda %96 gibi
// "neredeyse tutturulmuş" bir ay da kırmızı görünüyordu, bu daha gerçekçi.
const YAKIN_ESIK = 90 // % — bu ve üzeri "yakın" (sarı) sayılır, altı "kırmızı"

function basariSeviyesi(kpi: Kpi, target: number | null, actual: number | null): 'iyi' | 'yakin' | 'kotu' | null {
  if (target == null || actual == null || target === 0) return null
  const basariOrani = kpi.direction === 'lower_is_better' ? (target / actual) * 100 : (actual / target) * 100
  if (basariOrani >= 100) return 'iyi'
  if (basariOrani >= YAKIN_ESIK) return 'yakin'
  return 'kotu'
}

const SEVIYE_RENKLERI = {
  iyi: { bg: '#bbf7d0', fg: '#14532d' },
  yakin: { bg: '#fef3c7', fg: '#78350f' },
  kotu: { bg: '#fecaca', fg: '#7f1d1d' },
} as const

function sayiFormat(n: number | null): string {
  if (n == null) return ''
  // maximumFractionDigits: 2 iken 0,003 gibi küçük ama sıfır OLMAYAN bir hedef "0" olarak
  // görünüyordu — altındaki G/H Oran satırı ise ham (yuvarlanmamış) değeri kullandığı için
  // "hedef 0 görünüyor ama oran %1500" gibi kafa karıştırıcı bir tabloya yol açıyordu.
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 4 })
}

// Bazı birimler kelime yerine sembol olarak gösterilir (€186.655 gibi, sonuna değil önüne).
const PARA_SEMBOLLERI: Record<string, string> = {
  EURO: '€', EUR: '€', '€': '€',
  DOLAR: '$', USD: '$', '$': '$',
  TL: '₺', TRY: '₺', LİRA: '₺', LIRA: '₺', '₺': '₺',
}

// yuzdeDogrudanMi: KPI'nın yuzdeOlcek ayarı "dogrudan" ise true — bazı KPI'larda yüzde değeri
// 0-1 arası bir ORAN olarak değil, zaten 0-100 arası DOĞRUDAN giriliyor (ör. 99,18 = %99,18).
// Eskiden her zaman "0-1 oran" varsayılıp ×100 yapılıyordu — bu, doğrudan girilen KPI'larda
// %9918 gibi saçma rakamlar üretiyordu. Artık KPI başına seçilebiliyor (varsayılan: eski davranış).
function sayiFormatBirimli(n: number | null, unit?: string | null, yuzdeDogrudanMi = false): string {
  if (n == null) return ''
  if (!unit) return sayiFormat(n)
  if (unit.trim() === '%') return yuzdeDogrudanMi ? `${sayiFormat(n)}%` : `${sayiFormat(n * 100)}%`
  const normalize = unit.trim().toLocaleUpperCase('tr')
  const sembol = PARA_SEMBOLLERI[normalize]
  const s = sayiFormat(n)
  if (sembol) return `${sembol}${s}`
  return `${s} ${unit}`
}

// Sütun ve üstündeki çizgi aynı yılın aynı değerini taşıyor — tooltip'te iki kere
// yazmasın diye aynı dataKey'e sahip girdilerden sadece ilkini gösteriyoruz.
function GrafikTooltip({ active, payload, label, unit, yuzdeDogrudanMi }: {
  active?: boolean
  payload?: { dataKey?: string | number; name?: string; value?: number; color?: string }[]
  label?: string
  unit?: string | null
  yuzdeDogrudanMi?: boolean
}) {
  if (!active || !payload || payload.length === 0) return null
  const gorulen = new Set<string | number | undefined>()
  const satirlar = payload.filter(p => {
    if (gorulen.has(p.dataKey)) return false
    gorulen.add(p.dataKey)
    return true
  })
  return (
    <div className="bg-white border border-slate-200 rounded-md shadow-md p-2 text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {satirlar.map(p => (
        <div key={String(p.dataKey)} style={{ color: p.color }}>
          {p.name}: {sayiFormatBirimli(p.value ?? null, unit, yuzdeDogrudanMi)}
        </div>
      ))}
    </div>
  )
}

// KPI-NA: hücreye "n/a" (büyük/küçük harf, "/" opsiyonel) yazılırsa sayı yerine N/A işaretlenir —
// boş bırakmaktan (hiç girilmemiş) farklı, "bu ay bu KPI'ya uygulanamaz" anlamına gelir.
const NA_REGEX = /^n\/?a$/i

function DuzenlenebilirHucre({
  deger, naAktif = false, onKaydet, className, style, unit, oranGosterim, yuzdeDogrudanMi = false, saltOkuma = false,
}: {
  deger: number | null
  naAktif?: boolean
  onKaydet: (v: number | null, na: boolean) => void
  className?: string
  style?: React.CSSProperties
  unit?: string | null
  // Sadece Oran hücresi için: "yuzde" ise değer zaten "75" = %75 anlamında (100 ile ÇARPILMADAN
  // "%75" gösterilir); "kat" ise KPI'nın oranı yüzde değil çarpan/kat anlamına geliyorsa (ör.
  // hedefin 3 katı) aynı ham değer 100'e bölünüp "3 kat" olarak gösterilir — hesaba dokunmaz.
  oranGosterim?: 'yuzde' | 'kat'
  // KPI'nın yuzdeOlcek ayarı "dogrudan" ise true — unit="%" iken 100 ile çarpmadan gösterir.
  yuzdeDogrudanMi?: boolean
  // true ise hücre tıklanamaz/düzenlenemez — KPI-FORMUL: bu alan başka KPI'lardan otomatik
  // hesaplanıyorsa elle değiştirilemesin diye salt-okunur gösterilir (küçük "ƒ" işaretiyle).
  saltOkuma?: boolean
}) {
  const [duzenleniyor, setDuzenleniyor] = useState(false)
  // "kat" gösteriminde elle düzenlerken de 100'e bölünmüş (ör. "3") hâli gösterilir/yazılır —
  // kaydederken tekrar 100 ile çarpılıp oranın ham ölçeğine (0-100+) dönülür.
  const katOlcek = oranGosterim === 'kat'
  const gosterimDegeri = (d: number | null) => (katOlcek && d != null ? d / 100 : d)
  const [taslak, setTaslak] = useState(naAktif ? 'N/A' : deger == null ? '' : String(gosterimDegeri(deger)))

  useEffect(() => {
    setTaslak(naAktif ? 'N/A' : deger == null ? '' : String(gosterimDegeri(deger)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deger, naAktif])

  function bitir() {
    setDuzenleniyor(false)
    const metin = taslak.trim()
    if (NA_REGEX.test(metin)) {
      if (!naAktif) onKaydet(null, true)
      return
    }
    const girilen = metin === '' ? null : Number(metin.replace(',', '.'))
    const sayi = katOlcek && girilen != null ? girilen * 100 : girilen
    if ((sayi !== deger || naAktif) && !(sayi == null && deger == null && !naAktif)) {
      onKaydet(Number.isNaN(sayi) ? null : sayi, false)
    }
  }

  if (duzenleniyor) {
    return (
      <td className={className} style={style}>
        <input
          autoFocus
          className="w-16 text-center bg-white border border-blue-400 rounded outline-none"
          value={taslak}
          onChange={e => setTaslak(e.target.value)}
          onBlur={bitir}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        />
      </td>
    )
  }
  const icerik = naAktif
    ? 'N/A'
    : (oranGosterim === 'kat'
        ? (deger == null ? '' : `${sayiFormat(deger / 100)} kat`)
        : oranGosterim === 'yuzde'
          ? (deger == null ? '' : `%${sayiFormat(deger)}`)
          : sayiFormatBirimli(deger, unit, yuzdeDogrudanMi))
      || <span className="text-muted-foreground">·</span>

  if (saltOkuma) {
    return (
      <td className={className} style={{ ...style, opacity: 0.85 }} title="Formülden hesaplanıyor — elle değiştirilemez">
        {icerik} <span className="text-[9px] align-super opacity-60">ƒ</span>
      </td>
    )
  }

  return (
    <td
      className={`${className} cursor-pointer hover:ring-1 hover:ring-blue-300`}
      style={naAktif ? { ...style, opacity: 0.7, fontStyle: 'italic' } : style}
      onClick={() => setDuzenleniyor(true)}
      title={naAktif ? 'Uygulanamaz (N/A) — düzenlemek için tıkla' : undefined}
    >
      {icerik}
    </td>
  )
}

function KpiVeriTablosu({
  kpi, yillar, onChanged, aktifYil, onAktifYilChange,
}: { kpi: Kpi; yillar: number[]; onChanged: () => void; aktifYil: number | null; onAktifYilChange: (y: number) => void }) {
  const [ekstraYillar, setEkstraYillar] = useState<number[]>([])
  const [donemYilGirdi, setDonemYilGirdi] = useState('')
  const tumYillar = useMemo(
    () => Array.from(new Set([...yillar, ...ekstraYillar])).sort((a, b) => b - a),
    [yillar, ekstraYillar],
  )

  // Aktif dönem: aynı anda sadece İKİ yıl (aktif + bir önceki) karşılaştırılır,
  // geçmiş tüm yıllar alt alta gösterilmez — yukarıdaki düğmelerle dönem değiştirilir.
  // (aktifYil üst bileşende tutulur ki Aksiyonlar listesi de aynı döneme göre filtrelenebilsin.)
  useEffect(() => {
    if (aktifYil == null && tumYillar.length > 0) onAktifYilChange(tumYillar[0])
  }, [aktifYil, tumYillar, onAktifYilChange])
  const gosterilenYillar = aktifYil == null ? [] : [aktifYil, aktifYil - 1]

  // Oran satırının "G/H'nin G'si" etiketi — oranPayKaynagi 'actual' ise Gerçekleşen etiketi,
  // değilse seçili özel alanın etiketi (silinmişse Gerçekleşen'e düşer).
  const oranPayEtiketi = kpi.oranPayKaynagi === 'actual'
    ? kpi.gerceklesenEtiketi
    : kpi.ozelAlanlar.find(a => a.key === kpi.oranPayKaynagi)?.label ?? kpi.gerceklesenEtiketi

  // Ortalama sütunu: aylık verisi olan yıllar için KENDİSİ hesaplanır (elle
  // ayrı bir "ortalama ekle" adımına gerek yok); aylık kırılımı olmayan eski
  // yıllar (2020-2023 gibi) için elle girilen/Excel'den gelen değer kullanılır.
  // Ayrıca hangi yıllar "Dönem Karşılaştır" ile eklendiyse onlar için de otomatik
  // (başta boş/düzenlenebilir) bir Ort. sütunu açılır — ayrı bir ekleme adımı yok.
  const yillarIleOlcum = useMemo(() => new Set(kpi.measurements.filter(m => m.actual != null).map(m => m.year)), [kpi])
  const ortYillar = useMemo((): [number, number | null][] => {
    const hesap = new Map<number, number | null>(hesaplaOrtYillar(kpi))
    for (const y of tumYillar) if (!hesap.has(y)) hesap.set(y, null)
    return Array.from(hesap.entries()).sort(([a], [b]) => a - b)
  }, [kpi, tumYillar])
  const hedefOrtYillari = useMemo(() => yillikHedefOrtalamasi(kpi), [kpi])
  function ortRenk(yil: number, ort: number | null) {
    const seviye = basariSeviyesi(kpi, hedefOrtYillari.get(yil) ?? null, ort)
    return seviye ? SEVIYE_RENKLERI[seviye] : { bg: '#e0f2fe', fg: '#0c4a6e' }
  }

  async function ortalamaKaydet(yil: number, deger: number | null) {
    await fetch(`/api/sandbox/melike/kpi/${kpi.id}/ortalama`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: yil, average: deger }),
    })
    onChanged()
  }

  async function hucreKaydet(yil: number, ay: number, alan: 'target' | 'actual', deger: number | null, na: boolean) {
    const mevcut = kpi.measurements.find(m => m.year === yil && m.month === ay)
    const res = await fetch(`/api/sandbox/melike/kpi/${kpi.id}/olcum`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: yil,
        month: ay,
        target: alan === 'target' ? deger : mevcut?.target ?? null,
        actual: alan === 'actual' ? deger : mevcut?.actual ?? null,
        hedefNA: alan === 'target' ? na : mevcut?.hedefNA ?? false,
        gerceklesenNA: alan === 'actual' ? na : mevcut?.gerceklesenNA ?? false,
      }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? 'Kaydedilemedi')
      return
    }
    onChanged()
  }

  async function oranKaydet(yil: number, ay: number, manuelOran: number | null) {
    const mevcut = kpi.measurements.find(m => m.year === yil && m.month === ay)
    const res = await fetch(`/api/sandbox/melike/kpi/${kpi.id}/olcum`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: yil,
        month: ay,
        target: mevcut?.target ?? null,
        actual: mevcut?.actual ?? null,
        hedefNA: mevcut?.hedefNA ?? false,
        gerceklesenNA: mevcut?.gerceklesenNA ?? false,
        manuelOran,
      }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? 'Kaydedilemedi')
      return
    }
    onChanged()
  }

  async function ozelAlanKaydet(alanId: string, yil: number, ay: number, deger: number | null, na: boolean) {
    const res = await fetch(`/api/sandbox/melike/kpi/${kpi.id}/ozel-alan-deger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alanId, year: yil, month: ay, value: deger, naMi: na }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? 'Kaydedilemedi')
      return
    }
    onChanged()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div className="flex flex-wrap gap-1">
          {tumYillar.map(y => (
            <Button
              key={y}
              size="sm"
              variant={y === aktifYil ? 'default' : 'outline'}
              className="h-7 text-xs"
              style={y === aktifYil ? { backgroundColor: NAVY } : undefined}
              onClick={() => onAktifYilChange(y)}
            >
              {y} vs {y - 1}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            placeholder="Yıl"
            className="w-20 h-7 text-xs"
            value={donemYilGirdi}
            onChange={e => setDonemYilGirdi(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={!donemYilGirdi.trim()}
            onClick={() => {
              const yil = Number(donemYilGirdi)
              if (Number.isNaN(yil)) return
              if (!tumYillar.includes(yil)) setEkstraYillar(prev => [...prev, yil])
              onAktifYilChange(yil)
              setDonemYilGirdi('')
            }}
          >
            <PlusCircle className="h-3 w-3 mr-1" />
            Dönem Karşılaştır
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border border-slate-300">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left sticky left-0 z-10" style={{ backgroundColor: NAVY, color: 'white' }}></th>
              {ortYillar.map(([y]) => (
                <th key={y} className="p-2 text-center font-semibold whitespace-nowrap border-l border-white/20" style={{ backgroundColor: NAVY, color: 'white' }}>{y} Ort.</th>
              ))}
              {donemUzunEtiketleri(kpi).map(ad => (
                <th key={ad} className="p-2 text-center font-semibold whitespace-nowrap border-l border-white/20" style={{ backgroundColor: NAVY, color: 'white' }}>{ad}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gosterilenYillar.map((yil, yilIdx) => {
              const ilkYil = yilIdx === 0
              const aylikVeri = Array.from({ length: donemSayisi(kpi) }, (_, i) => {
                const m = kpi.measurements.find(x => x.year === yil && x.month === i + 1)
                const ozelDegerler: Record<string, { value: number | null; naMi: boolean }> = {}
                for (const alan of kpi.ozelAlanlar) {
                  const d = alan.degerler.find(x => x.year === yil && x.month === i + 1)
                  ozelDegerler[alan.key] = { value: d?.value ?? null, naMi: d?.naMi ?? false }
                }
                return {
                  target: m?.target ?? null,
                  actual: m?.actual ?? null,
                  hedefNA: m?.hedefNA ?? false,
                  gerceklesenNA: m?.gerceklesenNA ?? false,
                  manuelOran: m?.manuelOran ?? null,
                  ozelDegerler,
                }
              })
              return (
                <Fragment key={yil}>
                  <tr className="border-t-2 border-slate-400">
                    <td className="p-2 font-semibold whitespace-nowrap bg-slate-50 sticky left-0 border-r border-slate-300">{yil} · {kpi.gerceklesenEtiketi}</td>
                    {ilkYil
                      ? ortYillar.map(([y, ort]) =>
                          yillarIleOlcum.has(y) ? (
                            <td key={y} className="p-2 text-center font-medium border-l border-slate-200" style={{ backgroundColor: ortRenk(y, ort).bg, color: ortRenk(y, ort).fg }}>{sayiFormatBirimli(ort, kpi.unit, kpi.yuzdeOlcek === 'dogrudan')}</td>
                          ) : (
                            <DuzenlenebilirHucre
                              key={y}
                              deger={ort}
                              onKaydet={(d) => ortalamaKaydet(y, d)}
                              className="p-2 text-center font-medium border-l border-slate-200"
                              style={{ backgroundColor: ortRenk(y, ort).bg, color: ortRenk(y, ort).fg }}
                              unit={kpi.unit}
                              yuzdeDogrudanMi={kpi.yuzdeOlcek === 'dogrudan'}
                            />
                          ),
                        )
                      : ortYillar.map(([y]) => <td key={y} className="p-2 bg-slate-50 border-l border-slate-200" />)}
                    {aylikVeri.map((v, i) => {
                      const seviye = v.gerceklesenNA ? 'kotu' : basariSeviyesi(kpi, v.target, v.actual)
                      const renk = seviye ? SEVIYE_RENKLERI[seviye] : { bg: '#f8fafc', fg: '#475569' }
                      return (
                        <DuzenlenebilirHucre
                          key={i}
                          deger={v.actual}
                          naAktif={v.gerceklesenNA}
                          onKaydet={(d, na) => hucreKaydet(yil, i + 1, 'actual', d, na)}
                          className="p-2 text-center font-semibold border-l border-slate-200"
                          style={{ backgroundColor: renk.bg, color: renk.fg }}
                          unit={kpi.unit}
                          yuzdeDogrudanMi={kpi.yuzdeOlcek === 'dogrudan'}
                          saltOkuma={kpi.gerceklesenFormulMu}
                        />
                      )
                    })}
                  </tr>
                  {kpi.ozelAlanlar.map(alan => (
                    <tr key={alan.id}>
                      <td className="p-2 text-slate-600 font-medium whitespace-nowrap bg-slate-50 sticky left-0 border-r border-slate-300">{alan.label}</td>
                      {ortYillar.map(([y]) => <td key={y} className="p-2 bg-slate-50 border-l border-slate-200" />)}
                      {aylikVeri.map((v, i) => (
                        <DuzenlenebilirHucre
                          key={i}
                          deger={v.ozelDegerler[alan.key]?.value ?? null}
                          naAktif={v.ozelDegerler[alan.key]?.naMi ?? false}
                          onKaydet={(d, na) => ozelAlanKaydet(alan.id, yil, i + 1, d, na)}
                          className="p-2 text-center font-medium bg-indigo-50 text-indigo-900 border-l border-slate-200"
                          unit={kpi.unit}
                          yuzdeDogrudanMi={kpi.yuzdeOlcek === 'dogrudan'}
                          saltOkuma={alan.formulMu}
                        />
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td className="p-2 text-slate-600 font-medium whitespace-nowrap bg-slate-50 sticky left-0 border-r border-slate-300">{kpi.hedefEtiketi}</td>
                    {ortYillar.map(([y]) => <td key={y} className="p-2 bg-slate-50 border-l border-slate-200" />)}
                    {aylikVeri.map((v, i) => (
                      <DuzenlenebilirHucre
                        key={i}
                        deger={v.target}
                        naAktif={v.hedefNA}
                        onKaydet={(d, na) => hucreKaydet(yil, i + 1, 'target', d, na)}
                        className="p-2 text-center font-medium bg-slate-200 text-slate-800 border-l border-slate-300"
                        unit={kpi.unit}
                        yuzdeDogrudanMi={kpi.yuzdeOlcek === 'dogrudan'}
                        saltOkuma={kpi.hedefFormulMu}
                      />
                    ))}
                  </tr>
                  <tr className="border-b-2 border-slate-400">
                    <td className="p-2 text-slate-600 font-medium whitespace-nowrap bg-slate-50 sticky left-0 border-r border-slate-300">
                      {kpi.oranYonu === 'H_G' ? `${kpi.hedefEtiketi}/${oranPayEtiketi} Oran` : `${oranPayEtiketi}/${kpi.hedefEtiketi} Oran`}
                    </td>
                    {ortYillar.map(([y]) => <td key={y} className="p-2 bg-slate-50 border-l border-slate-200" />)}
                    {aylikVeri.map((v, i) => {
                      // Öncelik sırası: elle girilmiş oran (manuelOran) varsa o kullanılır — otomatik
                      // hesabı tamamen by-pass eder, absürt/bozuk veri durumlarını anında düzeltmek
                      // için. Yoksa N/A işaretliyse (hedef ya da "G/H'nin G'si") %0 yazılır. Yoksa normal
                      // G/H ya da H/G hesabı — payda (bölen) sıfırsa yine %0 (Infinity/NaN yerine).
                      // "G/H'nin G'si" — oranPayKaynagi 'actual' ise Gerçekleşen, değilse seçili özel alan.
                      const gEsdeger = kpi.oranPayKaynagi === 'actual' ? v.actual : v.ozelDegerler[kpi.oranPayKaynagi]?.value ?? null
                      const gEsdegerNA = kpi.oranPayKaynagi === 'actual' ? v.gerceklesenNA : v.ozelDegerler[kpi.oranPayKaynagi]?.naMi ?? false
                      const payda = (kpi.oranYonu === 'H_G' ? gEsdeger : v.target) as number | null
                      const oran = v.manuelOran != null
                        ? Math.round(v.manuelOran)
                        : v.hedefNA || gEsdegerNA
                          ? 0
                          : v.target == null || gEsdeger == null || payda == null
                            ? null
                            : payda === 0
                              ? 0
                              : Math.round((kpi.oranYonu === 'H_G' ? (v.target as number) / payda : (gEsdeger as number) / payda) * 100)
                      // Oran hücresinin rengi kurala (iyi/kötü) göre DEĞİL, sabit — ilerihub'ın
                      // kendi marka rengiyle (lacivert tonu), değere bakılmaksızın hep aynı.
                      return (
                        <DuzenlenebilirHucre
                          key={i}
                          deger={oran}
                          onKaydet={(d) => oranKaydet(yil, i + 1, d)}
                          className="p-2 text-center font-semibold border-l border-slate-200"
                          style={{ backgroundColor: '#EAF1F8', color: NAVY }}
                          oranGosterim={kpi.oranBirimi === 'kat' ? 'kat' : 'yuzde'}
                        />
                      )
                    })}
                  </tr>
              </Fragment>
            )
          })}
        </tbody>
      </table>
      </div>
    </div>
  )
}

const IK_ORG_UNIT_ID = 'cmrzg1kr600037jpe4ge6rxe0'

interface Departman {
  id: string
  name: string
}


export default function MelikeKpiPage() {
  const [departmanlar, setDepartmanlar] = useState<Departman[]>([])
  const [secilenDepartmanId, setSecilenDepartmanId] = useState<string>(IK_ORG_UNIT_ID)
  const [kpiler, setKpiler] = useState<Kpi[] | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [seciliId, setSeciliId] = useState<string | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    fetch('/api/sandbox/melike/kpi/departmanlar')
      .then(res => res.json())
      .then(d => setDepartmanlar(d.departmanlar ?? []))
      .catch(() => {})
  }, [])

  // KPI Özet sayfasından "şu departmana git" linkiyle gelindiyse onu seç
  useEffect(() => {
    const departman = searchParams.get('departman')
    if (departman) setSecilenDepartmanId(departman)
  }, [searchParams])

  function yukle() {
    fetch(`/api/sandbox/melike/kpi?orgUnitId=${secilenDepartmanId}`)
      .then(res => res.json())
      .then(d => {
        setKpiler(d.kpiler)
        const istenenKpi = searchParams.get('kpi')
        setSeciliId(prev => {
          if (istenenKpi && d.kpiler.some((k: Kpi) => k.id === istenenKpi)) return istenenKpi
          return prev && d.kpiler.some((k: Kpi) => k.id === prev) ? prev : d.kpiler[0]?.id ?? null
        })
      })
      .catch(() => setHata('Veri yüklenemedi'))
  }

  useEffect(() => {
    setKpiler(null)
    setSeciliId(null)
    yukle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secilenDepartmanId])

  const secili = useMemo(() => kpiler?.find(k => k.id === seciliId) ?? null, [kpiler, seciliId])

  const yillar = useMemo(() => {
    if (!secili) return []
    return Array.from(new Set(secili.measurements.map(m => m.year))).sort((a, b) => b - a)
  }, [secili])

  // Aksiyonlar listesinin de tablo ile aynı aktif döneme göre filtrelenebilmesi
  // için aktif yıl burada (üst bileşende) tutuluyor.
  const [aktifYil, setAktifYil] = useState<number | null>(null)
  useEffect(() => { setAktifYil(null) }, [secili?.id])
  const gosterilenYillar = aktifYil == null ? [] : [aktifYil, aktifYil - 1]
  const donemAksiyonlari = useMemo(() => {
    if (!secili) return []
    if (aktifYil == null) return secili.actions
    return secili.actions.filter(a => {
      if (!a.startDate) return true
      const yil = new Date(a.startDate).getFullYear()
      return gosterilenYillar.includes(yil)
    })
  }, [secili, aktifYil, gosterilenYillar])

// Tek grafik: solda geçmiş yılların ortalaması (Ort. sütunları), sağında
  // en güncel iki yılın ay-ay karşılaştırması (sütun) + hedef çizgisi — hepsi
  // aynı x ekseninde yan yana (Excel'deki orijinal grafik gibi).
  const birlesikGrafikVerisi = useMemo(() => {
    if (!secili) return { veri: [] as Record<string, string | number | null>[], yilA: null as number | null, yilB: null as number | null }
    const [yilA, yilB] = yillar // en yeni, bir öncesi
    const bul = (yil: number | undefined, ay: number) =>
      yil != null ? secili.measurements.find(m => m.year === yil && m.month === ay)?.actual ?? null : null
    const hedefBul = (ay: number) =>
      secili.measurements.find(m => m.year === yilA && m.month === ay)?.target ?? null

    const ortalamaSatirlari = hesaplaOrtYillar(secili)
      .filter(([, ort]) => ort != null)
      .map(([y, ort]) => ({ ad: `${y} Ort.`, Ortalama: ort as number }))
    const aySatirlari = donemKisaEtiketleri(secili).map((ad, i) => ({
      ad,
      [String(yilA)]: bul(yilA, i + 1),
      [String(yilB)]: bul(yilB, i + 1),
      Hedef: hedefBul(i + 1),
    }))
    return { veri: [...ortalamaSatirlari, ...aySatirlari], yilA: yilA ?? null, yilB: yilB ?? null }
  }, [secili, yillar])

  const guncelYilOrtalamasi = useMemo(() => {
    if (!secili || birlesikGrafikVerisi.yilA == null) return null
    return hesaplaOrtYillar(secili).find(([y]) => y === birlesikGrafikVerisi.yilA)?.[1] ?? null
  }, [secili, birlesikGrafikVerisi.yilA])

  const secilenDepartman = departmanlar.find(d => d.id === secilenDepartmanId)

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-xs text-muted-foreground">Departman</Label>
        <Select value={secilenDepartmanId} onValueChange={setSecilenDepartmanId}>
          <SelectTrigger className="w-full sm:w-80 mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {departmanlar.map(d => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
            <Target className="h-6 w-6 lg:h-7 lg:w-7" style={{ color: NAVY }} />
            {secilenDepartman?.name ?? '...'} — KPI
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Aylık hedef/gerçekleşen takibi ve aksiyon planı</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/sandbox/melike/kpi-ozet?departman=${secilenDepartmanId}`}>
            <Button size="sm" variant="outline">KPI Özet →</Button>
          </Link>
          <YeniKpiDialog orgUnitId={secilenDepartmanId} onCreated={yukle} />
        </div>
      </div>

      <ExcelIslemleri orgUnitId={secilenDepartmanId} onImported={yukle} />

      {hata ? (
        <p className="text-sm text-muted-foreground">{hata}</p>
      ) : !kpiler ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : kpiler.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Henüz KPI yok — &quot;Yeni KPI Ekle&quot; ile başla.
        </p>
      ) : (
        <>
          <Tabs value={seciliId ?? undefined} onValueChange={setSeciliId}>
            <TabsList className="flex-wrap h-auto gap-1 bg-muted/70 p-1">
              {kpiler.map(k => (
                <TabsTrigger key={k.id} value={k.id} className="text-sm">
                  {k.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {secili && (
            <>
              <Card>
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {secili.name}
                      <Badge variant="secondary" className="font-normal">
                        {secili.direction === 'lower_is_better' ? 'Düşük iyi' : 'Yüksek iyi'}
                      </Badge>
                      {secili.unit && <span className="text-xs font-normal text-muted-foreground">{secili.unit}</span>}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Solda geçmiş yılların ortalaması, sağda {birlesikGrafikVerisi.yilB ?? '—'} vs {birlesikGrafikVerisi.yilA ?? '—'} aylık karşılaştırma — tek grafikte
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <KpiDuzenleDialog kpi={secili} onSaved={yukle} />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>&quot;{secili.name}&quot; KPI&apos;sı silinsin mi?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Bu KPI'a ait tüm ölçümler, yıllık ortalamalar ve aksiyonlar birlikte silinir. Bu işlem geri alınamaz.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>İptal</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={async () => {
                              await fetch(`/api/sandbox/melike/kpi/${secili.id}`, { method: 'DELETE' })
                              setSeciliId(null)
                              yukle()
                            }}
                          >
                            Sil
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {birlesikGrafikVerisi.veri.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-10 text-center">Veri yok</p>
                  ) : (
                    <div className="relative">
                      {guncelYilOrtalamasi != null && birlesikGrafikVerisi.yilA != null && (
                        <div className="absolute top-0 right-0 text-right z-10">
                          <div className="text-[11px] text-muted-foreground">{birlesikGrafikVerisi.yilA} Ortalaması</div>
                          <div className="text-lg font-bold" style={{ color: NAVY }}>{sayiFormatBirimli(guncelYilOrtalamasi, secili.unit, secili.yuzdeOlcek === 'dogrudan')}</div>
                        </div>
                      )}
                      <ResponsiveContainer width="100%" height={320}>
                        <ComposedChart data={birlesikGrafikVerisi.veri} margin={{ left: 4, right: 8, top: 20, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="ad" tick={{ fontSize: 11, fill: '#9CA3AF' }} interval={0} angle={-20} textAnchor="end" height={50} />
                          <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                          <Tooltip content={<GrafikTooltip unit={secili.unit} yuzdeDogrudanMi={secili.yuzdeOlcek === 'dogrudan'} />} />
                          <Legend wrapperStyle={{ fontSize: 11, color: '#9CA3AF' }} />
                          <Bar dataKey="Ortalama" fill="#f0a875" radius={[3, 3, 0, 0]}>
                            <LabelList dataKey="Ortalama" position="top" style={{ fontSize: 10, fill: '#78350f' }} formatter={(v: number) => sayiFormatBirimli(v, secili.unit, secili.yuzdeOlcek === 'dogrudan')} />
                          </Bar>
                          {birlesikGrafikVerisi.yilB != null && (
                            <Bar dataKey={String(birlesikGrafikVerisi.yilB)} fill="#94a3b8" radius={[3, 3, 0, 0]}>
                              <LabelList dataKey={String(birlesikGrafikVerisi.yilB)} position="top" style={{ fontSize: 10, fill: '#475569' }} formatter={(v: number) => sayiFormatBirimli(v, secili.unit, secili.yuzdeOlcek === 'dogrudan')} />
                            </Bar>
                          )}
                          {birlesikGrafikVerisi.yilA != null && (
                            <Bar dataKey={String(birlesikGrafikVerisi.yilA)} fill={NAVY} radius={[3, 3, 0, 0]}>
                              <LabelList dataKey={String(birlesikGrafikVerisi.yilA)} position="top" style={{ fontSize: 10, fill: NAVY }} formatter={(v: number) => sayiFormatBirimli(v, secili.unit, secili.yuzdeOlcek === 'dogrudan')} />
                            </Bar>
                          )}
                          <Line type="monotone" dataKey="Hedef" stroke={KIRMIZI} strokeDasharray="4 4" dot={false} connectNulls />
                          {birlesikGrafikVerisi.yilB != null && (
                            <Line
                              type="monotone"
                              dataKey={String(birlesikGrafikVerisi.yilB)}
                              name={`${birlesikGrafikVerisi.yilB} Gerçekleşen (çizgi)`}
                              stroke="#64748b"
                              strokeWidth={2}
                              dot={{ r: 3 }}
                            />
                          )}
                          {birlesikGrafikVerisi.yilA != null && (
                            <Line
                              type="monotone"
                              dataKey={String(birlesikGrafikVerisi.yilA)}
                              name={`${birlesikGrafikVerisi.yilA} Gerçekleşen (çizgi)`}
                              stroke={YESIL}
                              strokeWidth={2}
                              dot={{ r: 3 }}
                            />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Hücreye tıklayıp değeri düzenleyebilirsin</p>
                    <KpiVeriTablosu
                      key={secili.id}
                      kpi={secili}
                      yillar={yillar}
                      onChanged={yukle}
                      aktifYil={aktifYil}
                      onAktifYilChange={setAktifYil}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Aksiyonlar</CardTitle>
                    {aktifYil != null && (
                      <p className="text-xs text-muted-foreground mt-0.5">{aktifYil} vs {aktifYil - 1} dönemine ait</p>
                    )}
                  </div>
                  <AksiyonFormDialog kpiId={secili.id} onSaved={yukle} />
                </CardHeader>
                <CardContent>
                  {donemAksiyonlari.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">Bu dönem için aksiyon kaydı yok</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-muted-foreground border-b">
                            <th className="pb-2 pr-4">Neden</th>
                            <th className="pb-2 pr-4">Aksiyon</th>
                            <th className="pb-2 pr-4">Sorumlu</th>
                            <th className="pb-2 pr-4">Başlangıç</th>
                            <th className="pb-2 pr-4">Bitiş</th>
                            <th className="pb-2 pr-4">Tamamlanma</th>
                            <th className="pb-2 pr-4 w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {donemAksiyonlari.map(a => (
                            <tr key={a.id} className="border-b last:border-0">
                              <td className="py-2 pr-4">{a.reason ?? '—'}</td>
                              <td className="py-2 pr-4">{a.action ?? '—'}</td>
                              <td className="py-2 pr-4">{a.responsibleName ?? '—'}</td>
                              <td className="py-2 pr-4">{a.startDate ? new Date(a.startDate).toLocaleDateString('tr-TR') : '—'}</td>
                              <td className="py-2 pr-4">{a.endDate ? new Date(a.endDate).toLocaleDateString('tr-TR') : '—'}</td>
                              <td className="py-2 pr-4">%{a.completionPercent ?? 0}</td>
                              <td className="py-2">
                                <AksiyonFormDialog kpiId={secili.id} mevcut={a} onSaved={yukle} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Boxes,
  Cloud,
  Cpu,
  Download,
  Eye,
  FileDown,
  Laptop,
  Mic,
  Package,
  Pencil,
  Plus,
  Printer,
  ScanLine,
  Send,
  Shapes,
  Smartphone,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getZimmetDurumRozeti } from '@/lib/zimmet/constants'
import { cokluAlandaAra } from '@/lib/zimmet/arama'
import { ZimmetDurumBadge } from '../ZimmetDurumBadge'
import { IslakImzaYukleDialog } from '../IslakImzaYukleDialog'

// ── Tipler ──────────────────────────────────────────────────────────────────

type ZimmetKisi = { name: string | null; email: string; employeeId?: string | null }

// Devir bildirimi aday satırı (GET /devir-bildirim-gonder çıktısı).
type DevirAday = {
  userId: string
  ad: string
  email: string
  kayitSayisi: number
  sonBildirimTarihi: string | null
}

type ZimmetItem = {
  id: string
  zimmetSahibi: ZimmetKisi
  altZimmetSahibi: string | null
  departman: string | null
  tur: string
  turDiger: string | null
  marka?: string | null
  model: string | null
  seriNumarasi: string | null
  aciklama: string | null
  ozellik: string | null
  macAdresi: string | null
  pcAdi: string | null
  imeiNumarasi: string | null
  verilisTarihi: string | null
  cihazDurumu: string
  durum: string
  redSebebi: string | null
  imzaModu: string | null
  zimmetSahibiImzaTarihi: string | null
  islakImzaDosyasi: string | null
  createdBy: ZimmetKisi
  createdAt: string
}

// ── Düzenleme formu ──────────────────────────────────────────────────────────

type DuzenleFormData = {
  seriNumarasi: string
  aciklama: string
  ozellik: string
  macAdresi: string
  pcAdi: string
  imeiNumarasi: string
  marka: string
  model: string
}

const BOS_DUZENLE_FORM: DuzenleFormData = {
  seriNumarasi: '',
  aciklama: '',
  ozellik: '',
  macAdresi: '',
  pcAdi: '',
  imeiNumarasi: '',
  marka: '',
  model: '',
}

// ── Sabitler ────────────────────────────────────────────────────────────────

const TUR_LABELS: Record<string, string> = {
  NOTEBOOK_BILGISAYAR: 'Notebook Bilgisayar',
  DESKTOP_BILGISAYAR: 'Desktop Bilgisayar',
  CEP_TELEFONU: 'Cep Telefonu',
  EL_TERMINALI: 'El Terminali',
  OFFICE_365: 'Office 365',
  YAZICI: 'Yazıcı',
  MONITOR: 'Monitör',
  MIKROFON: 'Mikrofon',
  DIGER: 'Diğer',
}

// Model doluysa "Tür / Model" formatında gosterilir (PENDING migration'dan once
// yazilmis eski kayitlarda model olmayabilir).
function turGosterim(zimmet: Pick<ZimmetItem, 'tur' | 'turDiger' | 'model'>): string {
  const tur = zimmet.tur === 'DIGER' && zimmet.turDiger ? zimmet.turDiger : (TUR_LABELS[zimmet.tur] ?? zimmet.tur)
  return zimmet.model ? `${tur} / ${zimmet.model}` : tur
}

const FILTRELER = [
  { key: 'tumu', label: 'Tümü' },
  { key: 'onay_bekliyor', label: 'Onay Bekliyor' },
  { key: 'onaylandi', label: 'Onaylandı' },
  { key: 'imza_bekleniyor', label: 'İmza Bekleniyor' },
  { key: 'belge_bekliyor', label: 'Belge Bekliyor' },
  { key: 'reddedildi', label: 'Reddedildi' },
] as const

type FiltreKey = (typeof FILTRELER)[number]['key']

// ── İstatistik kartları ──────────────────────────────────────────────────────
// Yazıcı/Monitör/Mikrofon artık schema.prisma'da gerçek enum değeri (bkz.
// PENDING migration), ama uygulanana kadar DB'de hâlâ DIGER + turDiger metni
// olarak duruyor - hem eski (turDiger sniff) hem yeni (dogrudan tur) kayıtları
// dogru saymak icin asagida ikisi de kontrol ediliyor.
type StatKey =
  | 'toplam'
  | 'NOTEBOOK_BILGISAYAR'
  | 'DESKTOP_BILGISAYAR'
  | 'CEP_TELEFONU'
  | 'EL_TERMINALI'
  | 'YAZICI'
  | 'LOGO'
  | 'MIKROFON'
  | 'OFFICE_365'
  | 'DIGER'

const STAT_KARTLARI: { key: StatKey; title: string; icon: typeof Package; color: string; bgColor: string }[] = [
  { key: 'toplam', title: 'Toplam Zimmet', icon: Package, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  { key: 'NOTEBOOK_BILGISAYAR', title: 'Notebook Bilgisayar', icon: Laptop, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  { key: 'DESKTOP_BILGISAYAR', title: 'Desktop Bilgisayar', icon: Cpu, color: 'text-violet-600', bgColor: 'bg-violet-100' },
  { key: 'CEP_TELEFONU', title: 'Cep Telefonu', icon: Smartphone, color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  { key: 'EL_TERMINALI', title: 'El Terminali', icon: ScanLine, color: 'text-sky-600', bgColor: 'bg-sky-100' },
  { key: 'YAZICI', title: 'Yazıcı', icon: Printer, color: 'text-amber-600', bgColor: 'bg-amber-100' },
  { key: 'LOGO', title: 'LOGO', icon: Boxes, color: 'text-cyan-600', bgColor: 'bg-cyan-100' },
  { key: 'MIKROFON', title: 'Mikrofon', icon: Mic, color: 'text-rose-600', bgColor: 'bg-rose-100' },
  { key: 'OFFICE_365', title: 'Office 365', icon: Cloud, color: 'text-teal-600', bgColor: 'bg-teal-100' },
  { key: 'DIGER', title: 'Diğer', icon: Shapes, color: 'text-slate-600', bgColor: 'bg-slate-100' },
]

// Bir zimmetin hangi istatistik/filtre kovasına düştüğünü belirler - hem
// hesaplaIstatistik hem de kart tıklamasıyla gelen tür filtresi (eslesirTurFiltresi)
// AYNI mantığı kullanır (tek yerden, duplike edilmeden).
// "LOGO" kovası diğerlerinden farklı: tam eşleşme değil, turDiger "logo" ile
// BAŞLIYORSA (LOGO Tiger3, LOGO Connect, LOGO Bordro Plus...) bu kovaya düşer.
function turKovasi(zimmet: Pick<ZimmetItem, 'tur' | 'turDiger'>): Exclude<StatKey, 'toplam'> {
  if (zimmet.tur === 'DIGER') {
    const td = (zimmet.turDiger ?? '').trim().toLocaleLowerCase('tr-TR')
    if (td === 'yazıcı' || td === 'yazici') return 'YAZICI'
    if (td === 'mikrofon') return 'MIKROFON'
    if (td.startsWith('logo')) return 'LOGO'
    return 'DIGER'
  }
  if (
    zimmet.tur === 'NOTEBOOK_BILGISAYAR' ||
    zimmet.tur === 'DESKTOP_BILGISAYAR' ||
    zimmet.tur === 'CEP_TELEFONU' ||
    zimmet.tur === 'EL_TERMINALI' ||
    zimmet.tur === 'OFFICE_365' ||
    zimmet.tur === 'YAZICI' ||
    zimmet.tur === 'MIKROFON'
  ) {
    return zimmet.tur
  }
  return 'DIGER'
}

function hesaplaIstatistik(zimmetler: ZimmetItem[]): Record<StatKey, number> {
  const sayac: Record<StatKey, number> = {
    toplam: zimmetler.length,
    NOTEBOOK_BILGISAYAR: 0,
    DESKTOP_BILGISAYAR: 0,
    CEP_TELEFONU: 0,
    EL_TERMINALI: 0,
    YAZICI: 0,
    LOGO: 0,
    MIKROFON: 0,
    OFFICE_365: 0,
    DIGER: 0,
  }
  for (const z of zimmetler) sayac[turKovasi(z)]++
  return sayac
}

// İstatistik kartına tıklayınca uygulanan tür filtresi - 'toplam' = filtre yok.
function eslesirTurFiltresi(z: ZimmetItem, turFiltresi: StatKey): boolean {
  if (turFiltresi === 'toplam') return true
  return turKovasi(z) === turFiltresi
}

// ── Arama (substring, tr-TR duyarlı) ────────────────────────────────────────
// Türkçe karakter katlamalı (ş→s, ğ→g vb.) ortak arama mantığı artık
// src/lib/sandbox/zimmet-arama.ts'te - PersonelCombobox ile aynı fonksiyonu
// kullanıyor, kod tekrarı yok.
function eslesirArama(z: ZimmetItem, aramaMetni: string): boolean {
  return cokluAlandaAra(
    [z.zimmetSahibi.name ?? z.zimmetSahibi.email, z.zimmetSahibi.employeeId, z.departman, z.seriNumarasi],
    aramaMetni
  )
}

// Sunucuya gönderilecek "durum" query param'ı — onaylandi/imza_bekleniyor/belge_bekliyor
// üçü de ONAYLANDI kayıtları çeker, aralarındaki ayrım client tarafında getZimmetDurumRozeti() ile yapılır.
function eslesirFiltre(z: ZimmetItem, filtre: FiltreKey): boolean {
  switch (filtre) {
    case 'tumu':
      return true
    case 'onay_bekliyor':
      return z.durum === 'ONAY_BEKLIYOR'
    case 'reddedildi':
      return z.durum === 'REDDEDILDI'
    case 'belge_bekliyor':
      return z.durum === 'ONAYLANDI' && getZimmetDurumRozeti(z).label === 'Belge Yüklenmesi Gerekmektedir'
    case 'imza_bekleniyor':
      return z.durum === 'ONAYLANDI' && getZimmetDurumRozeti(z).label === 'İmza Bekleniyor'
    case 'onaylandi':
      return z.durum === 'ONAYLANDI' && getZimmetDurumRozeti(z).label === 'Tamamlandı'
    default:
      return true
  }
}

// ── Sıralama ─────────────────────────────────────────────────────────────────

type SortField = 'seriNo' | 'zimmetSahibi' | 'tur' | 'departman' | 'verilisTarihi' | 'durum'

// Durum sıralaması alfabetik DEĞİL, iş akışı sırasına göre - rozet etiketleri
// (getZimmetDurumRozeti) üzerinden, çünkü tabloda gösterilen de bu etiketler
// (ham durum enum'u değil - ONAYLANDI kendi içinde Belge/İmza/Tamamlandı'ya ayrılıyor).
const DURUM_SIRA: Record<string, number> = {
  'Onay Bekliyor': 0,
  'Belge Yüklenmesi Gerekmektedir': 1,
  'İmza Bekleniyor': 2,
  'Tamamlandı': 3,
  'Reddedildi': 4,
}

function karsilastir(a: ZimmetItem, b: ZimmetItem, field: SortField): number {
  switch (field) {
    case 'seriNo':
      return (a.seriNumarasi ?? '').localeCompare(b.seriNumarasi ?? '', 'tr-TR')
    case 'zimmetSahibi': {
      const an = a.zimmetSahibi.name ?? a.zimmetSahibi.email
      const bn = b.zimmetSahibi.name ?? b.zimmetSahibi.email
      return an.localeCompare(bn, 'tr-TR')
    }
    case 'tur':
      return turGosterim(a).localeCompare(turGosterim(b), 'tr-TR')
    case 'departman':
      return (a.departman ?? '').localeCompare(b.departman ?? '', 'tr-TR')
    case 'verilisTarihi': {
      const at = a.verilisTarihi ? new Date(a.verilisTarihi).getTime() : 0
      const bt = b.verilisTarihi ? new Date(b.verilisTarihi).getTime() : 0
      return at - bt
    }
    case 'durum': {
      const as = DURUM_SIRA[getZimmetDurumRozeti(a).label] ?? 99
      const bs = DURUM_SIRA[getZimmetDurumRozeti(b).label] ?? 99
      return as - bs
    }
    default:
      return 0
  }
}

// ── Yardımcı bileşenler ──────────────────────────────────────────────────────

function Avatar({ name }: { name: string | null | undefined }) {
  const initials = (name ?? '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?'
  return (
    <div className="w-8 h-8 rounded-full bg-[#1B4F72] text-white text-xs font-semibold flex items-center justify-center shrink-0">
      {initials}
    </div>
  )
}

function fmtDate(d: string | null | undefined) {
  return d
    ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—'
}

// ── PDF / belge indirme ──────────────────────────────────────────────────────

async function indirlePdf(id: string, durum: string) {
  // ONAYLANDI → temiz PDF; ONAY_BEKLIYOR → taslak (filigranlı) PDF; REDDEDILDI →
  // endpoint zaten 403 döner, gereksiz istek atmadan burada engelle.
  if (durum === 'REDDEDILDI') {
    toast.error('Reddedilmiş kayıt yazdırılamaz')
    return
  }
  try {
    const res = await fetch(`/api/zimmet-formu/${id}/pdf?mod=dijital`)
    if (!res.ok) throw new Error('PDF indirilemedi')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `zimmet-${id.slice(0, 8)}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'PDF indirilemedi')
  }
}

// Onaya gönder: ONAY_BEKLIYOR kayıt için onaycıya bildirim (yeniden) tetikler.
// Durum değişmez; tekrar basılabilir (hatırlatma).
async function onayaGonder(id: string) {
  try {
    const res = await fetch(`/api/zimmet-formu/${id}/onaya-gonder`, { method: 'POST' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}) as { error?: string })
      throw new Error((data as { error?: string }).error || 'Onay bildirimi gönderilemedi')
    }
    toast.success('Onay bildirimi gönderildi')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Onay bildirimi gönderilemedi')
  }
}

async function indirBelge(id: string) {
  try {
    const res = await fetch(`/api/zimmet-formu/${id}/belge`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}) as { error?: string })
      throw new Error((data as { error?: string }).error || 'Belge indirilemedi')
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `zimmet-${id.slice(0, 8)}-belge`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Belge indirilemedi')
  }
}

// ── Ana bileşen ──────────────────────────────────────────────────────────────

// Reddedilenler sekmesi: red gerekçesini gösteren sade tablo. "Envantere al"
// butonu bilinçli olarak YOK (envanter entegrasyonu ayrı iş).
function ReddedilenlerTablosu({ rows }: { rows: ZimmetItem[] }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kişi / Cihaz</TableHead>
                <TableHead>Seri No</TableHead>
                <TableHead>Red Gerekçesi</TableHead>
                <TableHead>Tarih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                    Reddedilmiş kayıt yok
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((z) => (
                  <TableRow key={z.id}>
                    <TableCell>
                      <div className="font-medium text-slate-900">
                        {z.zimmetSahibi.name ?? z.zimmetSahibi.email ?? '—'}
                      </div>
                      <div className="text-xs text-slate-500">{turGosterim(z)}</div>
                    </TableCell>
                    <TableCell className="text-slate-600">{z.seriNumarasi ?? '—'}</TableCell>
                    <TableCell className="max-w-md whitespace-pre-wrap text-slate-600">
                      {z.redSebebi ?? '—'}
                    </TableCell>
                    <TableCell className="text-slate-600">{fmtDate(z.createdAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

export function ZimmetListesi() {
  const [filtre, setFiltre] = useState<FiltreKey>('tumu')
  const [turFiltresi, setTurFiltresi] = useState<StatKey>('toplam')
  const [aramaText, setAramaText] = useState('')
  const [aramaDebounced, setAramaDebounced] = useState('')
  const [zimmetler, setZimmetler] = useState<ZimmetItem[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [silinecekId, setSilinecekId] = useState<string | null>(null)
  const [siliniyor, setSiliniyor] = useState(false)
  const [duzenlenecek, setDuzenlenecek] = useState<ZimmetItem | null>(null)
  const [duzenleForm, setDuzenleForm] = useState<DuzenleFormData>(BOS_DUZENLE_FORM)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  // Devir bildirimi ekranı. devirAdaylar null = approve yetkisi yok → buton gizli.
  const [devirAdaylar, setDevirAdaylar] = useState<DevirAday[] | null>(null)
  const [devirDialogAcik, setDevirDialogAcik] = useState(false)
  const [devirSecili, setDevirSecili] = useState<Set<string>>(new Set())
  const [devirGonderiliyor, setDevirGonderiliyor] = useState(false)

  // Debounce 300ms
  useEffect(() => {
    const t = setTimeout(() => setAramaDebounced(aramaText), 300)
    return () => clearTimeout(t)
  }, [aramaText])

  // Durum/tür/arama filtreleri tamamen client tarafında uygulanıyor (bkz.
  // eslesirFiltre/eslesirTurFiltresi/eslesirArama) - liste bir kere çekilip
  // tamamı tutuluyor. Önceden arama sunucuya "ara" param'ıyla gidiyordu; bu
  // makinede /liste endpoint'i bazen 5-19 saniye gecikebiliyor (pm2 loglarında
  // doğrulandı, paylaşılan host/DB yükünden - kod hatası değil), bu da her
  // tuşta yeni bir yavaş istek tetikleyip aramayı "donmuş" gösteriyordu.
  // Client-side filtreleme bu gecikmeyi tamamen ortadan kaldırır.
  const fetchZimmetler = useCallback(() => {
    setYukleniyor(true)
    setHata(null)

    return fetch('/api/zimmet-formu/liste')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Liste yüklenemedi'))))
      .then((data: ZimmetItem[]) => setZimmetler(data))
      .catch((e: unknown) => setHata(e instanceof Error ? e.message : 'Bilinmeyen hata'))
      .finally(() => setYukleniyor(false))
  }, [])

  // Devir bildirimi: aday listesi. GET 403 (approve yetkisi yok) → null → buton gizli.
  const fetchDevirAdaylar = useCallback(() => {
    return fetch('/api/zimmet-formu/devir-bildirim-gonder')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: DevirAday[]) => setDevirAdaylar(data))
      .catch(() => setDevirAdaylar(null))
  }, [])

  useEffect(() => {
    fetchZimmetler()
    fetchDevirAdaylar()
  }, [fetchZimmetler, fetchDevirAdaylar])

  const devirTumunuSec = () => setDevirSecili(new Set((devirAdaylar ?? []).map((a) => a.userId)))
  const devirSecimiTemizle = () => setDevirSecili(new Set())
  const devirToggle = (id: string) =>
    setDevirSecili((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  async function devirGonder() {
    setDevirGonderiliyor(true)
    try {
      const res = await fetch('/api/zimmet-formu/devir-bildirim-gonder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: [...devirSecili] }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}) as { error?: string })
        throw new Error((d as { error?: string }).error || 'Bildirim gönderilemedi')
      }
      const d = (await res.json()) as { kisi: number; kayit: number }
      toast.success(`${d.kisi} kişiye bildirim gönderildi`)
      setDevirDialogAcik(false)
      setDevirSecili(new Set())
      fetchZimmetler()
      fetchDevirAdaylar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bildirim gönderilemedi')
    } finally {
      setDevirGonderiliyor(false)
    }
  }

  const istatistik = useMemo(() => hesaplaIstatistik(zimmetler), [zimmetler])

  const zimmetlerGorunen = useMemo(() => {
    const filtreli = zimmetler.filter(
      (z) =>
        eslesirFiltre(z, filtre) &&
        eslesirTurFiltresi(z, turFiltresi) &&
        eslesirArama(z, aramaDebounced)
    )
    if (!sortField) return filtreli
    const sirali = [...filtreli].sort((a, b) => karsilastir(a, b, sortField))
    return sortDirection === 'asc' ? sirali : sirali.reverse()
  }, [zimmetler, filtre, turFiltresi, aramaDebounced, sortField, sortDirection])

  // Karta tekrar tıklayınca (toggle) veya "Toplam Zimmet"e tıklayınca filtre temizlenir.
  function handleTurFiltresiClick(key: StatKey) {
    setTurFiltresi((prev) => (key === 'toplam' || prev === key ? 'toplam' : key))
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5" />
    )
  }

  function handleExcelExport() {
    setExporting(true)
    window.open('/api/zimmet-formu/export-excel', '_blank')
    setTimeout(() => setExporting(false), 2000)
  }

  // Yalnızca ONAY_BEKLIYOR durumundaki hatalı kayıtlar silinebilir - bkz.
  // [id]/route.ts DELETE (durum kontrolü sunucu tarafında da tekrarlanıyor).
  async function handleSil() {
    if (!silinecekId) return
    setSiliniyor(true)
    try {
      const res = await fetch(`/api/zimmet-formu/${silinecekId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string })
        throw new Error((data as { error?: string }).error || 'Kayıt silinemedi')
      }
      toast.success('Kayıt silindi')
      setSilinecekId(null)
      await fetchZimmetler()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kayıt silinemedi')
    } finally {
      setSiliniyor(false)
    }
  }

  // Kayıt hangi durumda olursa olsun düzenlenebilir, durum değişmez - bkz.
  // [id]/route.ts PATCH.
  function acDuzenle(z: ZimmetItem) {
    setDuzenlenecek(z)
    setDuzenleForm({
      seriNumarasi: z.seriNumarasi ?? '',
      aciklama: z.aciklama ?? '',
      ozellik: z.ozellik ?? '',
      macAdresi: z.macAdresi ?? '',
      pcAdi: z.pcAdi ?? '',
      imeiNumarasi: z.imeiNumarasi ?? '',
      marka: z.marka ?? '',
      model: z.model ?? '',
    })
  }

  function setDuzenleAlan<K extends keyof DuzenleFormData>(alan: K, deger: DuzenleFormData[K]) {
    setDuzenleForm((prev) => ({ ...prev, [alan]: deger }))
  }

  async function handleDuzenleKaydet() {
    if (!duzenlenecek) return
    setKaydediliyor(true)
    try {
      const res = await fetch(`/api/zimmet-formu/${duzenlenecek.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duzenleForm),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string })
        throw new Error((data as { error?: string }).error || 'Kayıt güncellenemedi')
      }
      toast.success('Kayıt güncellendi')
      setDuzenlenecek(null)
      await fetchZimmetler()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kayıt güncellenemedi')
    } finally {
      setKaydediliyor(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-24 space-y-5">
        {/* Başlık */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-medium text-slate-900">Zimmet geçmişi</h1>
          <div className="flex items-center gap-2 flex-wrap">
            {devirAdaylar && devirAdaylar.length > 0 && (
              <button
                type="button"
                onClick={() => setDevirDialogAcik(true)}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100"
              >
                <Send className="h-4 w-4 shrink-0" />
                Devir bildirimi gönder
              </button>
            )}
            <button
              type="button"
              onClick={handleExcelExport}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4 shrink-0" />
              {exporting ? 'İndiriliyor…' : "Excel'e aktar"}
            </button>
            <Link
              href="/zimmet-formu"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-[#1B4F72] px-4 py-2 text-sm font-medium text-white hover:bg-[#1B4F72]/90"
            >
              <Plus className="h-4 w-4 shrink-0" />
              Yeni zimmet
            </Link>
          </div>
        </div>

        {/* İstatistik kartları */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {STAT_KARTLARI.map((stat) => {
            const Icon = stat.icon
            const aktif = turFiltresi === stat.key
            return (
              <Card
                key={stat.key}
                onClick={() => handleTurFiltresiClick(stat.key)}
                title={aktif ? 'Filtreyi kaldır' : `${stat.title} olarak filtrele`}
                className={`shadow-none cursor-pointer transition-all hover:shadow-md ${
                  aktif ? 'border-2 border-[#1B4F72] ring-2 ring-[#1B4F72]/20' : ''
                }`}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`rounded-md p-1.5 ${stat.bgColor}`}>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-500 truncate">{stat.title}</p>
                    <p className="text-lg font-semibold text-slate-900 leading-tight">
                      {istatistik[stat.key]}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Arama */}
        <Input
          placeholder="Zimmet sahibi adı, departmanı, sicil no veya seri no ara..."
          value={aramaText}
          onChange={(e) => setAramaText(e.target.value)}
        />

        {/* Durum filtresi */}
        <div className="flex flex-wrap gap-2">
          {FILTRELER.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setFiltre(s.key)}
              className={
                filtre === s.key
                  ? 'px-3 py-1.5 text-sm rounded-md font-medium bg-[#1B4F72] text-white'
                  : 'px-3 py-1.5 text-sm rounded-md font-medium border border-slate-300 text-slate-600 hover:bg-slate-100'
              }
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Hata */}
        {hata && <p className="text-sm text-rose-600">{hata}</p>}

        {/* Tablo */}
        {filtre === 'reddedildi' ? (
          <ReddedilenlerTablosu rows={zimmetlerGorunen} />
        ) : (
        <Card>
          <CardContent className="p-0">
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer select-none hover:bg-accent"
                      onClick={() => handleSort('seriNo')}
                    >
                      <div className="flex items-center gap-1">
                        Seri No
                        <SortIcon field="seriNo" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:bg-accent"
                      onClick={() => handleSort('zimmetSahibi')}
                    >
                      <div className="flex items-center gap-1">
                        Zimmet Sahibi
                        <SortIcon field="zimmetSahibi" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:bg-accent"
                      onClick={() => handleSort('tur')}
                    >
                      <div className="flex items-center gap-1">
                        Tür / Model
                        <SortIcon field="tur" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:bg-accent"
                      onClick={() => handleSort('departman')}
                    >
                      <div className="flex items-center gap-1">
                        Departman
                        <SortIcon field="departman" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:bg-accent"
                      onClick={() => handleSort('verilisTarihi')}
                    >
                      <div className="flex items-center gap-1">
                        Teslim Tarihi
                        <SortIcon field="verilisTarihi" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none hover:bg-accent"
                      onClick={() => handleSort('durum')}
                    >
                      <div className="flex items-center gap-1">
                        Durum
                        <SortIcon field="durum" />
                      </div>
                    </TableHead>
                    <TableHead>Ekler</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {yukleniyor && (
                    [...Array(4)].map((_, i) => (
                      <TableRow key={i}>
                        {[...Array(8)].map((__, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-5 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                  {!yukleniyor && zimmetlerGorunen.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                        Henüz zimmet kaydı yok
                      </TableCell>
                    </TableRow>
                  )}
                  {!yukleniyor &&
                    zimmetlerGorunen.map((z) => {
                      const rozet = getZimmetDurumRozeti(z)
                      return (
                        <TableRow key={z.id}>
                          <TableCell className="font-mono text-xs text-slate-600">
                            {z.seriNumarasi ?? '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar name={z.zimmetSahibi.name} />
                              <div className="min-w-0">
                                <span className="block truncate font-medium text-slate-900">
                                  {z.zimmetSahibi.name ?? z.zimmetSahibi.email}
                                </span>
                                {z.zimmetSahibi.employeeId && (
                                  <span className="block text-xs text-slate-400">
                                    Sicil: {z.zimmetSahibi.employeeId}
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-600">{turGosterim(z)}</TableCell>
                          <TableCell className="text-slate-600">{z.departman ?? '—'}</TableCell>
                          <TableCell className="text-slate-600">{fmtDate(z.verilisTarihi)}</TableCell>
                          <TableCell>
                            <ZimmetDurumBadge zimmet={z} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {rozet.label === 'Belge Yüklenmesi Gerekmektedir' && (
                                <IslakImzaYukleDialog zimmetId={z.id} onUploaded={fetchZimmetler} />
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title={z.durum === 'ONAY_BEKLIYOR' ? 'Taslak PDF indir' : 'PDF indir'}
                                onClick={() => indirlePdf(z.id, z.durum)}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              {z.imzaModu === 'ISLAK' && z.islakImzaDosyasi && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  title="Islak imza belgesini indir"
                                  onClick={() => indirBelge(z.id)}
                                >
                                  <FileDown className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/zimmet-formu/${z.id}/onayla`}>
                                  <Eye className="h-4 w-4 mr-1" />
                                  Detay
                                </Link>
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="Kaydı düzenle"
                                onClick={() => acDuzenle(z)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {z.durum === 'ONAY_BEKLIYOR' && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  title="Onaya gönder (bildirim)"
                                  className="text-sky-600 hover:text-sky-700 hover:bg-sky-50"
                                  onClick={() => onayaGonder(z.id)}
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              )}
                              {z.durum === 'ONAY_BEKLIYOR' && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  title="Kaydı sil"
                                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                  onClick={() => setSilinecekId(z.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        )}
      </div>

      <AlertDialog open={silinecekId !== null} onOpenChange={(open) => !open && setSilinecekId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bu kaydı silmek istediğinize eminmisiniz?</AlertDialogTitle>
            <AlertDialogDescription>
              Örn. yanlış seri numarası gibi bir hata için. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={siliniyor}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSil}
              disabled={siliniyor}
              className={buttonVariants({ variant: 'destructive' })}
            >
              {siliniyor ? 'Siliniyor…' : 'Sil'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Devir bildirimi gönderme dialog'u */}
      <Dialog open={devirDialogAcik} onOpenChange={(o) => { if (!o) setDevirDialogAcik(false) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Devir bildirimi gönder</DialogTitle>
            <DialogDescription>
              {(devirAdaylar?.length ?? 0)} kişiye,{' '}
              {(devirAdaylar ?? []).reduce((t, a) => t + a.kayitSayisi, 0)} kayıt için bildirim
              gönderilebilir. Kişi başına tek e-posta ve tek bildirim gider.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={devirTumunuSec}>
              Tümünü seç
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={devirSecimiTemizle}>
              Seçimi temizle
            </Button>
          </div>

          <div className="max-h-[50vh] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Ad</TableHead>
                  <TableHead>Kayıt sayısı</TableHead>
                  <TableHead>Son bildirim</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(devirAdaylar ?? []).map((a) => (
                  <TableRow
                    key={a.userId}
                    className="cursor-pointer"
                    onClick={() => devirToggle(a.userId)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={devirSecili.has(a.userId)}
                        onCheckedChange={() => devirToggle(a.userId)}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">{a.ad}</TableCell>
                    <TableCell className="text-slate-600">{a.kayitSayisi}</TableCell>
                    <TableCell className="text-slate-600">
                      {a.sonBildirimTarihi ? fmtDate(a.sonBildirimTarihi) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDevirDialogAcik(false)}
              disabled={devirGonderiliyor}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              onClick={devirGonder}
              disabled={devirSecili.size === 0 || devirGonderiliyor}
            >
              {devirGonderiliyor ? 'Gönderiliyor…' : `Seçilenlere gönder (${devirSecili.size} kişi)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={duzenlenecek !== null} onOpenChange={(open) => !open && setDuzenlenecek(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Zimmet Kaydını Düzenle</DialogTitle>
            <DialogDescription>
              Kayıt hangi durumda olursa olsun düzenlenebilir, durumu değişmez. Kaydettiğinizde aynı kayıt güncellenir, yeni bir kayıt oluşmaz.
            </DialogDescription>
          </DialogHeader>
          {duzenlenecek && (
            <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
              Zimmet Sahibi: <span className="font-medium text-slate-900">{duzenlenecek.zimmetSahibi.name ?? duzenlenecek.zimmetSahibi.email}</span>
              {duzenlenecek.zimmetSahibi.employeeId && ` (Sicil: ${duzenlenecek.zimmetSahibi.employeeId})`}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="duzenle-seriNo">Seri Numarası</Label>
              <Input
                id="duzenle-seriNo"
                value={duzenleForm.seriNumarasi}
                onChange={(e) => setDuzenleAlan('seriNumarasi', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="duzenle-marka">Marka</Label>
              <Input
                id="duzenle-marka"
                value={duzenleForm.marka}
                onChange={(e) => setDuzenleAlan('marka', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="duzenle-model">Model</Label>
              <Input
                id="duzenle-model"
                value={duzenleForm.model}
                onChange={(e) => setDuzenleAlan('model', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="duzenle-mac">MAC Adresi</Label>
              <Input
                id="duzenle-mac"
                value={duzenleForm.macAdresi}
                onChange={(e) => setDuzenleAlan('macAdresi', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="duzenle-pcAdi">PC Adı</Label>
              <Input
                id="duzenle-pcAdi"
                value={duzenleForm.pcAdi}
                onChange={(e) => setDuzenleAlan('pcAdi', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="duzenle-imei">IMEI Numarası</Label>
              <Input
                id="duzenle-imei"
                value={duzenleForm.imeiNumarasi}
                onChange={(e) => setDuzenleAlan('imeiNumarasi', e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="duzenle-ozellik">Özellik</Label>
              <Input
                id="duzenle-ozellik"
                value={duzenleForm.ozellik}
                onChange={(e) => setDuzenleAlan('ozellik', e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="duzenle-aciklama">Açıklama</Label>
              <Textarea
                id="duzenle-aciklama"
                rows={3}
                value={duzenleForm.aciklama}
                onChange={(e) => setDuzenleAlan('aciklama', e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDuzenlenecek(null)} disabled={kaydediliyor}>
              Vazgeç
            </Button>
            <Button
              type="button"
              className="bg-[#1B4F72] hover:bg-[#1B4F72]/90"
              onClick={handleDuzenleKaydet}
              disabled={kaydediliyor}
            >
              {kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

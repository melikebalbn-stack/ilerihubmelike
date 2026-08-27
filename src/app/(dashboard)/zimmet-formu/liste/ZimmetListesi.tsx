'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Cpu,
  Download,
  Eye,
  FileDown,
  Laptop,
  Package,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  ScanLine,
  Send,
  Shapes,
  Smartphone,
  Trash2,
  Upload,
  UserPlus,
  X,
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { getZimmetDurumRozeti, zimmetSahibiBaslik, zimmetSahibiAltBaslik } from '@/lib/zimmet/constants'
import { cokluAlandaAra } from '@/lib/zimmet/arama'
import { temizleAciklama } from '@/lib/zimmet/aciklama'
import { EK_ALAN_KATALOG, varsayilanEkAlanlar, type EkAlanKey } from '@/lib/zimmet/ek-alanlar'
import { zorunluAlanlar, zimmetEksikAlanlar } from '@/lib/zimmet/zorunlu-alanlar'
import {
  zimmetTurGosterim,
  ZIMMET_YAZILIM_SECENEKLERI,
  yazilimSecimindenTuret,
  type ZimmetYazilimSecenegi,
} from '@/lib/zimmet/tur'
import { ZimmetDurumBadge } from '../ZimmetDurumBadge'
import { IslakImzaYukleDialog } from '../IslakImzaYukleDialog'
import { PersonelCombobox } from '../PersonelCombobox'
import type { PersonelHit } from '../useZimmetFormu'

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
  zimmetSahibiId: string
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
  iadeTarihi: string | null
  iadeAlanId: string | null
  durum: string
  kaynak: string
  redSebebi: string | null
  imzaModu: string | null
  zimmetSahibiImzaTarihi: string | null
  islakImzaDosyasi: string | null
  createdBy: ZimmetKisi
  createdAt: string
}

// ── Düzenleme formu ──────────────────────────────────────────────────────────

function RequiredMark() {
  return <span className="text-rose-500">*</span>
}

type DuzenleFormData = {
  zimmetSahibiId: string
  seriNumarasi: string
  aciklama: string
  ozellik: string
  macAdresi: string
  pcAdi: string
  imeiNumarasi: string
  marka: string
  model: string
  turDiger: string
}

const BOS_DUZENLE_FORM: DuzenleFormData = {
  zimmetSahibiId: '',
  seriNumarasi: '',
  aciklama: '',
  ozellik: '',
  macAdresi: '',
  pcAdi: '',
  imeiNumarasi: '',
  marka: '',
  model: '',
  turDiger: '',
}

// ── Sabitler ────────────────────────────────────────────────────────────────

// Model doluysa "Tür / Model" formatında gosterilir (PENDING migration'dan once
// yazilmis eski kayitlarda model olmayabilir). Tür etiketi src/lib/zimmet/tur.ts'ten
// (zimmetTurGosterim) - Office 365/Diğer artık "Yazılım" olarak birleşik gösteriliyor.
function turGosterim(zimmet: Pick<ZimmetItem, 'tur' | 'turDiger' | 'model'>): string {
  const tur = zimmetTurGosterim(zimmet)
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
// LOGO/Office 365/Mikrofon ayrı kart olarak kaldırıldı - bu türlerin kayıtları
// artık "Yazılım" (eski "Diğer") kovasında sayılıyor, mükerrer sayım yok
// (turKovasi TEK kovaya düşürür, toplam değişmez).
// "IT Envanteri" kartı (REDDEDILDI kayıtları sayan) KALDIRILDI - Melih'in
// "Envanterde" kartı (cihazDurumu=PASIF, durum özeti bandı) zaten fiziksel
// envanter kavramını karşılıyor; reddedilen kayıt bunun onay-akışı boyutu,
// ayrı bir kart gerektirmiyor. Reddedilenler zaten "Reddedildi" filtre
// sekmesinde ve satırdaki "IT Envanterinde" etiketinde ayrışıyor.
type StatKey =
  | 'toplam'
  | 'NOTEBOOK_BILGISAYAR'
  | 'DESKTOP_BILGISAYAR'
  | 'CEP_TELEFONU'
  | 'EL_TERMINALI'
  | 'YAZICI'
  | 'DIGER'

const STAT_KARTLARI: { key: StatKey; title: string; icon: typeof Package; color: string; bgColor: string }[] = [
  { key: 'toplam', title: 'Toplam Zimmet', icon: Package, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  { key: 'NOTEBOOK_BILGISAYAR', title: 'Notebook Bilgisayar', icon: Laptop, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  { key: 'DESKTOP_BILGISAYAR', title: 'Desktop Bilgisayar', icon: Cpu, color: 'text-violet-600', bgColor: 'bg-violet-100' },
  { key: 'CEP_TELEFONU', title: 'Cep Telefonu', icon: Smartphone, color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  { key: 'EL_TERMINALI', title: 'El Terminali', icon: ScanLine, color: 'text-sky-600', bgColor: 'bg-sky-100' },
  { key: 'YAZICI', title: 'Yazıcı', icon: Printer, color: 'text-amber-600', bgColor: 'bg-amber-100' },
  { key: 'DIGER', title: 'Yazılım', icon: Shapes, color: 'text-slate-600', bgColor: 'bg-slate-100' },
]

// Bir zimmetin hangi istatistik/filtre kovasına düştüğünü belirler - hem
// hesaplaIstatistik hem de kart tıklamasıyla gelen tür filtresi (eslesirTurFiltresi)
// AYNI mantığı kullanır (tek yerden, duplike edilmeden). SADECE cihaz türüne
// bakar - onay durumuna (durum) bakmaz, Melih'in kendi tür-sayım mantığıyla
// tutarlı (reddedilmiş bir Notebook yine "Notebook Bilgisayar" kartında sayılır).
// LOGO/Mikrofon/Office 365 kartları kaldırıldığı için bu türler (gerçek enum
// OFFICE_365/MIKROFON dahil, turDiger serbest metniyle "logo"/"mikrofon"
// yazılanlar dahil) artık DIGER ("Yazılım") kovasına düşüyor.
function turKovasi(zimmet: Pick<ZimmetItem, 'tur' | 'turDiger'>): Exclude<StatKey, 'toplam'> {
  if (zimmet.tur === 'DIGER') {
    const td = (zimmet.turDiger ?? '').trim().toLocaleLowerCase('tr-TR')
    if (td === 'yazıcı' || td === 'yazici') return 'YAZICI'
    return 'DIGER'
  }
  if (
    zimmet.tur === 'NOTEBOOK_BILGISAYAR' ||
    zimmet.tur === 'DESKTOP_BILGISAYAR' ||
    zimmet.tur === 'CEP_TELEFONU' ||
    zimmet.tur === 'EL_TERMINALI' ||
    zimmet.tur === 'YAZICI'
  ) {
    return zimmet.tur
  }
  // OFFICE_365, MIKROFON, MONITOR ve diğer tüm enum değerleri → Yazılım.
  return 'DIGER'
}

function hesaplaIstatistik(zimmetler: ZimmetItem[]): Record<StatKey, number> {
  // Tür kırılımı yalnız GÜNCEL zimmetleri sayar (iade edilenler hariç).
  const guncel = zimmetler.filter((z) => z.iadeTarihi === null)
  const sayac: Record<StatKey, number> = {
    toplam: guncel.length,
    NOTEBOOK_BILGISAYAR: 0,
    DESKTOP_BILGISAYAR: 0,
    CEP_TELEFONU: 0,
    EL_TERMINALI: 0,
    YAZICI: 0,
    DIGER: 0,
  }
  for (const z of guncel) sayac[turKovasi(z)]++
  return sayac
}

// Durum özeti bandı (Zimmetli/Envanterde/Hurda/Geçmiş) için filtre - tür
// filtresinden (turFiltresi) VE onay-durum filtresinden (filtre) BAĞIMSIZ,
// üçü birlikte AND'lenir (ör. "Notebook" + "Envanterde" aynı anda seçilebilir).
type DurumOzetiFiltresi = 'zimmetli' | 'envanterde' | 'hurda' | 'gecmis' | null

function eslesirDurumOzeti(z: ZimmetItem, key: DurumOzetiFiltresi): boolean {
  switch (key) {
    case null:
      return true
    case 'zimmetli':
      return z.iadeTarihi === null && z.cihazDurumu === 'AKTIF'
    case 'envanterde':
      return z.cihazDurumu === 'PASIF'
    case 'hurda':
      return z.cihazDurumu === 'HURDA'
    case 'gecmis':
      return z.iadeTarihi !== null
  }
}

// Durum özeti (üst bant): iade akışına göre kova sayıları.
function hesaplaDurumOzeti(zimmetler: ZimmetItem[]) {
  return {
    zimmetli: zimmetler.filter((z) => z.iadeTarihi === null && z.cihazDurumu === 'AKTIF').length,
    envanterde: zimmetler.filter((z) => z.cihazDurumu === 'PASIF').length,
    hurda: zimmetler.filter((z) => z.cihazDurumu === 'HURDA').length,
    gecmis: zimmetler.filter((z) => z.iadeTarihi !== null).length,
  }
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

// Reddedilenler sekmesi: red gerekçesini gösteren sade tablo + yanlışlıkla
// reddedilen bir kaydı tekrar onaya gönderme aksiyonu. "Envantere al" butonu
// bilinçli olarak YOK (envanter entegrasyonu ayrı iş, bkz. madde 7 araştırması).
function ReddedilenlerTablosu({
  rows,
  onTekrarOnayaGonder,
}: {
  rows: ZimmetItem[]
  onTekrarOnayaGonder: (id: string) => void
}) {
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
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                    Reddedilmiş kayıt yok
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((z) => (
                  <TableRow key={z.id}>
                    <TableCell>
                      <div className="font-medium text-slate-500 italic">{zimmetSahibiBaslik(z)}</div>
                      <div className="text-xs text-slate-400">{zimmetSahibiAltBaslik(z)}</div>
                      <div className="text-xs text-slate-500">{turGosterim(z)}</div>
                    </TableCell>
                    <TableCell className="text-slate-600">{z.seriNumarasi ?? '—'}</TableCell>
                    <TableCell className="max-w-md whitespace-pre-wrap text-slate-600">
                      {z.redSebebi ?? '—'}
                    </TableCell>
                    <TableCell className="text-slate-600">{fmtDate(z.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onTekrarOnayaGonder(z.id)}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                        Tekrar onaya gönder
                      </Button>
                    </TableCell>
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
  const [durumOzetiFiltresi, setDurumOzetiFiltresi] = useState<DurumOzetiFiltresi>(null)
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
  // Düzenle dialogunda "Alan ekle" ile elle açılan alanlar - kayıt her
  // değişince (acDuzenle) sıfırlanır, aksi halde önceki kayıttan kalır.
  const [duzenleManuelEkAlanlar, setDuzenleManuelEkAlanlar] = useState<Set<EkAlanKey>>(new Set())
  const [duzenleAlanEkleAcik, setDuzenleAlanEkleAcik] = useState(false)
  // "Yazılım" (DIGER) kaydı düzenlenirken turDiger dropdown'ının hangi
  // seçeneği gösterdiği - acDuzenle içinde mevcut değerden türetilir (bkz.
  // tur.ts yazilimSecimindenTuret), listede olmayan bir değer (ör. "MAS
  // Laptop") "Diğer" olarak gelir, serbest metinde aynen görünür.
  const [duzenleYazilimSecimi, setDuzenleYazilimSecimi] = useState<ZimmetYazilimSecenegi | ''>('')
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [personelListesi, setPersonelListesi] = useState<PersonelHit[]>([])
  // İade alma / yeniden zimmetleme akışı
  const [iadeAlinacak, setIadeAlinacak] = useState<ZimmetItem | null>(null)
  const [iadeHedef, setIadeHedef] = useState<'PASIF' | 'HURDA'>('PASIF')
  const [iadeNot, setIadeNot] = useState('')
  const [iadeGonderiliyor, setIadeGonderiliyor] = useState(false)
  const [yenidenZimmet, setYenidenZimmet] = useState<ZimmetItem | null>(null)
  const [yeniSahipId, setYeniSahipId] = useState('')
  const [yenidenGonderiliyor, setYenidenGonderiliyor] = useState(false)
  // "⋯ Daha fazla" menüsündeki "Islak imza belgesi yükle" - IslakImzaYukleDialog
  // artık kontrollü (open/onOpenChange dışarıdan), tetikleyici menüde.
  const [islakYuklenecek, setIslakYuklenecek] = useState<ZimmetItem | null>(null)
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

  // Personel listesi - Düzenle dialogundaki "Zimmet Sahibi" combobox'ı VE
  // Yeniden Zimmetle kişi seçici AYNI listeyi (aynı uç: /api/users?source=db)
  // kullanıyor, tek fetch yeterli (bkz. useZimmetFormu.ts ile aynı kaynak/desen).
  useEffect(() => {
    let cancelled = false
    fetch('/api/users?source=db')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: PersonelHit[]) => {
        if (!cancelled) setPersonelListesi(data)
      })
      .catch(() => {
        if (!cancelled) setPersonelListesi([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function iadeAlKaydet() {
    if (!iadeAlinacak) return
    setIadeGonderiliyor(true)
    try {
      const res = await fetch(`/api/zimmet-formu/${iadeAlinacak.id}/iade-al`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hedefDurum: iadeHedef, not: iadeNot.trim() || undefined }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}) as { error?: string })
        throw new Error((d as { error?: string }).error || 'İade alınamadı')
      }
      toast.success(iadeHedef === 'HURDA' ? 'Cihaz hurdaya çıkarıldı' : 'Cihaz envantere alındı')
      setIadeAlinacak(null)
      setIadeNot('')
      setIadeHedef('PASIF')
      fetchZimmetler()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İade alınamadı')
    } finally {
      setIadeGonderiliyor(false)
    }
  }

  async function yenidenZimmetleKaydet() {
    if (!yenidenZimmet || !yeniSahipId) return
    setYenidenGonderiliyor(true)
    try {
      const res = await fetch(`/api/zimmet-formu/${yenidenZimmet.id}/yeniden-zimmetle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yeniSahipId }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}) as { error?: string })
        throw new Error((d as { error?: string }).error || 'Yeniden zimmetlenemedi')
      }
      toast.success('Cihaz yeni sahibine zimmetlendi (onay bekliyor)')
      setYenidenZimmet(null)
      setYeniSahipId('')
      fetchZimmetler()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yeniden zimmetlenemedi')
    } finally {
      setYenidenGonderiliyor(false)
    }
  }

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
  const durumOzeti = useMemo(() => hesaplaDurumOzeti(zimmetler), [zimmetler])

  const zimmetlerGorunen = useMemo(() => {
    const filtreli = zimmetler.filter(
      (z) =>
        eslesirFiltre(z, filtre) &&
        eslesirTurFiltresi(z, turFiltresi) &&
        eslesirDurumOzeti(z, durumOzetiFiltresi) &&
        eslesirArama(z, aramaDebounced)
    )
    if (!sortField) return filtreli
    const sirali = [...filtreli].sort((a, b) => karsilastir(a, b, sortField))
    return sortDirection === 'asc' ? sirali : sirali.reverse()
  }, [zimmetler, filtre, turFiltresi, durumOzetiFiltresi, aramaDebounced, sortField, sortDirection])

  // Karta tekrar tıklayınca (toggle) veya "Toplam Zimmet"e tıklayınca filtre temizlenir.
  function handleTurFiltresiClick(key: StatKey) {
    setTurFiltresi((prev) => (key === 'toplam' || prev === key ? 'toplam' : key))
  }

  // Durum özeti bandı (Zimmetli/Envanterde/Hurda/Geçmiş) - tür filtresinden
  // bağımsız, aynı toggle mantığı.
  function handleDurumOzetiClick(key: Exclude<DurumOzetiFiltresi, null>) {
    setDurumOzetiFiltresi((prev) => (prev === key ? null : key))
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

  // Yanlışlıkla reddedilen kaydı tekrar ONAY_BEKLIYOR'a çevirir - bkz.
  // [id]/tekrar-onaya-gonder/route.ts.
  async function handleTekrarOnayaGonder(id: string) {
    try {
      const res = await fetch(`/api/zimmet-formu/${id}/tekrar-onaya-gonder`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string })
        throw new Error((data as { error?: string }).error || 'İşlem tamamlanamadı')
      }
      toast.success('Kayıt tekrar onaya gönderildi')
      await fetchZimmetler()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'İşlem tamamlanamadı')
    }
  }

  // Kayıt hangi durumda olursa olsun silinebilir - bkz. [id]/route.ts DELETE.
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
  // [id]/route.ts PATCH. Açıklama, "[Syteline devri]" ön eki temizlenmiş
  // haliyle dolduruluyor (bkz. temizleAciklama) - kullanıcı ne görüyorsa onu
  // düzenliyor, Kaydet'e basınca da temizlenmiş hali DB'ye yazılıyor.
  function acDuzenle(z: ZimmetItem) {
    setDuzenlenecek(z)
    setDuzenleManuelEkAlanlar(new Set())
    setDuzenleYazilimSecimi(yazilimSecimindenTuret(z.tur, z.turDiger))
    setDuzenleForm({
      zimmetSahibiId: z.zimmetSahibiId,
      seriNumarasi: z.seriNumarasi ?? '',
      aciklama: temizleAciklama(z.aciklama),
      ozellik: z.ozellik ?? '',
      macAdresi: z.macAdresi ?? '',
      pcAdi: z.pcAdi ?? '',
      imeiNumarasi: z.imeiNumarasi ?? '',
      marka: z.marka ?? '',
      model: z.model ?? '',
      // OFFICE_365 kaydında turDiger DB'de null'dır (bkz. yazilimKaydi) ama
      // Kaydet'e dokunmadan basılırsa gönderilecek metin "Office 365" OLMALI
      // (aksi halde sunucu tarafındaki yazilimKaydi normalizasyonu boş metni
      // DIGER+null'a çevirir - kayıt yanlışlıkla OFFICE_365'ten DIGER'e düşer).
      turDiger: z.tur === 'OFFICE_365' ? 'Office 365' : (z.turDiger ?? ''),
    })
  }

  function handleDuzenleYazilimSecimi(v: ZimmetYazilimSecenegi) {
    if (v === duzenleYazilimSecimi) return
    setDuzenleYazilimSecimi(v)
    setDuzenleAlan('turDiger', v === 'Diğer' ? '' : v)
  }

  // Düzenle dialogunda türe göre görünür alanlar (MAC Adresi/PC Adı/IMEI) -
  // sihirbazdaki (ZimmetFormuStep1) AYNI mantık, tek kaynaktan (bkz.
  // src/lib/zimmet/ek-alanlar.ts). Zaten dolu olan alan (örn. Office 365
  // kaydında MAC Adresi doluysa) türün varsayılanı olmasa bile gizlenmez.
  const duzenleVarsayilanlar = useMemo(
    () => new Set(varsayilanEkAlanlar(duzenlenecek?.tur ?? '')),
    [duzenlenecek?.tur]
  )
  const duzenleGorunurAlanlar = useMemo(() => {
    const s = new Set<EkAlanKey>(duzenleVarsayilanlar)
    duzenleManuelEkAlanlar.forEach((k) => s.add(k))
    EK_ALAN_KATALOG.forEach(({ key }) => {
      if (duzenleForm[key].trim()) s.add(key)
    })
    return s
  }, [duzenleVarsayilanlar, duzenleManuelEkAlanlar, duzenleForm])
  const duzenleEklenebilirAlanlar = EK_ALAN_KATALOG.filter(({ key }) => !duzenleGorunurAlanlar.has(key))

  // Türe göre değişen zorunlu alanlar - src/lib/zimmet/zorunlu-alanlar.ts,
  // sunucudaki ([id]/route.ts PATCH) ile AYNI tablo. Kayıt hangi türdeyse
  // (sabit, bu dialogdan değişmiyor) ona göre.
  const duzenleZorunluSet = useMemo(() => new Set<string>(zorunluAlanlar(duzenlenecek?.tur ?? '')), [duzenlenecek?.tur])
  const duzenleEksikAlanlar = useMemo(
    () => (duzenlenecek ? zimmetEksikAlanlar(duzenlenecek.tur, duzenleForm) : []),
    [duzenlenecek, duzenleForm]
  )

  function duzenleAlanEkle(key: EkAlanKey) {
    setDuzenleManuelEkAlanlar((prev) => new Set(prev).add(key))
    setDuzenleAlanEkleAcik(false)
  }

  function duzenleAlanKaldir(key: EkAlanKey) {
    setDuzenleManuelEkAlanlar((prev) => {
      const n = new Set(prev)
      n.delete(key)
      return n
    })
    setDuzenleAlan(key, '')
  }

  function setDuzenleAlan<K extends keyof DuzenleFormData>(alan: K, deger: DuzenleFormData[K]) {
    setDuzenleForm((prev) => ({ ...prev, [alan]: deger }))
  }

  async function handleDuzenleKaydet() {
    if (!duzenlenecek) return
    if (duzenleEksikAlanlar.length > 0) {
      toast.error(`Zorunlu alanlar eksik: ${duzenleEksikAlanlar.join(', ')}`)
      return
    }
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

        {/* Durum özeti (iade akışı) - tür kartlarıyla tutarlı: tıklanabilir, toggle. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              { key: 'zimmetli', label: 'Zimmetli', value: durumOzeti.zimmetli, color: 'text-emerald-600' },
              { key: 'envanterde', label: 'Envanterde', value: durumOzeti.envanterde, color: 'text-slate-700' },
              { key: 'hurda', label: 'Hurda', value: durumOzeti.hurda, color: 'text-rose-600' },
              { key: 'gecmis', label: 'Geçmiş (iade)', value: durumOzeti.gecmis, color: 'text-slate-400' },
            ] as const
          ).map((kart) => {
            const aktif = durumOzetiFiltresi === kart.key
            return (
              <Card
                key={kart.key}
                onClick={() => handleDurumOzetiClick(kart.key)}
                title={aktif ? 'Filtreyi kaldır' : `${kart.label} olarak filtrele`}
                className={`shadow-none cursor-pointer transition-all hover:shadow-md rounded-lg p-3 ${
                  aktif ? 'border-2 border-[#1B4F72] ring-2 ring-[#1B4F72]/20' : 'border border-slate-200'
                }`}
              >
                <p className="text-xs text-slate-500">{kart.label}</p>
                <p className={`text-xl font-semibold ${kart.color}`}>{kart.value}</p>
              </Card>
            )
          })}
        </div>

        {/* İstatistik kartları (güncel zimmetler — tür kırılımı) */}
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
          <ReddedilenlerTablosu rows={zimmetlerGorunen} onTekrarOnayaGonder={handleTekrarOnayaGonder} />
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
                    <TableHead className="text-left">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {yukleniyor && (
                    [...Array(4)].map((_, i) => (
                      <TableRow key={i}>
                        {[...Array(7)].map((__, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-5 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                  {!yukleniyor && zimmetlerGorunen.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                        Henüz zimmet kaydı yok
                      </TableCell>
                    </TableRow>
                  )}
                  {!yukleniyor &&
                    zimmetlerGorunen.map((z) => {
                      const rozet = getZimmetDurumRozeti(z)
                      return (
                        <TableRow key={z.id} className={z.iadeTarihi ? 'opacity-60' : undefined}>
                          <TableCell className="font-mono text-xs text-slate-600">
                            {z.seriNumarasi ?? '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar name={z.durum === 'REDDEDILDI' ? null : z.zimmetSahibi.name} />
                              <div className="min-w-0">
                                <span
                                  className={`block truncate font-medium ${z.durum === 'REDDEDILDI' ? 'text-slate-500 italic' : 'text-slate-900'}`}
                                >
                                  {zimmetSahibiBaslik(z)}
                                </span>
                                {zimmetSahibiAltBaslik(z) && (
                                  <span className="block text-xs text-slate-400 truncate">
                                    {zimmetSahibiAltBaslik(z)}
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
                            {z.iadeTarihi && (
                              <span className="mt-1 block text-[11px] text-slate-500">
                                İade alındı: {fmtDate(z.iadeTarihi)}
                                {z.cihazDurumu === 'HURDA'
                                  ? ' · Hurda'
                                  : z.cihazDurumu === 'PASIF'
                                    ? ' · Envanterde'
                                    : ''}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-left min-w-[156px]">
                            {/* Sabit sıra: Detay / Düzenle / Yazdır / durum-aksiyonu /
                                ıslak-imza / Sil. Durum-aksiyonu ve ıslak-imza koşulları
                                BAĞIMSIZ boyutlar (biri diğerini dışlamaz - ör. ONAYLANDI+
                                AKTIF bir kayıtta hem İade al HEM Islak imza yükle aynı
                                anda geçerli olabilir), o yüzden AYRI slotlar olarak
                                kaldılar (birleştirilmedi, erişilemezlik olmasın).
                                Placeholder YOK - koşul sağlanmıyorsa slot hiç yer
                                kaplamaz; Sil bu yüzden satırdan satıra birkaç piksel
                                kayabilir ama ikonlar arasında boşluk oluşmaz (kabul
                                edilen tradeoff). min-w, her satırda hep bulunan 4
                                ikonun (Detay/Düzenle/Yazdır/Sil) genişliğini karşılar,
                                tablo sütunu satırdan satıra daralıp genişlemez. */}
                            {(() => {
                              // Durum-aksiyonu slotu: üç koşul birbirini dışlar (bir kayıt
                              // aynı anda hem PASIF hem ONAYLANDI+AKTIF olamaz), yine de
                              // çakışma olmasın diye else-if zinciriyle yazıldı.
                              let durumSlotu: ReactNode
                              if (z.cihazDurumu === 'PASIF') {
                                durumSlotu = (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    title="Yeniden zimmetle"
                                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                    onClick={() => {
                                      setYeniSahipId('')
                                      setYenidenZimmet(z)
                                    }}
                                  >
                                    <UserPlus className="h-4 w-4" />
                                  </Button>
                                )
                              } else if (z.durum === 'ONAYLANDI' && z.iadeTarihi === null && z.cihazDurumu === 'AKTIF') {
                                durumSlotu = (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    title="İade al (envantere/hurdaya)"
                                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                    onClick={() => {
                                      setIadeHedef('PASIF')
                                      setIadeNot('')
                                      setIadeAlinacak(z)
                                    }}
                                  >
                                    <ArchiveRestore className="h-4 w-4" />
                                  </Button>
                                )
                              } else if (z.durum === 'ONAY_BEKLIYOR' && z.kaynak !== 'SYTELINE_DEVIR') {
                                // Devir kayıtları sahibin onayına gider → bu buton gizli.
                                durumSlotu = (
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
                                )
                              } else {
                                // Placeholder YOK - koşul sağlanmıyorsa slot hiç yer
                                // kaplamaz (bkz. TableCell'deki min-w, Sil'in çok
                                // fazla kaymasını önler ama boşluk bırakmaz).
                                durumSlotu = null
                              }

                              // Islak imza slotu: yükle (dosya yok) / indir (dosya var) / hiçbiri.
                              let islakSlotu: ReactNode
                              if (rozet.label === 'Belge Yüklenmesi Gerekmektedir') {
                                islakSlotu = (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    title="Islak imza belgesi yükle"
                                    onClick={() => setIslakYuklenecek(z)}
                                  >
                                    <Upload className="h-4 w-4" />
                                  </Button>
                                )
                              } else if (z.imzaModu === 'ISLAK' && z.islakImzaDosyasi) {
                                islakSlotu = (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    title="Islak imza belgesini indir"
                                    onClick={() => indirBelge(z.id)}
                                  >
                                    <FileDown className="h-4 w-4" />
                                  </Button>
                                )
                              } else {
                                islakSlotu = null
                              }

                              return (
                                <div className="flex items-center justify-start gap-1">
                                  <Button type="button" variant="ghost" size="icon" title="Detay" asChild>
                                    <Link href={`/zimmet-formu/${z.id}/onayla`}>
                                      <Eye className="h-4 w-4" />
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
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            title={z.durum === 'ONAY_BEKLIYOR' ? 'Taslak PDF indir' : 'PDF indir'}
                                            disabled={z.durum === 'REDDEDILDI'}
                                            onClick={() => indirlePdf(z.id, z.durum)}
                                          >
                                            <Printer className="h-4 w-4" />
                                          </Button>
                                        </span>
                                      </TooltipTrigger>
                                      {z.durum === 'REDDEDILDI' && (
                                        <TooltipContent>Reddedilmiş kayıt yazdırılamaz</TooltipContent>
                                      )}
                                    </Tooltip>
                                  </TooltipProvider>
                                  {/* Sil: kayıt hangi durumda olursa olsun aktif - bkz. [id]/route.ts DELETE. */}
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
                                  {durumSlotu}
                                  {islakSlotu}
                                </div>
                              )
                            })()}
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

      {/* İade alma dialog'u */}
      <Dialog open={iadeAlinacak !== null} onOpenChange={(o) => { if (!o) setIadeAlinacak(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cihazı iade al</DialogTitle>
            <DialogDescription>
              {iadeAlinacak ? `${turGosterim(iadeAlinacak)} — ${iadeAlinacak.seriNumarasi ?? '—'}` : ''}. Cihaz
              geri alınır; imzalı tutanak (ONAYLANDI) korunur.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={iadeHedef === 'PASIF' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setIadeHedef('PASIF')}
              >
                Envantere al
              </Button>
              <Button
                type="button"
                variant={iadeHedef === 'HURDA' ? 'destructive' : 'outline'}
                className="flex-1"
                onClick={() => setIadeHedef('HURDA')}
              >
                Hurdaya çıkar
              </Button>
            </div>
            <Textarea
              value={iadeNot}
              onChange={(e) => setIadeNot(e.target.value)}
              placeholder="Not (opsiyonel)"
              className="min-h-[70px]"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIadeAlinacak(null)} disabled={iadeGonderiliyor}>
              Vazgeç
            </Button>
            <Button type="button" onClick={iadeAlKaydet} disabled={iadeGonderiliyor}>
              {iadeGonderiliyor ? 'İşleniyor…' : iadeHedef === 'HURDA' ? 'Hurdaya çıkar' : 'Envantere al'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Yeniden zimmetleme dialog'u */}
      <Dialog open={yenidenZimmet !== null} onOpenChange={(o) => { if (!o) setYenidenZimmet(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Yeniden zimmetle</DialogTitle>
            <DialogDescription>
              {yenidenZimmet ? `${turGosterim(yenidenZimmet)} — ${yenidenZimmet.seriNumarasi ?? '—'}` : ''}. Yeni
              sahibe onay bekleyen bir zimmet kaydı açılır; eski kayıt korunur.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Yeni zimmet sahibi</Label>
            <PersonelCombobox
              personelListesi={personelListesi}
              value={yeniSahipId}
              onSelect={setYeniSahipId}
              placeholder="Personel seçin"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setYenidenZimmet(null)} disabled={yenidenGonderiliyor}>
              Vazgeç
            </Button>
            <Button type="button" onClick={yenidenZimmetleKaydet} disabled={!yeniSahipId || yenidenGonderiliyor}>
              {yenidenGonderiliyor ? 'İşleniyor…' : 'Zimmetle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Islak imza belgesi yükleme dialog'u - "⋯ Daha fazla" menüsünden açılır. */}
      <IslakImzaYukleDialog
        zimmetId={islakYuklenecek?.id ?? ''}
        open={islakYuklenecek !== null}
        onOpenChange={(o) => { if (!o) setIslakYuklenecek(null) }}
        onUploaded={() => {
          setIslakYuklenecek(null)
          fetchZimmetler()
        }}
      />

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
            <div className="space-y-1.5">
              <Label htmlFor="duzenle-zimmetSahibi">Zimmet Sahibi</Label>
              <PersonelCombobox
                personelListesi={personelListesi}
                value={duzenleForm.zimmetSahibiId}
                onSelect={(personelId) => setDuzenleAlan('zimmetSahibiId', personelId)}
                placeholder={personelListesi.length === 0 ? 'Personel listesi yükleniyor...' : 'Personel seçin'}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="duzenle-seriNo">
                Seri Numarası <RequiredMark />
              </Label>
              <Input
                id="duzenle-seriNo"
                value={duzenleForm.seriNumarasi}
                onChange={(e) => setDuzenleAlan('seriNumarasi', e.target.value)}
                className={!duzenleForm.seriNumarasi.trim() ? 'border-rose-300 ring-1 ring-rose-200' : ''}
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
            {/* DIGER hem OFFICE_365 - "Yazılım" grubunun iki üyesi de bu
                dropdown'ı gösterir; buradan seçilen değere göre Kaydet'te
                tur OFFICE_365↔DIGER arasında otomatik geçebilir (bkz.
                [id]/route.ts PATCH, tur.ts yazilimKaydi). */}
            {(duzenlenecek?.tur === 'DIGER' || duzenlenecek?.tur === 'OFFICE_365') && (
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="duzenle-turDiger">
                  Hangi yazılım? <RequiredMark />
                </Label>
                <Select
                  value={duzenleYazilimSecimi}
                  onValueChange={(v) => handleDuzenleYazilimSecimi(v as ZimmetYazilimSecenegi)}
                >
                  <SelectTrigger
                    id="duzenle-turDiger"
                    className={!duzenleYazilimSecimi ? 'border-rose-300 ring-1 ring-rose-200' : ''}
                  >
                    <SelectValue placeholder="Yazılım seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {ZIMMET_YAZILIM_SECENEKLERI.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {duzenleYazilimSecimi === 'Diğer' && (
                  <Input
                    value={duzenleForm.turDiger}
                    onChange={(e) => setDuzenleAlan('turDiger', e.target.value)}
                    placeholder="Yazılımı yazın"
                    className={!duzenleForm.turDiger.trim() ? 'border-rose-300 ring-1 ring-rose-200' : ''}
                  />
                )}
              </div>
            )}
            {EK_ALAN_KATALOG.filter(({ key }) => duzenleGorunurAlanlar.has(key)).map(({ key, label }) => {
              const gerekli = duzenleZorunluSet.has(key)
              return (
                <div className="space-y-1.5" key={key}>
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`duzenle-${key}`}>
                      {label} {gerekli && <RequiredMark />}
                    </Label>
                    {!duzenleVarsayilanlar.has(key) && (
                      <button
                        type="button"
                        onClick={() => duzenleAlanKaldir(key)}
                        className="text-slate-400 hover:text-rose-500"
                        title="Alanı kaldır"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Input
                    id={`duzenle-${key}`}
                    value={duzenleForm[key]}
                    onChange={(e) => setDuzenleAlan(key, e.target.value)}
                    className={gerekli && !duzenleForm[key].trim() ? 'border-rose-300 ring-1 ring-rose-200' : ''}
                  />
                </div>
              )
            })}
            {duzenleEklenebilirAlanlar.length > 0 && (
              <div className="col-span-2">
                <Popover open={duzenleAlanEkleAcik} onOpenChange={setDuzenleAlanEkleAcik}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Alan ekle
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-1" align="start">
                    {duzenleEklenebilirAlanlar.map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => duzenleAlanEkle(key)}
                        className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-slate-100"
                      >
                        {label}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
            )}
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="duzenle-ozellik">
                Özellik {duzenleZorunluSet.has('ozellik') && <RequiredMark />}
              </Label>
              <Input
                id="duzenle-ozellik"
                value={duzenleForm.ozellik}
                onChange={(e) => setDuzenleAlan('ozellik', e.target.value)}
                className={
                  duzenleZorunluSet.has('ozellik') && !duzenleForm.ozellik.trim()
                    ? 'border-rose-300 ring-1 ring-rose-200'
                    : ''
                }
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={duzenleEksikAlanlar.length > 0 ? 'cursor-not-allowed' : ''}>
                    <Button
                      type="button"
                      className="bg-[#1B4F72] hover:bg-[#1B4F72]/90"
                      onClick={handleDuzenleKaydet}
                      disabled={kaydediliyor || duzenleEksikAlanlar.length > 0}
                    >
                      {kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}
                    </Button>
                  </span>
                </TooltipTrigger>
                {duzenleEksikAlanlar.length > 0 && (
                  <TooltipContent>Eksik: {duzenleEksikAlanlar.join(', ')}</TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

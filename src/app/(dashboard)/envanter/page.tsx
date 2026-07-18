'use client'

import { useSession } from 'next-auth/react'
import { type ElementType, type ReactNode, useEffect, useMemo, useState } from 'react'
import type { EnvanterUrunDetail, EnvanterUrunListItem } from '@/types/envanter'
import type { ExecuteSonuc, ImportAtlanan, ImportHata, ValidateSonuc } from '@/lib/envanter/import'
import type { YenilemeDurum, YenilemeSatiri } from '@/lib/envanter/yenileme'
import type { SatinAlmaAksiyonTip, SatinAlmaDurumTip } from '@/lib/envanter/satinalma'
import type {
  IhtiyacOzet,
  IhtiyacSatiri,
  PlanlananAlimOnerisi,
  SezonParametre,
  SezonTipiTip,
  TurnoverOranOnerisi,
} from '@/lib/envanter/sezon'
import type {
  BedenProfilExecuteSonuc,
  BedenProfilValidateSonuc,
} from '@/lib/envanter/beden-profili-import'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import * as XLSX from 'xlsx'
import {
  AlertTriangle,
  Boxes,
  ClipboardCheck,
  Download,
  Eye,
  FileText,
  HelpCircle,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Upload,
  UserCheck,
  Warehouse,
  X,
} from 'lucide-react'

type EnvanterTab =
  | 'dashboard'
  | 'urunler'
  | 'stok'
  | 'zimmetler'
  | 'sezon'
  | 'satin-alma'
  | 'parametreler'
  | 'veri-aktarimi'
  | 'raporlar'

type UrunDurumu = 'NORMAL' | 'KRITIK' | 'PASIF'

type DemoUrun = {
  kod: string
  ad: string
  kategori: string
  tip: string
  birim: string
  mevcut: number
  min: number
  kritik: number
  durum: UrunDurumu
}

type StokSatiri = {
  ilkGiris: string
  minStok: string
  kritikStok: string
  maxStok: string
  depo: string
  raf: string
}

type UrunForm = {
  kod: string
  ad: string
  kategori: string
  tip: string
  olcuBirimi: string
  barkod: string
  aciklama: string
  varyantTipi: string
  bedenTipi: string
  bedenler: string[]
  numaralar: string[]
  renkler: string[]
  stokSatirlari: Record<string, StokSatiri>
  tedarikci: string
  marka: string
  model: string
  sonAlisFiyati: string
  paraBirimi: string
  kdvOrani: string
  minSiparisMiktari: string
  tedarikSuresiGun: string
  dagitimSekli: string
  periyot: string
  kullanimOmruGun: string
  eskiUrunIade: boolean
  yoneticiOnayi: boolean
  aciklamaZorunlu: boolean
  fotoZorunlu: boolean
  imzaZorunlu: boolean
  hedefYaka: string
  hedefBolum: string
  hedefPozisyon: string
  hedefLokasyon: string
  hedefVardiya: string
  calismaSekli: string
  personelHedefTipi: string
  atamaTipi: string
  tahminiDagitim: string
  sonrakiDagitimTarihi: string
  seciliPersoneller: string[]
  teslimYetkisi: string
  talepEdenRoller: string[]
  onayAkisi: string[]
  sureSonuAksiyonu: string
  dagitimKurali: string
  qrZorunlu: boolean
  barkodZorunlu: boolean
}

const tabs: { key: EnvanterTab; label: string; icon: ElementType }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: Boxes },
  { key: 'urunler', label: 'Ürün Yönetimi', icon: Package },
  { key: 'stok', label: 'Stok Yönetimi', icon: Warehouse },
  { key: 'zimmetler', label: 'Personel Zimmeti', icon: UserCheck },
  { key: 'sezon', label: 'Sezon Planı', icon: ClipboardCheck },
  { key: 'satin-alma', label: 'Satın Alma', icon: ShoppingCart },
  { key: 'parametreler', label: 'Parametreler', icon: ClipboardCheck },
  { key: 'veri-aktarimi', label: 'Veri Aktarımı', icon: Upload },
  { key: 'raporlar', label: 'Raporlar', icon: FileText },
]

const demoUrunler: DemoUrun[] = [
  {
    kod: 'ENV-001',
    ad: 'İş Ayakkabısı',
    kategori: 'İş Ayakkabısı',
    tip: 'Numaralı / Zimmetli',
    birim: 'Çift',
    mevcut: 48,
    min: 20,
    kritik: 10,
    durum: 'NORMAL',
  },
  {
    kod: 'ENV-002',
    ad: 'Kaynak Eldiveni',
    kategori: 'KKD / Eldiven',
    tip: 'Periyodik Tüketim',
    birim: 'Çift',
    mevcut: 320,
    min: 100,
    kritik: 50,
    durum: 'NORMAL',
  },
  {
    kod: 'ENV-003',
    ad: 'Kışlık Mont',
    kategori: 'İş Kıyafeti',
    tip: 'Bedenli / Zimmetli',
    birim: 'Adet',
    mevcut: 5,
    min: 20,
    kritik: 10,
    durum: 'KRITIK',
  },
  {
    kod: 'ENV-004',
    ad: 'A4 Fotokopi Kağıdı',
    kategori: 'Kırtasiye',
    tip: 'Standart Stok',
    birim: 'Paket',
    mevcut: 200,
    min: 50,
    kritik: 25,
    durum: 'NORMAL',
  },
]

const bedenSecenekleri = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']

const numaraSecenekleri = [
  '35',
  '36',
  '37',
  '38',
  '39',
  '40',
  '41',
  '42',
  '43',
  '44',
  '45',
  '46',
]

const renkSecenekleri = [
  'Siyah',
  'Lacivert',
  'Gri',
  'Beyaz',
  'Sarı',
  'Turuncu',
  'Kırmızı',
  'Yeşil',
]

const depoSecenekleri = [
  { value: '', label: 'Seçiniz' },
  { value: 'IDARI_ISLER', label: 'İdari İşler Deposu' },
  { value: 'KKD_DEPO', label: 'KKD Deposu' },
  { value: 'KIRTASIYE', label: 'Kırtasiye Dolabı' },
  { value: 'TEMIZLIK', label: 'Temizlik Deposu' },
]

const demoPersoneller = [
  { id: 'P001', adSoyad: 'Ahmet Yılmaz', sicilNo: '1001', bolum: 'Üretim', gorev: 'Operatör', yaka: 'Mavi Yaka' },
  { id: 'P002', adSoyad: 'Ayşe Demir', sicilNo: '1002', bolum: 'Kalite', gorev: 'Kalite Kontrol', yaka: 'Beyaz Yaka' },
  { id: 'P003', adSoyad: 'Mehmet Kaya', sicilNo: '1003', bolum: 'Bakım', gorev: 'Teknisyen', yaka: 'Mavi Yaka' },
  { id: 'P004', adSoyad: 'Elif Yıldırım', sicilNo: '1004', bolum: 'İdari İşler', gorev: 'İnsan Varlıkları Müdürü', yaka: 'Beyaz Yaka' },
]

const bosStokSatiri: StokSatiri = {
  ilkGiris: '',
  minStok: '',
  kritikStok: '',
  maxStok: '',
  depo: '',
  raf: '',
}

// Erişim kapısı: envanter.view yetkisi olmayan kullanıcı modülü göremez.
// Hook-güvenli: asıl gövde (EnvanterPageInner) yalnız yetki varsa render edilir,
// böylece içindeki hook'lar koşullu çalışmaz.
export default function EnvanterPage() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return <div className="p-8 text-sm text-slate-500">Yükleniyor…</div>
  }

  if (!session?.user?.permissions?.includes('envanter.view')) {
    return (
      <div className="p-8">
        <div className="mx-auto max-w-md rounded-lg border bg-white p-6 text-center shadow-sm">
          <p className="font-medium text-slate-900">Bu modüle erişim yetkiniz yok</p>
          <p className="mt-1 text-sm text-slate-500">
            Envanter modülü için <code className="rounded bg-slate-100 px-1">envanter.view</code> yetkisi gerekir.
          </p>
        </div>
      </div>
    )
  }

  return <EnvanterPageInner />
}

function EnvanterPageInner() {
  const [activeTab, setActiveTab] = useState<EnvanterTab>('dashboard')
  const [showNewProductWizard, setShowNewProductWizard] = useState(false)

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-teal-700">
          İnsan Varlıkları / İdari İşler
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Envanter Yönetimi
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Stok, personel zimmeti, KKD teslimi, sezonluk kıyafet dağıtımı ve satın
          alma ihtiyaçlarını tek panelden yönetmek için hazırlanmıştır.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as EnvanterTab)}>
        <TabsList className="w-full flex-nowrap justify-start overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon

            return (
              <TabsTrigger key={tab.key} value={tab.key} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>

      <main className="space-y-6">
  {activeTab === 'dashboard' && <DashboardContent />}

  {activeTab === 'urunler' && (
    <UrunYonetimi onNewProduct={() => setShowNewProductWizard(true)} />
  )}

  {activeTab === 'stok' && (
    <StokYonetimi />
  )}

  {activeTab === 'stok' && (
  <StokYonetimi />
)}

{activeTab === 'zimmetler' && (
  <PersonelZimmeti />
)}

{activeTab === 'parametreler' && (
  <ParametrelerYonetimi />
)}

{activeTab === 'veri-aktarimi' && (
  <VeriAktarimi />
)}

{activeTab === 'raporlar' && (
  <RaporlarYonetimi />
)}

{activeTab === 'satin-alma' && (
  <SatinAlmaYonetimi />
)}

{activeTab === 'sezon' && (
  <SezonPlaniYonetimi />
)}

{activeTab !== 'dashboard' &&
  activeTab !== 'urunler' &&
  activeTab !== 'stok' &&
  activeTab !== 'zimmetler' &&
  activeTab !== 'parametreler' &&
  activeTab !== 'veri-aktarimi' &&
  activeTab !== 'raporlar' &&
  activeTab !== 'satin-alma' &&
  activeTab !== 'sezon' && (
    <PlaceholderContent
      title={tabs.find((tab) => tab.key === activeTab)?.label ?? ''}
    />
)}
</main>

      {showNewProductWizard && (
        <YeniUrunWizard onClose={() => setShowNewProductWizard(false)} />
      )}
    </div>
  )
}

function DashboardContent() {
  const [urunler, setUrunler] = useState<EnvanterUrunListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await fetch('/api/envanter/urunler')
        const result = await response.json()

        if (result.ok) {
          setUrunler(result.data)
        }
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  const toplamUrun = urunler.length
  const toplamStok = urunler.reduce((total, urun) => total + urun.mevcut, 0)
  const kritikUrun = urunler.filter((urun) => urun.durum === 'KRITIK').length
  const eksikUrun = urunler.filter((urun) => urun.mevcut === 0).length

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm text-sm text-slate-600">
        Dashboard verileri yükleniyor...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="Toplam Ürün"
          value={String(toplamUrun)}
          description="Sistemde kayıtlı ürün kartı"
          icon={Package}
        />

        <DashboardCard
          title="Toplam Stok"
          value={String(toplamStok)}
          description="Tüm ürünlerin mevcut stok toplamı"
          icon={Warehouse}
        />

        <DashboardCard
          title="Kritik Ürün"
          value={String(kritikUrun)}
          description="Kritik stok seviyesinde olan ürünler"
          icon={AlertTriangle}
        />

        <DashboardCard
          title="Stoksuz Ürün"
          value={String(eksikUrun)}
          description="Mevcut stoğu sıfır olan ürünler"
          icon={Boxes}
        />
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Stok Durumu Özeti
        </h2>

        <div className="mt-4 overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Kod</th>
                <th className="px-4 py-3">Ürün</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3 text-right">Mevcut</th>
                <th className="px-4 py-3 text-right">Min.</th>
                <th className="px-4 py-3">Durum</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {urunler.map((urun) => (
                <tr key={urun.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {urun.kod}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {urun.ad}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {urun.kategori}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {urun.mevcut}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {urun.min}
                  </td>
                  <td className="px-4 py-3">
                    <DurumBadge durum={urun.durum} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {urunler.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            Henüz ürün kaydı bulunmuyor.
          </div>
        )}
      </div>
    </div>
  )
}

function UrunYonetimi({
  onNewProduct,
}: {
  onNewProduct: () => void
}) {
  const [search, setSearch] = useState('')
  const [urunler, setUrunler] = useState<EnvanterUrunListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUrunId, setSelectedUrunId] = useState<string | null>(null)
  const [bedenTipiSaving, setBedenTipiSaving] = useState<Record<string, boolean>>({})
  const [bedenTipiHata, setBedenTipiHata] = useState<Record<string, string>>({})

  async function loadUrunler() {
  setLoading(true)

  try {
    const response = await fetch('/api/envanter/urunler')
    const result = await response.json()

    if (result.ok) {
      setUrunler(result.data)
    }
  } catch (error) {
    console.error('Ürün listesi alınamadı:', error)
  } finally {
    setLoading(false)
  }
}

useEffect(() => {
  loadUrunler()

  const handler = () => loadUrunler()
  window.addEventListener('envanter-urun-kaydedildi', handler)

  return () => {
    window.removeEventListener('envanter-urun-kaydedildi', handler)
  }
}, [])

const filtered = useMemo<EnvanterUrunListItem[]>(() => {
  const value = search.trim().toLowerCase()
  if (!value) return urunler

  return urunler.filter((urun) =>
    [urun.kod, urun.ad, urun.kategori, urun.tip]
      .join(' ')
      .toLowerCase()
      .includes(value),
  )
}, [search, urunler])

async function handleBedenTipiDegistir(urunId: string, yeniDeger: string) {
  setBedenTipiSaving((prev) => ({ ...prev, [urunId]: true }))
  setBedenTipiHata((prev) => ({ ...prev, [urunId]: '' }))

  try {
    const res = await fetch(`/api/envanter/urunler/${urunId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bedenTipi: yeniDeger }),
    })
    const json = await res.json()

    if (json.ok) {
      setUrunler((prev) =>
        prev.map((u) => (u.id === urunId ? { ...u, bedenTipi: yeniDeger } : u)),
      )
    } else {
      setBedenTipiHata((prev) => ({ ...prev, [urunId]: json.message || 'Kaydedilemedi.' }))
    }
  } catch (err) {
    setBedenTipiHata((prev) => ({
      ...prev,
      [urunId]: err instanceof Error ? err.message : 'Kaydedilemedi.',
    }))
  } finally {
    setBedenTipiSaving((prev) => ({ ...prev, [urunId]: false }))
  }
}

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Ürün Yönetimi
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Ürün kartları, kategori, ürün tipi, stok seviyesi ve politika
              bilgileri buradan yönetilir.
            </p>
            
          </div>

         <button
  type="button"
  onClick={onNewProduct}
  className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
>
  <Plus className="h-4 w-4" />
  Yeni Ürün
</button>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ürün adı, kodu veya kategori ara..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <select className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
            <option>Tüm Kategoriler</option>
            <option>İş Kıyafeti</option>
            <option>İş Ayakkabısı</option>
            <option>KKD / Eldiven</option>
            <option>Kırtasiye</option>
          </select>

          <select className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
            <option>Tüm Durumlar</option>
            <option>Normal</option>
            <option>Kritik</option>
            <option>Pasif</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Kod</th>
              <th className="px-4 py-3">Ürün</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Tip</th>
              <th className="px-4 py-3">Beden Tipi</th>
              <th className="px-4 py-3 text-right">Mevcut</th>
              <th className="px-4 py-3 text-right">Min.</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((urun) => (
              <tr key={urun.kod} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-700">
                  {urun.kod}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{urun.ad}</div>
                  <div className="text-xs text-slate-500">{urun.olcuBirimi}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{urun.kategori}</td>
                <td className="px-4 py-3 text-slate-600">{urun.tip}</td>
                <td className="px-4 py-3">
                  <select
                    value={urun.bedenTipi}
                    onChange={(e) => handleBedenTipiDegistir(urun.id, e.target.value)}
                    disabled={bedenTipiSaving[urun.id]}
                    className={[
                      'rounded-lg border px-2 py-1 text-xs disabled:opacity-60',
                      ['BEDENLI_URUN', 'NUMARALI_URUN', 'KKD_URUNU'].includes(urun.tip)
                        ? 'border-teal-300 bg-teal-50'
                        : 'border-slate-200',
                    ].join(' ')}
                  >
                    <option value="YOK">Yok</option>
                    <option value="UST">Üst</option>
                    <option value="ALT">Alt</option>
                    <option value="AYAKKABI">Ayakkabı</option>
                    <option value="ELDIVEN">Eldiven</option>
                  </select>
                  {bedenTipiSaving[urun.id] && (
                    <div className="mt-1 text-xs text-slate-400">Kaydediliyor...</div>
                  )}
                  {bedenTipiHata[urun.id] && (
                    <div className="mt-1 text-xs text-rose-600">{bedenTipiHata[urun.id]}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {urun.mevcut}
                </td>
                <td className="px-4 py-3 text-right">{urun.min}</td>
                <td className="px-4 py-3">
                  <DurumBadge durum={urun.durum} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
  type="button"
  onClick={() => setSelectedUrunId(urun.id)}
  className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
>
                    <Eye className="h-3.5 w-3.5" />
                    Detay
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
  <div className="p-8 text-center text-sm text-slate-500">
    Arama kriterine uygun ürün bulunamadı.
  </div>
)}

{selectedUrunId && (
  <UrunDetayModal
    urunId={selectedUrunId}
    onClose={() => setSelectedUrunId(null)}
  />
)}

</div>
</div>
)
}

function YeniUrunWizard({ onClose }: { onClose: () => void }) {
  const [wizardStep, setWizardStep] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [urunForm, setUrunForm] = useState<UrunForm>({
    kod: '',
    ad: '',
    kategori: '',
    tip: 'STANDART_STOK',
    olcuBirimi: 'ADET',
    barkod: '',
    aciklama: '',
    varyantTipi: '',
    bedenTipi: 'YOK',
    bedenler: [],
    numaralar: [],
    renkler: [],
    stokSatirlari: {},
    tedarikci: '',
    marka: '',
    model: '',
    sonAlisFiyati: '',
    paraBirimi: 'TRY',
    kdvOrani: '20',
    minSiparisMiktari: '',
    tedarikSuresiGun: '',
    dagitimSekli: '',
    periyot: '',
    kullanimOmruGun: '',
    eskiUrunIade: false,
    yoneticiOnayi: false,
    aciklamaZorunlu: false,
    fotoZorunlu: false,
    imzaZorunlu: false,
    hedefYaka: '',
    hedefBolum: '',
    hedefPozisyon: '',
    hedefLokasyon: '',
    hedefVardiya: '',
    calismaSekli: '',
    personelHedefTipi: 'FILTRE',
    atamaTipi: 'ZORUNLU',
    tahminiDagitim: '',
    sonrakiDagitimTarihi: '',
    seciliPersoneller: [],
    teslimYetkisi: '',
    talepEdenRoller: [],
    onayAkisi: [],
    sureSonuAksiyonu: '',
    dagitimKurali: '',
    qrZorunlu: false,
    barkodZorunlu: false,
  })

  const [topluStok, setTopluStok] = useState<StokSatiri>({
    ilkGiris: '',
    minStok: '',
    kritikStok: '',
    maxStok: '',
    depo: '',
    raf: '',
  })

  const wizardSteps = [
    'Genel',
    'Varyant',
    'Stok',
    'Satın Alma',
    'Dağıtım',
    'Personel',
    'Özet',
  ]

  const isFirstStep = wizardStep === 0
  const isLastStep = wizardStep === wizardSteps.length - 1

  const genelFormTamam =
    urunForm.kod.trim() !== '' &&
    urunForm.ad.trim() !== '' &&
    urunForm.kategori !== '' &&
    urunForm.tip !== '' &&
    urunForm.olcuBirimi !== ''

  const canGoNext = wizardStep !== 0 || genelFormTamam

  const updateForm = (
    field: keyof UrunForm,
    value: string | boolean | string[] | Record<string, StokSatiri>,
  ) => {
    setUrunForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const toggleArrayValue = (
    field:
  | 'bedenler'
  | 'numaralar'
  | 'renkler'
  | 'talepEdenRoller'
  | 'onayAkisi'
  | 'seciliPersoneller',
    value: string,
  ) => {
    setUrunForm((current) => {
      const list = current[field]
      return {
        ...current,
        [field]: list.includes(value)
          ? list.filter((item) => item !== value)
          : [...list, value],
      }
    })
  }

  const varyantOnizleme = buildVaryantOnizleme(urunForm)
  const stokAnahtarlari =
    varyantOnizleme.length > 0 ? varyantOnizleme : ['Ana Ürün']

  const getStokSatiri = (key: string): StokSatiri => {
    return urunForm.stokSatirlari[key] ?? bosStokSatiri
  }

  const updateStokSatiri = (
    key: string,
    field: keyof StokSatiri,
    value: string,
  ) => {
    setUrunForm((current) => ({
      ...current,
      stokSatirlari: {
        ...current.stokSatirlari,
        [key]: {
          ...(current.stokSatirlari[key] ?? bosStokSatiri),
          [field]: value,
        },
      },
    }))
  }

  const applyBulkToAll = (field: keyof StokSatiri) => {
    const value = topluStok[field]

    setUrunForm((current) => {
      const updated = { ...current.stokSatirlari }

      stokAnahtarlari.forEach((key) => {
        updated[key] = {
          ...(updated[key] ?? bosStokSatiri),
          [field]: value,
        }
      })

      return {
        ...current,
        stokSatirlari: updated,
      }
    })
  }

  const getToplamIlkGiris = () => {
    return stokAnahtarlari.reduce((total, key) => {
      const miktar = Number(getStokSatiri(key).ilkGiris || 0)
      return total + (Number.isNaN(miktar) ? 0 : miktar)
    }, 0)
  }

async function handleSave() {
  setIsSaving(true)
  setSaveError('')

  try {
    const response = await fetch('/api/envanter/urunler', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(urunForm),
    })

    const result = await response.json()

    if (!response.ok || !result.ok) {
      throw new Error(result.message || 'Ürün kaydedilemedi.')
    }

    onClose()
  } catch (error) {
    setSaveError(
      error instanceof Error
        ? error.message
        : 'Ürün kaydedilirken hata oluştu.',
    )
  } finally {
    setIsSaving(false)
  }
}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="flex max-h-[88vh] w-full max-w-6xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b p-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Yeni Ürün Kartı
            </h2>
            <p className="text-sm text-slate-500">Ürün oluşturma sihirbazı</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border p-2 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b bg-slate-50 px-8 py-4">
          <div className="flex items-center gap-3 overflow-x-auto">
            {wizardSteps.map((item, index) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  if (index === 0 || genelFormTamam) setWizardStep(index)
                }}
                className={[
                  'rounded-xl px-4 py-2 text-sm font-medium',
                  index === wizardStep
                    ? 'bg-teal-700 text-white'
                    : index < wizardStep
                      ? 'bg-teal-50 text-teal-800'
                      : 'bg-slate-200 text-slate-600',
                ].join(' ')}
              >
                {index + 1}. {item}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {wizardStep === 0 && (
            <div className="grid grid-cols-2 gap-6 p-8">
              <FormInput
                label="Ürün Kodu"
                value={urunForm.kod}
                placeholder="ENV-0001"
                onChange={(value) => updateForm('kod', value)}
              />

              <FormInput
                label="Ürün Adı"
                value={urunForm.ad}
                placeholder="İş Ayakkabısı"
                onChange={(value) => updateForm('ad', value)}
              />

              <FormSelect
                label="Kategori"
                value={urunForm.kategori}
                onChange={(value) => updateForm('kategori', value)}
                options={[
                  { value: '', label: 'Seçiniz' },
                  { value: 'KKD', label: 'KKD' },
                  { value: 'IS_KIYAFETI', label: 'İş Kıyafeti' },
                  { value: 'KIRTASIYE', label: 'Kırtasiye' },
                  { value: 'TEMIZLIK', label: 'Temizlik' },
                  { value: 'SARF', label: 'Sarf' },
                ]}
              />

              <FormSelect
                label="Ürün Tipi"
                value={urunForm.tip}
                onChange={(value) => updateForm('tip', value)}
                options={[
                  { value: 'STANDART_STOK', label: 'Standart Stok' },
                  { value: 'PERIYODIK_TUKETIM', label: 'Periyodik Tüketim' },
                  { value: 'NUMARALI_URUN', label: 'Numaralı Ürün' },
                  { value: 'ZIMMETLI_URUN', label: 'Zimmetli Ürün' },
                  { value: 'BEDENLI_URUN', label: 'Bedenli Ürün' },
                  { value: 'KKD_URUNU', label: 'KKD Ürünü' },
                ]}
              />

              <FormSelect
                label="Ölçü Birimi"
                value={urunForm.olcuBirimi}
                onChange={(value) => updateForm('olcuBirimi', value)}
                options={[
                  { value: 'ADET', label: 'Adet' },
                  { value: 'CIFT', label: 'Çift' },
                  { value: 'PAKET', label: 'Paket' },
                  { value: 'KUTU', label: 'Kutu' },
                  { value: 'KG', label: 'Kg' },
                  { value: 'LITRE', label: 'Litre' },
                ]}
              />

              <FormInput
                label="Barkod"
                value={urunForm.barkod}
                placeholder="Opsiyonel"
                onChange={(value) => updateForm('barkod', value)}
              />

              <div className="col-span-2">
                <label className="mb-2 block text-sm font-medium">
                  Açıklama
                </label>
                <textarea
                  rows={4}
                  value={urunForm.aciklama}
                  onChange={(event) => updateForm('aciklama', event.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
            </div>
          )}

          {wizardStep === 1 && (
            <div className="space-y-6 p-8">
              <div>
                <h3 className="text-lg font-semibold">Varyant Bilgileri</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Beden, numara ve renk kırılımları bu adımda tanımlanır.
                </p>
              </div>

              <FormSelect
                label="Varyant Tipi"
                value={urunForm.varyantTipi}
                onChange={(value) => updateForm('varyantTipi', value)}
                options={[
                  { value: '', label: 'Varyant yok' },
                  { value: 'BEDEN', label: 'Beden' },
                  { value: 'NUMARA', label: 'Numara' },
                  { value: 'RENK', label: 'Renk' },
                  { value: 'BEDEN_RENK', label: 'Beden + Renk' },
                  { value: 'NUMARA_RENK', label: 'Numara + Renk' },
                ]}
              />

              <FormSelect
                label="Beden Tipi"
                value={urunForm.bedenTipi}
                onChange={(value) => updateForm('bedenTipi', value)}
                options={[
                  { value: 'YOK', label: 'Yok' },
                  { value: 'UST', label: 'Üst Beden' },
                  { value: 'ALT', label: 'Alt Beden' },
                  { value: 'AYAKKABI', label: 'Ayakkabı' },
                  { value: 'ELDIVEN', label: 'Eldiven' },
                ]}
              />
              <p className="-mt-4 text-xs text-slate-500">
                Sezon planı ihtiyaç hesabında personelin hangi beden profili alanıyla
                eşleştirileceğini belirler.
              </p>

              {(urunForm.varyantTipi === 'BEDEN' ||
                urunForm.varyantTipi === 'BEDEN_RENK') && (
                <VaryantCheckboxGroup
                  title="Bedenler"
                  options={bedenSecenekleri}
                  selected={urunForm.bedenler}
                  onToggle={(value) => toggleArrayValue('bedenler', value)}
                />
              )}

              {(urunForm.varyantTipi === 'NUMARA' ||
                urunForm.varyantTipi === 'NUMARA_RENK') && (
                <VaryantCheckboxGroup
                  title="Numaralar"
                  options={numaraSecenekleri}
                  selected={urunForm.numaralar}
                  onToggle={(value) => toggleArrayValue('numaralar', value)}
                />
              )}

              {(urunForm.varyantTipi === 'RENK' ||
                urunForm.varyantTipi === 'BEDEN_RENK' ||
                urunForm.varyantTipi === 'NUMARA_RENK') && (
                <VaryantCheckboxGroup
                  title="Renkler"
                  options={renkSecenekleri}
                  selected={urunForm.renkler}
                  onToggle={(value) => toggleArrayValue('renkler', value)}
                />
              )}

              <div className="rounded-2xl border bg-slate-50 p-4">
                <h4 className="text-sm font-semibold text-slate-700">
                  Oluşacak Varyantlar
                </h4>

                {varyantOnizleme.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">
                    Henüz varyant seçilmedi.
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {varyantOnizleme.map((item) => (
                      <span
                        key={item}
                        className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="space-y-6 p-8">
              <div>
                <h3 className="text-lg font-semibold">Stok Politikası</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Varyant bazlı ilk giriş, minimum stok, kritik stok, depo ve raf
                  bilgileri burada tanımlanır.
                </p>
              </div>

              <div className="rounded-2xl border bg-slate-50 p-4">
                <h4 className="mb-4 text-sm font-semibold text-slate-700">
                  Toplu Değer Atama
                </h4>

                <div className="grid grid-cols-3 gap-4">
                  <BulkApplyInput
                    label="İlk Giriş"
                    value={topluStok.ilkGiris}
                    onChange={(value) =>
                      setTopluStok((current) => ({
                        ...current,
                        ilkGiris: value,
                      }))
                    }
                    onApply={() => applyBulkToAll('ilkGiris')}
                  />

                  <BulkApplyInput
                    label="Minimum Stok"
                    value={topluStok.minStok}
                    onChange={(value) =>
                      setTopluStok((current) => ({
                        ...current,
                        minStok: value,
                      }))
                    }
                    onApply={() => applyBulkToAll('minStok')}
                  />

                  <BulkApplyInput
                    label="Kritik Stok"
                    value={topluStok.kritikStok}
                    onChange={(value) =>
                      setTopluStok((current) => ({
                        ...current,
                        kritikStok: value,
                      }))
                    }
                    onApply={() => applyBulkToAll('kritikStok')}
                  />

                  <BulkApplyInput
                    label="Maksimum Stok"
                    value={topluStok.maxStok}
                    onChange={(value) =>
                      setTopluStok((current) => ({
                        ...current,
                        maxStok: value,
                      }))
                    }
                    onApply={() => applyBulkToAll('maxStok')}
                  />

                  <BulkApplySelect
                    label="Depo"
                    value={topluStok.depo}
                    options={depoSecenekleri}
                    onChange={(value) =>
                      setTopluStok((current) => ({
                        ...current,
                        depo: value,
                      }))
                    }
                    onApply={() => applyBulkToAll('depo')}
                  />

                  <BulkApplyInput
                    label="Raf"
                    value={topluStok.raf}
                    placeholder="Örn: A-01"
                    onChange={(value) =>
                      setTopluStok((current) => ({
                        ...current,
                        raf: value,
                      }))
                    }
                    onApply={() => applyBulkToAll('raf')}
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-3">Varyant</th>
                      <th className="px-3 py-3">İlk Giriş</th>
                      <th className="px-3 py-3">Min</th>
                      <th className="px-3 py-3">Kritik</th>
                      <th className="px-3 py-3">Maks</th>
                      <th className="px-3 py-3">Depo</th>
                      <th className="px-3 py-3">Raf</th>
                      <th className="px-3 py-3">Durum</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 bg-white">
                    {stokAnahtarlari.map((key) => {
                      const row = getStokSatiri(key)

                      return (
                        <tr key={key}>
                          <td className="px-3 py-3 font-medium text-slate-800">
                            {key}
                          </td>
                          <td className="px-3 py-3">
                            <SmallInput
                              value={row.ilkGiris}
                              onChange={(value) =>
                                updateStokSatiri(key, 'ilkGiris', value)
                              }
                            />
                          </td>
                          <td className="px-3 py-3">
                            <SmallInput
                              value={row.minStok}
                              onChange={(value) =>
                                updateStokSatiri(key, 'minStok', value)
                              }
                            />
                          </td>
                          <td className="px-3 py-3">
                            <SmallInput
                              value={row.kritikStok}
                              onChange={(value) =>
                                updateStokSatiri(key, 'kritikStok', value)
                              }
                            />
                          </td>
                          <td className="px-3 py-3">
                            <SmallInput
                              value={row.maxStok}
                              onChange={(value) =>
                                updateStokSatiri(key, 'maxStok', value)
                              }
                            />
                          </td>
                          <td className="px-3 py-3">
                            <select
                              value={row.depo}
                              onChange={(event) =>
                                updateStokSatiri(key, 'depo', event.target.value)
                              }
                              className="h-9 w-40 rounded-lg border px-2"
                            >
                              {depoSecenekleri.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-3">
                            <SmallInput
                              value={row.raf}
                              onChange={(value) =>
                                updateStokSatiri(key, 'raf', value)
                              }
                            />
                          </td>
                          <td className="px-3 py-3">
                            <StockStatus row={row} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <InfoBox>
                Toplam ilk giriş miktarı: <b>{getToplamIlkGiris()}</b>. Gerçek
                veritabanı bağlantısında bu kayıtlar stok hareketi olarak
                oluşturulacak.
              </InfoBox>
            </div>
          )}

         {wizardStep === 3 && (
  <div className="space-y-6 p-8">
    <div>
      <h3 className="text-lg font-semibold">Satın Alma Bilgileri</h3>
      <p className="mt-1 text-sm text-slate-500">
        Tedarikçi, marka, fiyat, termin ve minimum sipariş bilgileri burada tanımlanır.
      </p>
    </div>

    <div className="grid grid-cols-2 gap-6">
      <FormSelect
        label="Tercih Edilen Tedarikçi"
        value={urunForm.tedarikci}
        onChange={(value) => updateForm('tedarikci', value)}
        options={[
          { value: '', label: 'Seçiniz' },
          { value: 'GENEL_SATINALMA', label: 'Genel Satınalma' },
          { value: 'KKD_TEDARIKCI', label: 'KKD Tedarikçisi' },
          { value: 'KIYAFET_TEDARIKCI', label: 'İş Kıyafeti Tedarikçisi' },
          { value: 'KIRTASIYE_TEDARIKCI', label: 'Kırtasiye Tedarikçisi' },
        ]}
      />

      <FormInput
        label="Alternatif Tedarikçi"
        value={urunForm.model}
        placeholder="Opsiyonel"
        onChange={(value) => updateForm('model', value)}
      />

      <FormInput
        label="Marka"
        value={urunForm.marka}
        placeholder="Örn: Delta Plus"
        onChange={(value) => updateForm('marka', value)}
      />

      <FormInput
        label="Üretici / Model"
        value={urunForm.model}
        placeholder="Örn: M1200"
        onChange={(value) => updateForm('model', value)}
      />

      <FormSelect
        label="Satın Alma Birimi"
        value={urunForm.olcuBirimi}
        onChange={(value) => updateForm('olcuBirimi', value)}
        options={[
          { value: 'ADET', label: 'Adet' },
          { value: 'CIFT', label: 'Çift' },
          { value: 'PAKET', label: 'Paket' },
          { value: 'KUTU', label: 'Kutu' },
          { value: 'KG', label: 'Kg' },
          { value: 'LITRE', label: 'Litre' },
        ]}
      />

      <FormInput
        label="Minimum Sipariş Miktarı"
        value={urunForm.minSiparisMiktari}
        placeholder="Örn: 10"
        onChange={(value) => updateForm('minSiparisMiktari', value)}
      />

      <FormInput
        label="Termin Süresi (Gün)"
        value={urunForm.tedarikSuresiGun}
        placeholder="Örn: 15"
        onChange={(value) => updateForm('tedarikSuresiGun', value)}
      />

      <FormInput
        label="Son Alış Fiyatı"
        value={urunForm.sonAlisFiyati}
        placeholder="Örn: 250"
        onChange={(value) => updateForm('sonAlisFiyati', value)}
      />

      <FormSelect
        label="Para Birimi"
        value={urunForm.paraBirimi}
        onChange={(value) => updateForm('paraBirimi', value)}
        options={[
          { value: 'TRY', label: 'TRY' },
          { value: 'EUR', label: 'EUR' },
          { value: 'USD', label: 'USD' },
        ]}
      />

      <FormInput
        label="KDV Oranı"
        value={urunForm.kdvOrani}
        placeholder="Örn: 20"
        onChange={(value) => updateForm('kdvOrani', value)}
      />
    </div>

    <InfoBox>
      Termin süresi sezonluk kıyafet ve KKD alımlarında otomatik sipariş uyarısı için kullanılacak.
    </InfoBox>
  </div>
)}

          {wizardStep === 4 && (
  <div className="space-y-6 p-8">
    <div>
      <h3 className="text-lg font-semibold">Dağıtım Politikası</h3>
      <p className="mt-1 text-sm text-slate-500">
        Ürünün personele nasıl verileceği, kimlerin talep edebileceği ve hangi onayların gerekeceği belirlenir.
      </p>
    </div>

    <div className="grid grid-cols-2 gap-6">
      <FormSelect
        label="Dağıtım Şekli"
        value={urunForm.dagitimSekli}
        onChange={(value) => updateForm('dagitimSekli', value)}
        options={[
          { value: '', label: 'Seçiniz' },
          { value: 'SERBEST', label: 'Serbest' },
          { value: 'PERIYODIK', label: 'Periyodik' },
          { value: 'ESKIYI_GETIR', label: 'Eskiyi getir yeniyi götür' },
          { value: 'ONAYLI', label: 'Yönetici onaylı' },
          { value: 'ILK_GIRIS', label: 'İlk işe girişte ver' },
        ]}
      />

      <FormSelect
        label="Periyot"
        value={urunForm.periyot}
        onChange={(value) => updateForm('periyot', value)}
        options={[
          { value: '', label: 'Yok' },
          { value: 'HAFTALIK', label: 'Haftalık' },
          { value: 'AYLIK', label: 'Aylık' },
          { value: 'ALTI_AYLIK', label: '6 Aylık' },
          { value: 'YILLIK', label: 'Yıllık' },
        ]}
      />

      <FormSelect
        label="Teslim Yetkisi"
        value={urunForm.teslimYetkisi}
        onChange={(value) => updateForm('teslimYetkisi', value)}
        options={[
          { value: '', label: 'Seçiniz' },
          { value: 'IDARI_ISLER', label: 'İdari İşler' },
          { value: 'DEPO', label: 'Depo' },
          { value: 'IK', label: 'İK' },
          { value: 'KALITE', label: 'Kalite' },
          { value: 'SISTEM', label: 'Sistem' },
        ]}
      />

      <FormSelect
        label="Süre Sonu Aksiyonu"
        value={urunForm.sureSonuAksiyonu}
        onChange={(value) => updateForm('sureSonuAksiyonu', value)}
        options={[
          { value: '', label: 'Seçiniz' },
          { value: 'YENI_TALEP', label: 'Yeni talep aç' },
          { value: 'HATIRLATMA', label: 'Hatırlatma gönder' },
          { value: 'IK_BILDIR', label: "İK'ya bildir" },
          { value: 'YONETICI_BILDIR', label: 'Yöneticiye bildir' },
          { value: 'YOK', label: 'İşlem yapma' },
        ]}
      />

      <FormInput
        label="Kullanım Ömrü (Gün)"
        value={urunForm.kullanimOmruGun}
        placeholder="Örn: 180"
        onChange={(value) => updateForm('kullanimOmruGun', value)}
      />
    </div>

    <div>
      <label className="mb-3 block text-sm font-medium">
        Kim Talep Edebilir
      </label>

      <div className="grid grid-cols-4 gap-3">
        {['Çalışan', 'Birim Sorumlusu', 'Müdür', 'İK'].map((item) => (
          <label
            key={item}
            className="flex items-center gap-2 rounded-xl border p-3 text-sm"
          >
            <input
              type="checkbox"
              checked={urunForm.talepEdenRoller.includes(item)}
              onChange={() => toggleArrayValue('talepEdenRoller', item)}
            />
            {item}
          </label>
        ))}
      </div>
    </div>

    <div>
      <label className="mb-3 block text-sm font-medium">
        Kim Onaylar
      </label>

      <div className="grid grid-cols-3 gap-3">
        {['Birim Sorumlusu', 'Müdür', 'İK'].map((item) => (
          <label
            key={item}
            className="flex items-center gap-2 rounded-xl border p-3 text-sm"
          >
            <input
              type="checkbox"
              checked={urunForm.onayAkisi.includes(item)}
              onChange={() => toggleArrayValue('onayAkisi', item)}
            />
            {item}
          </label>
        ))}
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Onay akışı İş Analizi modülündeki sadeleştirilmiş yapı ile uyumludur: Birim Sorumlusu → Müdür → İK.
      </p>
    </div>

    <div>
      <label className="mb-3 block text-sm font-medium">
        Teslim Şartları
      </label>

      <div className="grid grid-cols-3 gap-3">
        <CheckboxField
          label="Eski ürün iadesi zorunlu"
          checked={urunForm.eskiUrunIade}
          onChange={(value) => updateForm('eskiUrunIade', value)}
        />

        <CheckboxField
          label="Yönetici onayı gerekli"
          checked={urunForm.yoneticiOnayi}
          onChange={(value) => updateForm('yoneticiOnayi', value)}
        />

        <CheckboxField
          label="Açıklama zorunlu"
          checked={urunForm.aciklamaZorunlu}
          onChange={(value) => updateForm('aciklamaZorunlu', value)}
        />

        <CheckboxField
          label="Fotoğraf zorunlu"
          checked={urunForm.fotoZorunlu}
          onChange={(value) => updateForm('fotoZorunlu', value)}
        />

        <CheckboxField
          label="Dijital / ıslak imza gerekli"
          checked={urunForm.imzaZorunlu}
          onChange={(value) => updateForm('imzaZorunlu', value)}
        />

        <CheckboxField
          label="QR kod okutma zorunlu"
          checked={urunForm.qrZorunlu}
          onChange={(value) => updateForm('qrZorunlu', value)}
        />

        <CheckboxField
          label="Barkod zorunlu"
          checked={urunForm.barkodZorunlu}
          onChange={(value) => updateForm('barkodZorunlu', value)}
        />
      </div>
    </div>

    <div>
      <label className="mb-2 block text-sm font-medium">
        Dağıtım Kuralı / Açıklama
      </label>

      <textarea
        rows={4}
        value={urunForm.dagitimKurali}
        onChange={(event) => updateForm('dagitimKurali', event.target.value)}
        placeholder="Örn: İş ayakkabısı yalnızca üretim personeline verilir. Süresi dolmadan teslimlerde yönetici onayı zorunludur."
        className="w-full rounded-lg border px-3 py-2"
      />
    </div>

    <InfoBox>
      Bu ekran ürünün teslim, zimmet, iade, onay ve süre sonu kurallarını belirler.
    </InfoBox>
  </div>
)}
          {wizardStep === 5 && (
  <div className="space-y-6 p-8">
    <div>
      <h3 className="text-lg font-semibold">Personel Hedefleme</h3>
      <p className="mt-1 text-sm text-slate-500">
        Ürünün hangi personel grubuna atanacağı, dağıtım tipi ve takip kuralları burada belirlenir.
      </p>
    </div>

    <div className="grid grid-cols-2 gap-6">
      <FormSelect
        label="Hedef Yaka"
        value={urunForm.hedefYaka}
        onChange={(value) => updateForm('hedefYaka', value)}
        options={[
          { value: '', label: 'Tümü' },
          { value: 'MAVI', label: 'Mavi Yaka' },
          { value: 'BEYAZ', label: 'Beyaz Yaka' },
        ]}
      />

      <FormSelect
        label="Hedef Bölüm"
        value={urunForm.hedefBolum}
        onChange={(value) => updateForm('hedefBolum', value)}
        options={[
          { value: '', label: 'Tümü' },
          { value: 'URETIM', label: 'Üretim' },
          { value: 'KALITE', label: 'Kalite' },
          { value: 'BAKIM', label: 'Bakım' },
          { value: 'IDARI_ISLER', label: 'İdari İşler' },
        ]}
      />

      <FormSelect
        label="Hedef Pozisyon"
        value={urunForm.hedefPozisyon}
        onChange={(value) => updateForm('hedefPozisyon', value)}
        options={[
          { value: '', label: 'Tümü' },
          { value: 'OPERATOR', label: 'Operatör' },
          { value: 'TEKNISYEN', label: 'Teknisyen' },
          { value: 'UZMAN', label: 'Uzman' },
          { value: 'MUHENDIS', label: 'Mühendis' },
          { value: 'MUDUR', label: 'Müdür' },
        ]}
      />

      <FormSelect
        label="Lokasyon"
        value={urunForm.hedefLokasyon}
        onChange={(value) => updateForm('hedefLokasyon', value)}
        options={[
          { value: '', label: 'Tümü' },
          { value: 'MERKEZ', label: 'Merkez' },
          { value: 'FABRIKA', label: 'Fabrika' },
          { value: 'DEPO', label: 'Depo' },
        ]}
      />

      <FormSelect
        label="Vardiya"
        value={urunForm.hedefVardiya}
        onChange={(value) => updateForm('hedefVardiya', value)}
        options={[
          { value: '', label: 'Tümü' },
          { value: 'GUNDUZ', label: 'Gündüz' },
          { value: 'VARDIYA_1', label: '1. Vardiya' },
          { value: 'VARDIYA_2', label: '2. Vardiya' },
          { value: 'VARDIYA_3', label: '3. Vardiya' },
        ]}
      />

      <FormSelect
        label="Çalışma Şekli"
        value={urunForm.calismaSekli}
        onChange={(value) => updateForm('calismaSekli', value)}
        options={[
          { value: '', label: 'Tümü' },
          { value: 'TAM_ZAMANLI', label: 'Tam Zamanlı' },
          { value: 'DONEMSEL', label: 'Dönemsel' },
          { value: 'TASERON', label: 'Taşeron' },
        ]}
      />

      <FormSelect
        label="Personel Hedef Tipi"
        value={urunForm.personelHedefTipi}
        onChange={(value) => updateForm('personelHedefTipi', value)}
        options={[
          { value: 'TUM_PERSONEL', label: 'Tüm Personel' },
          { value: 'FILTRE', label: 'Filtreye Uyanlar' },
          { value: 'SECILI', label: 'Tek Tek Personel Seç' },
        ]}
      />

      <FormSelect
        label="Atama Tipi"
        value={urunForm.atamaTipi}
        onChange={(value) => updateForm('atamaTipi', value)}
        options={[
          { value: 'ZORUNLU', label: 'Zorunlu' },
          { value: 'OPSIYONEL', label: 'Opsiyonel' },
          { value: 'TALEPTE', label: 'Talep Edildiğinde' },
          { value: 'ONAYLI', label: 'Yönetici Onayıyla' },
        ]}
      />

      <FormSelect
        label="Tahmini Dağıtım"
        value={urunForm.tahminiDagitim}
        onChange={(value) => updateForm('tahminiDagitim', value)}
        options={[
          { value: '', label: 'Seçiniz' },
          { value: 'BUGUN', label: 'Bugün' },
          { value: 'HAFTAYA', label: 'Önümüzdeki Hafta' },
          { value: 'BELIRLI_TARIH', label: 'Belirli Tarih' },
        ]}
      />

      <FormInput
        label="Sonraki Dağıtım Tarihi"
        value={urunForm.sonrakiDagitimTarihi}
        placeholder="Örn: 01.01.2027"
        onChange={(value) => updateForm('sonrakiDagitimTarihi', value)}
      />
    </div>

    <div className="rounded-2xl border bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-700">
            Personel Listesi
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            Şimdilik demo liste kullanılıyor. API bağlantısında /api/personnel üzerinden beslenecek.
          </p>
        </div>

        <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
          Seçili: {urunForm.seciliPersoneller.length}
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        {demoPersoneller.map((personel) => (
          <label
            key={personel.id}
            className={[
              'flex cursor-pointer items-center justify-between rounded-xl border bg-white p-3 text-sm',
              urunForm.seciliPersoneller.includes(personel.id)
                ? 'border-teal-600 bg-teal-50'
                : 'border-slate-200',
            ].join(' ')}
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={urunForm.seciliPersoneller.includes(personel.id)}
                onChange={() => toggleArrayValue('seciliPersoneller', personel.id)}
              />

              <div>
                <p className="font-medium text-slate-900">{personel.adSoyad}</p>
                <p className="text-xs text-slate-500">
                  {personel.sicilNo} • {personel.bolum} • {personel.gorev}
                </p>
              </div>
            </div>

            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
              {personel.yaka}
            </span>
          </label>
        ))}
      </div>
    </div>

    <InfoBox>
      Bu ürün, seçilen hedefleme kuralına göre personele atanacaktır. Gerçek bağlantıda aktif personel listesi /api/personnel üzerinden alınacak.
    </InfoBox>
  </div>
)}

          {wizardStep === 6 && (
            <div className="space-y-6 p-8">
              <div>
                <h3 className="text-lg font-semibold">Özet ve Kontrol</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Kaydetmeden önce ürün kartı bilgilerini kontrol edin.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 rounded-2xl border bg-slate-50 p-5 text-sm">
                <SummaryItem label="Ürün Kodu" value={urunForm.kod} />
                <SummaryItem label="Ürün Adı" value={urunForm.ad} />
                <SummaryItem label="Kategori" value={urunForm.kategori} />
                <SummaryItem label="Ürün Tipi" value={urunForm.tip} />
                <SummaryItem label="Ölçü Birimi" value={urunForm.olcuBirimi} />
                <SummaryItem
                  label="Varyant Sayısı"
                  value={String(stokAnahtarlari.length)}
                />
                <SummaryItem
                  label="Varyantlar"
                  value={varyantOnizleme.join(', ') || 'Yok'}
                />
                <SummaryItem
                  label="Toplam İlk Giriş"
                  value={String(getToplamIlkGiris())}
                />
                <SummaryItem
                  label="Tedarikçi"
                  value={urunForm.tedarikci || 'Yok'}
                />
                <SummaryItem
                  label="Dağıtım Şekli"
                  value={urunForm.dagitimSekli || 'Yok'}
                />
              </div>

              {saveError ? (
  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
    {saveError}
  </div>
) : (
  <InfoBox>
    Kaydet butonu artık gerçek API'ye bağlandı. Kaydet dediğinizde ürün veritabanına yazılacaktır.
  </InfoBox>
)}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t p-6">
          <button
            type="button"
            disabled={isFirstStep}
            onClick={() => setWizardStep((current) => current - 1)}
            className="rounded-xl border px-5 py-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Geri
          </button>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border px-5 py-2"
            >
              İptal
            </button>

            <button
              type="button"
              disabled={isSaving || (!isLastStep && !canGoNext)}
              onClick={() => {
                if (isLastStep) {
                   handleSave()
                   return

                 }

                 setWizardStep((current) => current + 1)
                }}
              className="rounded-xl bg-teal-700 px-5 py-2 text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLastStep ? (isSaving ? 'Kaydediliyor...' : 'Kaydet') : 'İleri'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function buildVaryantOnizleme(form: UrunForm) {
  if (!form.varyantTipi) return []

  if (form.varyantTipi === 'BEDEN') return form.bedenler
  if (form.varyantTipi === 'NUMARA') return form.numaralar
  if (form.varyantTipi === 'RENK') return form.renkler

  if (form.varyantTipi === 'BEDEN_RENK') {
    return form.bedenler.flatMap((beden) =>
      form.renkler.map((renk) => `${beden} ${renk}`),
    )
  }

  if (form.varyantTipi === 'NUMARA_RENK') {
    return form.numaralar.flatMap((numara) =>
      form.renkler.map((renk) => `${numara} ${renk}`),
    )
  }

  return []
}

function FormInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border px-3 py-2"
      />
    </div>
  )
}

function FormSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border px-3 py-2"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border p-4 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  )
}

function VaryantCheckboxGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string
  options: string[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold text-slate-700">{title}</h4>
      <div className="grid grid-cols-4 gap-3">
        {options.map((option) => (
          <label
            key={option}
            className={[
              'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm',
              selected.includes(option)
                ? 'border-teal-600 bg-teal-50 text-teal-800'
                : 'border-slate-200 bg-white text-slate-700',
            ].join(' ')}
          >
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => onToggle(option)}
            />
            {option}
          </label>
        ))}
      </div>
    </div>
  )
}

function BulkApplyInput({
  label,
  value,
  placeholder,
  onChange,
  onApply,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
  onApply: () => void
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-medium text-slate-600">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-9 flex-1 rounded-lg border px-2 text-sm"
        />
        <button
          type="button"
          onClick={onApply}
          className="rounded-lg border bg-white px-3 text-xs font-medium hover:bg-slate-50"
        >
          Uygula
        </button>
      </div>
    </div>
  )
}

function BulkApplySelect({
  label,
  value,
  options,
  onChange,
  onApply,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  onApply: () => void
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-medium text-slate-600">
        {label}
      </label>
      <div className="flex gap-2">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 flex-1 rounded-lg border px-2 text-sm"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onApply}
          className="rounded-lg border bg-white px-3 text-xs font-medium hover:bg-slate-50"
        >
          Uygula
        </button>
      </div>
    </div>
  )
}

function SmallInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-20 rounded-lg border px-2 text-sm"
    />
  )
}

function StockStatus({ row }: { row: StokSatiri }) {
  const ilkGirisBos = row.ilkGiris.trim() === ''
  const minBos = row.minStok.trim() === ''
  const kritikBos = row.kritikStok.trim() === ''

  if (ilkGirisBos || minBos || kritikBos) {
    return (
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
        Eksik
      </span>
    )
  }

  const mevcut = Number(row.ilkGiris)
  const kritik = Number(row.kritikStok)
  const min = Number(row.minStok)

  if (mevcut <= kritik) {
    return (
      <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
        Kritik
      </span>
    )
  }

  if (mevcut <= min) {
    return (
      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
        Minimum
      </span>
    )
  }

  return (
    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
      Normal
    </span>
  )
}

function InfoBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-800">
      {children}
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900">{value}</p>
    </div>
  )
}

function DurumBadge({ durum }: { durum: UrunDurumu }) {
  if (durum === 'KRITIK') {
    return (
      <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
        Kritik
      </span>
    )
  }

  if (durum === 'PASIF') {
    return (
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
        Pasif
      </span>
    )
  }

  return (
    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
      Normal
    </span>
  )
}

function DashboardCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string
  value: string
  description: string
  icon: ElementType
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
        </div>
        <div className="rounded-xl bg-teal-50 p-2 text-teal-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">{description}</p>
    </div>
  )
}

function PlaceholderContent({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">
        Bu alan sonraki adımda geliştirilecek.
      </p>
    </div>
  )
}

function UrunDetayModal({
  urunId,
  onClose,
}: {
  urunId: string
  onClose: () => void
}) {
  const [urun, setUrun] = useState<EnvanterUrunDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadDetail() {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(`/api/envanter/urunler/${urunId}`)
        const result = await response.json()

        if (!response.ok || !result.ok) {
          throw new Error(result.message || 'Ürün detayı alınamadı.')
        }

        if (!cancelled) {
          setUrun(result.data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Ürün detayı alınamadı.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadDetail()

    return () => {
      cancelled = true
    }
  }, [urunId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="max-h-[88vh] w-full max-w-5xl overflow-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b p-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Ürün Detayı</h2>
            <p className="text-sm text-slate-500">
              Ürün kartı, stok ve hareket bilgileri.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border p-2 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {loading && (
            <div className="rounded-2xl border bg-slate-50 p-6 text-sm text-slate-600">
              Ürün detayı yükleniyor...
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          )}

          {!loading && !error && urun && (
            <>
              <div className="grid grid-cols-2 gap-4 rounded-2xl border bg-slate-50 p-5 text-sm">
                <SummaryItem label="Ürün Kodu" value={urun.kod} />
                <SummaryItem label="Ürün Adı" value={urun.ad} />
                <SummaryItem label="Kategori" value={urun.kategori || 'Yok'} />
                <SummaryItem label="Ürün Tipi" value={urun.tip} />
                <SummaryItem label="Ölçü Birimi" value={urun.olcuBirimi} />
                <SummaryItem label="Tedarikçi" value={urun.tedarikci || 'Yok'} />
                <SummaryItem label="Dağıtım Şekli" value={urun.dagitimSekli || 'Yok'} />
                <SummaryItem label="Periyot" value={urun.periyot || 'Yok'} />
              </div>

              <div className="rounded-2xl border bg-white p-5">
                <h3 className="font-semibold text-slate-900">Stoklar</h3>

                <div className="mt-4 overflow-hidden rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-3">Varyant</th>
                        <th className="px-3 py-3 text-right">Mevcut</th>
                        <th className="px-3 py-3 text-right">Min</th>
                        <th className="px-3 py-3 text-right">Kritik</th>
                        <th className="px-3 py-3">Depo</th>
                        <th className="px-3 py-3">Raf</th>
                        <th className="px-3 py-3">Durum</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {urun.stoklar.map((stok) => (
                        <tr key={stok.id}>
                          <td className="px-3 py-3">{stok.varyantAdi || 'Ana Ürün'}</td>
                          <td className="px-3 py-3 text-right">{stok.mevcut}</td>
                          <td className="px-3 py-3 text-right">{stok.minStok ?? '-'}</td>
                          <td className="px-3 py-3 text-right">{stok.kritikStok ?? '-'}</td>
                          <td className="px-3 py-3">{stok.depo || '-'}</td>
                          <td className="px-3 py-3">{stok.raf || '-'}</td>
                          <td className="px-3 py-3">{stok.durum}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-5">
                <h3 className="font-semibold text-slate-900">Son Hareketler</h3>

                {urun.hareketler.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">
                    Henüz stok hareketi bulunmuyor.
                  </p>
                ) : (
                  <div className="mt-4 space-y-2">
                    {urun.hareketler.map((hareket) => (
                      <div key={hareket.id} className="rounded-xl border bg-slate-50 p-3 text-sm">
                        <div className="font-medium text-slate-900">
                          {hareket.hareketTipi} / {hareket.miktar}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {hareket.aciklama || 'Açıklama yok'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function StokYonetimi() {
  const [urunler, setUrunler] = useState<EnvanterUrunListItem[]>([])
  const [selectedUrunId, setSelectedUrunId] = useState('')
  const [urunDetay, setUrunDetay] = useState<EnvanterUrunDetail | null>(null)
  const [selectedStokId, setSelectedStokId] = useState('')
  const [hareketTipi, setHareketTipi] = useState<'GIRIS' | 'CIKIS' | 'IADE' | 'HURDA' | 'SAYIM_DUZELTME'>('GIRIS')
  const [miktar, setMiktar] = useState('')
  const [aciklama, setAciklama] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadUrunler() {
    const response = await fetch('/api/envanter/urunler')
    const result = await response.json()

    if (result.ok) {
      setUrunler(result.data)

      if (!selectedUrunId && result.data.length > 0) {
        setSelectedUrunId(result.data[0].id)
      }
    }
  }

  async function loadUrunDetay(urunId: string) {
    if (!urunId) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/envanter/urunler/${urunId}`)
      const result = await response.json()

      if (!response.ok || !result.ok) {
        throw new Error(result.message || 'Ürün detayı alınamadı.')
      }

      setUrunDetay(result.data)

      if (result.data.stoklar.length > 0) {
        setSelectedStokId(result.data.stoklar[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ürün detayı alınamadı.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUrunler()
  }, [])

  useEffect(() => {
    if (selectedUrunId) {
      loadUrunDetay(selectedUrunId)
    }
  }, [selectedUrunId])

  async function handleSubmit() {
    setMessage('')
    setError('')

    const miktarNumber = Number(miktar)

    if (!selectedStokId) {
      setError('Stok satırı seçilmelidir.')
      return
    }

    if (!Number.isFinite(miktarNumber) || miktarNumber <= 0) {
      setError('Miktar sıfırdan büyük olmalıdır.')
      return
    }

    setSaving(true)

    try {
      const response = await fetch('/api/envanter/stok-hareket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stokId: selectedStokId,
          hareketTipi,
          miktar: miktarNumber,
          aciklama,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.ok) {
        throw new Error(result.message || 'Stok hareketi kaydedilemedi.')
      }

      setMessage('Stok hareketi başarıyla kaydedildi.')
      setMiktar('')
      setAciklama('')

      await loadUrunler()
      await loadUrunDetay(selectedUrunId)

      window.dispatchEvent(new Event('envanter-urun-kaydedildi'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stok hareketi kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Stok Yönetimi</h2>
        <p className="mt-2 text-sm text-slate-600">
          Stok girişi, çıkışı, iade, hurda ve sayım düzeltme işlemleri bu ekrandan yapılır.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900">Stoklar</h3>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <select
              value={selectedUrunId}
              onChange={(event) => setSelectedUrunId(event.target.value)}
              className="rounded-xl border px-3 py-2 text-sm"
            >
              {urunler.map((urun) => (
                <option key={urun.id} value={urun.id}>
                  {urun.kod} - {urun.ad}
                </option>
              ))}
            </select>
          </div>

          {loading && (
            <div className="mt-6 text-sm text-slate-500">Stok bilgileri yükleniyor...</div>
          )}

          {!loading && urunDetay && (
            <div className="mt-6 overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Seç</th>
                    <th className="px-3 py-3">Varyant</th>
                    <th className="px-3 py-3 text-right">Mevcut</th>
                    <th className="px-3 py-3 text-right">Min</th>
                    <th className="px-3 py-3 text-right">Kritik</th>
                    <th className="px-3 py-3">Depo</th>
                    <th className="px-3 py-3">Durum</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {urunDetay.stoklar.map((stok) => (
                    <tr key={stok.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3">
                        <input
                          type="radio"
                          checked={selectedStokId === stok.id}
                          onChange={() => setSelectedStokId(stok.id)}
                        />
                      </td>
                      <td className="px-3 py-3">{stok.varyantAdi || 'Ana Ürün'}</td>
                      <td className="px-3 py-3 text-right font-medium">{stok.mevcut}</td>
                      <td className="px-3 py-3 text-right">{stok.minStok ?? '-'}</td>
                      <td className="px-3 py-3 text-right">{stok.kritikStok ?? '-'}</td>
                      <td className="px-3 py-3">{stok.depo || '-'}</td>
                      <td className="px-3 py-3">{stok.durum}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          {!loading && urunDetay && (
  <div className="mt-6 rounded-xl border bg-white p-4">
    <h3 className="font-semibold text-slate-900">Son Hareketler</h3>

    {urunDetay.hareketler.length === 0 ? (
      <p className="mt-3 text-sm text-slate-500">
        Henüz stok hareketi bulunmuyor.
      </p>
    ) : (
      <div className="mt-4 space-y-2">
        {urunDetay.hareketler.slice(0, 10).map((hareket) => (
          <div
            key={hareket.id}
            className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2 text-sm"
          >
            <div>
              <div className="font-medium text-slate-900">
                {hareket.hareketTipi} / {hareket.miktar}
              </div>
              <div className="text-xs text-slate-500">
                {hareket.aciklama || 'Açıklama yok'}
              </div>
            </div>

            <div className="text-xs text-slate-500">
              {new Date(hareket.createdAt).toLocaleDateString('tr-TR')}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)}
          <h3 className="font-semibold text-slate-900">Stok Hareketi</h3>

          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Hareket Tipi</label>
              <select
                value={hareketTipi}
                onChange={(event) => setHareketTipi(event.target.value as typeof hareketTipi)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              >
                <option value="GIRIS">Stok Girişi</option>
                <option value="CIKIS">Stok Çıkışı</option>
                <option value="IADE">İade</option>
                <option value="HURDA">Hurda</option>
                <option value="SAYIM_DUZELTME">Sayım Düzeltme</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Miktar</label>
              <input
                value={miktar}
                onChange={(event) => setMiktar(event.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
                placeholder="Örn: 5"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Açıklama</label>
              <textarea
                value={aciklama}
                onChange={(event) => setAciklama(event.target.value)}
                className="min-h-24 w-full rounded-xl border px-3 py-2 text-sm"
                placeholder="İşlem açıklaması"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            {message && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                {message}
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="w-full rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {saving ? 'Kaydediliyor...' : 'Stok Hareketini Kaydet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

type PersonelZimmetItem = {
  id: string
  miktar: number
  teslimTarihi: string
  iadeTarihi: string | null
  durum: 'AKTIF' | 'IADE_EDILDI' | 'IPTAL'
  aciklama: string | null
  urun: {
    kod: string
    ad: string
    olcuBirimi: string
  }
  stok: {
    depo: string | null
    raf: string | null
    varyant: { varyantAdi: string } | null
  }
}

function PersonelZimmeti() {
  const [personeller, setPersoneller] = useState<any[]>([])
  const [urunler, setUrunler] = useState<EnvanterUrunListItem[]>([])

  const [selectedPersonel, setSelectedPersonel] = useState('')
  const [selectedUrun, setSelectedUrun] = useState('')

  const [urunDetay, setUrunDetay] = useState<EnvanterUrunDetail | null>(null)
  const [selectedStokId, setSelectedStokId] = useState('')
  const [stokLoading, setStokLoading] = useState(false)

  const [personelZimmetleri, setPersonelZimmetleri] = useState<PersonelZimmetItem[]>([])
  const [zimmetlerLoading, setZimmetlerLoading] = useState(false)

  const [loading, setLoading] = useState(true)

  const [miktar, setMiktar] = useState(1)
  const [aciklama, setAciklama] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    try {
      const [personelRes, urunRes] = await Promise.all([
        fetch('/api/envanter/personeller'),
        fetch('/api/envanter/urunler'),
      ])

      const personellerJson = await personelRes.json()
      const urunlerJson = await urunRes.json()

      if (personellerJson.ok) setPersoneller(personellerJson.data)
      if (urunlerJson.ok) setUrunler(urunlerJson.data)
    } finally {
      setLoading(false)
    }
  }

  async function loadUrunDetay(urunId: string) {
    if (!urunId) {
      setUrunDetay(null)
      return
    }

    setStokLoading(true)

    try {
      const response = await fetch(`/api/envanter/urunler/${urunId}`)
      const result = await response.json()

      if (result.ok) {
        setUrunDetay(result.data)
        setSelectedStokId(result.data.stoklar.length === 1 ? result.data.stoklar[0].id : '')
      } else {
        setUrunDetay(null)
      }
    } finally {
      setStokLoading(false)
    }
  }

  useEffect(() => {
    setSelectedStokId('')
    setUrunDetay(null)

    if (selectedUrun) {
      loadUrunDetay(selectedUrun)
    }
  }, [selectedUrun])

  async function loadPersonelZimmetleri(personnelId: string) {
    if (!personnelId) {
      setPersonelZimmetleri([])
      return
    }

    setZimmetlerLoading(true)

    try {
      const response = await fetch(
        `/api/envanter/zimmet?personnelId=${personnelId}`,
      )
      const result = await response.json()

      setPersonelZimmetleri(result.ok ? result.data : [])
    } finally {
      setZimmetlerLoading(false)
    }
  }

  useEffect(() => {
    if (selectedPersonel) {
      loadPersonelZimmetleri(selectedPersonel)
    } else {
      setPersonelZimmetleri([])
    }
  }, [selectedPersonel])

  function stokEtiket(stok: EnvanterUrunDetail['stoklar'][number]) {
    const parcalar = [stok.varyantAdi, stok.depo, stok.raf].filter(Boolean)
    const konum = parcalar.length > 0 ? parcalar.join(' — ') : 'Genel Stok'
    return `${konum} — Mevcut: ${stok.mevcut}`
  }

  const aktifZimmetler = personelZimmetleri.filter((zimmet) => zimmet.durum === 'AKTIF')
  const gecmisZimmetler = personelZimmetleri.filter((zimmet) => zimmet.durum !== 'AKTIF')

  async function handleZimmet() {
    setMessage('')
    setError('')

    if (!selectedPersonel || !selectedStokId) {
      setError('Personel ve stok satırı seçiniz.')
      return
    }

    setSaving(true)

    try {
      const res = await fetch('/api/envanter/zimmet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personnelId: selectedPersonel,
          stokId: selectedStokId,
          miktar,
          aciklama,
        }),
      })

      const json = await res.json()

      if (json.ok) {
        setMessage('Zimmet oluşturuldu.')
        setAciklama('')
        setMiktar(1)
        await loadUrunDetay(selectedUrun)
        await loadPersonelZimmetleri(selectedPersonel)
      } else {
        setError(json.message || 'Zimmet oluşturulamadı.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zimmet oluşturulamadı.')
    } finally {
      setSaving(false)
    }
  }

  async function handleIadeSonrasi() {
    await loadPersonelZimmetleri(selectedPersonel)
    await loadUrunDetay(selectedUrun)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Personel Zimmeti</h2>
        <p className="mt-2 text-sm text-slate-500">
          Personellere KKD ve ekipman zimmetleme ekranı.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-2xl border bg-white p-6">
          {loading ? (
            <p className="text-sm text-slate-500">Veriler yükleniyor...</p>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Personel</label>
                <select
                  className="mt-1 w-full rounded-xl border p-2"
                  value={selectedPersonel}
                  onChange={(e) => setSelectedPersonel(e.target.value)}
                >
                  <option value="">Personel seçiniz</option>
                  {personeller.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sicilNo} - {p.adSoyad}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Ürün</label>
                <select
                  className="mt-1 w-full rounded-xl border p-2"
                  value={selectedUrun}
                  onChange={(e) => setSelectedUrun(e.target.value)}
                >
                  <option value="">Ürün seçiniz</option>
                  {urunler.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.kod} - {u.ad}
                    </option>
                  ))}
                </select>
              </div>

              {selectedUrun && (
                <div>
                  <label className="text-sm font-medium">Stok Satırı</label>
                  {stokLoading ? (
                    <p className="mt-1 text-sm text-slate-500">Stoklar yükleniyor...</p>
                  ) : (
                    <select
                      className="mt-1 w-full rounded-xl border p-2"
                      value={selectedStokId}
                      onChange={(e) => setSelectedStokId(e.target.value)}
                    >
                      <option value="">Stok satırı seçiniz</option>
                      {(urunDetay?.stoklar ?? []).map((stok) => (
                        <option key={stok.id} value={stok.id} disabled={stok.mevcut <= 0}>
                          {stokEtiket(stok)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div>
  <label className="text-sm font-medium">Miktar</label>
  <input
    type="number"
    min={1}
    value={miktar}
    onChange={(e) => setMiktar(Number(e.target.value))}
    className="mt-1 w-full rounded-xl border p-2"
  />
</div>

<div>
  <label className="text-sm font-medium">Açıklama</label>
  <textarea
    value={aciklama}
    onChange={(e) => setAciklama(e.target.value)}
    className="mt-1 min-h-24 w-full rounded-xl border p-2"
    placeholder="Teslim açıklaması"
  />
</div>

<button
  type="button"
  onClick={handleZimmet}
  disabled={saving}
  className="w-full rounded-xl bg-teal-700 py-2 text-white hover:bg-teal-800 disabled:opacity-60"
>
  {saving ? 'Kaydediliyor...' : 'Zimmet Oluştur'}
</button>

{error && (
  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
    {error}
  </div>
)}

{message && (
  <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
    {message}
  </div>
)}
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-white p-6">
          {!selectedPersonel ? (
            <div className="text-sm text-slate-500">
              Personel seçildiğinde aktif zimmetleri, geçmiş teslimleri ve bekleyen iadeleri burada gösterilecek.
            </div>
          ) : zimmetlerLoading ? (
            <p className="text-sm text-slate-500">Yükleniyor...</p>
          ) : personelZimmetleri.length === 0 ? (
            <p className="text-sm text-slate-500">Bu personele ait zimmet kaydı yok.</p>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-slate-900">Aktif Zimmetler</h3>

                {aktifZimmetler.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">Aktif zimmet yok.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {aktifZimmetler.map((zimmet) => (
                      <ZimmetSatiri key={zimmet.id} zimmet={zimmet} onIadeAlindi={handleIadeSonrasi} />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-semibold text-slate-900">Geçmiş</h3>

                {gecmisZimmetler.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">Geçmiş zimmet kaydı yok.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {gecmisZimmetler.map((zimmet) => (
                      <ZimmetSatiri key={zimmet.id} zimmet={zimmet} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ZimmetDurumBadge({ durum }: { durum: PersonelZimmetItem['durum'] }) {
  if (durum === 'AKTIF') {
    return (
      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        Aktif
      </span>
    )
  }

  if (durum === 'IPTAL') {
    return (
      <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
        İptal
      </span>
    )
  }

  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
      İade Edildi
    </span>
  )
}

function ZimmetSatiri({
  zimmet,
  onIadeAlindi,
}: {
  zimmet: PersonelZimmetItem
  onIadeAlindi?: () => Promise<void> | void
}) {
  const konum = [zimmet.stok.varyant?.varyantAdi, zimmet.stok.depo, zimmet.stok.raf]
    .filter(Boolean)
    .join(' — ')

  const [iadeAcik, setIadeAcik] = useState(false)
  const [iadeMiktar, setIadeMiktar] = useState(zimmet.miktar)
  const [iadeAciklama, setIadeAciklama] = useState('')
  const [iadeSaving, setIadeSaving] = useState(false)
  const [iadeError, setIadeError] = useState('')
  const [iadeMessage, setIadeMessage] = useState('')

  useEffect(() => {
    setIadeMiktar(zimmet.miktar)
  }, [zimmet.miktar])

  async function handleIade() {
    setIadeError('')
    setIadeMessage('')

    if (!Number.isFinite(iadeMiktar) || iadeMiktar < 1 || iadeMiktar > zimmet.miktar) {
      setIadeError(`İade miktarı 1 ile ${zimmet.miktar} arasında olmalıdır.`)
      return
    }

    setIadeSaving(true)

    try {
      const res = await fetch('/api/envanter/zimmet/iade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          zimmetId: zimmet.id,
          iadeMiktar,
          aciklama: iadeAciklama,
        }),
      })

      const json = await res.json()

      if (json.ok) {
        setIadeMessage('İade alındı.')
        setIadeAciklama('')
        await onIadeAlindi?.()
      } else {
        setIadeError(json.message || 'İade alınamadı.')
      }
    } catch (err) {
      setIadeError(err instanceof Error ? err.message : 'İade alınamadı.')
    } finally {
      setIadeSaving(false)
    }
  }

  return (
    <div className="rounded-xl border bg-slate-50 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-slate-900">
          {zimmet.urun.kod} - {zimmet.urun.ad}
        </div>
        <ZimmetDurumBadge durum={zimmet.durum} />
      </div>

      <div className="mt-1 text-xs text-slate-500">
        {zimmet.miktar} {zimmet.urun.olcuBirimi}
        {konum ? ` — ${konum}` : ''}
      </div>

      <div className="mt-1 text-xs text-slate-500">
        Teslim: {new Date(zimmet.teslimTarihi).toLocaleDateString('tr-TR')}
        {zimmet.iadeTarihi && (
          <> · İade: {new Date(zimmet.iadeTarihi).toLocaleDateString('tr-TR')}</>
        )}
      </div>

      {zimmet.aciklama && (
        <div className="mt-1 text-xs text-slate-500">{zimmet.aciklama}</div>
      )}

      {zimmet.durum === 'AKTIF' && (
        <div className="mt-2">
          {!iadeAcik ? (
            <button
              type="button"
              onClick={() => setIadeAcik(true)}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              İade Al
            </button>
          ) : (
            <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
              <div>
                <label className="text-xs font-medium text-slate-600">İade Miktarı</label>
                <input
                  type="number"
                  min={1}
                  max={zimmet.miktar}
                  value={iadeMiktar}
                  onChange={(e) => setIadeMiktar(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border p-1.5 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Açıklama (opsiyonel)</label>
                <input
                  value={iadeAciklama}
                  onChange={(e) => setIadeAciklama(e.target.value)}
                  className="mt-1 w-full rounded-lg border p-1.5 text-sm"
                  placeholder="İade açıklaması"
                />
              </div>

              {iadeError && (
                <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{iadeError}</div>
              )}

              {iadeMessage && (
                <div className="rounded-lg bg-green-50 p-2 text-xs text-green-700">{iadeMessage}</div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleIade}
                  disabled={iadeSaving}
                  className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                >
                  {iadeSaving ? 'Kaydediliyor...' : 'Onayla'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIadeAcik(false)
                    setIadeError('')
                    setIadeMessage('')
                  }}
                  disabled={iadeSaving}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
                >
                  Vazgeç
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

type KategoriItem = {
  id: string
  ad: string
  yenilemePeriyoduAy: number | null
  minStokVarsayilan: number | null
  not: string | null
  durum: 'AKTIF' | 'PASIF' | 'ARSIV'
}

function ParametrelerYonetimi() {
  const [kategoriler, setKategoriler] = useState<KategoriItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [showNewForm, setShowNewForm] = useState(false)
  const [newAd, setNewAd] = useState('')
  const [newPeriyot, setNewPeriyot] = useState('')
  const [newMinStok, setNewMinStok] = useState('')
  const [newNot, setNewNot] = useState('')
  const [newSaving, setNewSaving] = useState(false)

  const [editingId, setEditingId] = useState('')
  const [editAd, setEditAd] = useState('')
  const [editPeriyot, setEditPeriyot] = useState('')
  const [editMinStok, setEditMinStok] = useState('')
  const [editNot, setEditNot] = useState('')
  const [editDurum, setEditDurum] = useState<KategoriItem['durum']>('AKTIF')
  const [editSaving, setEditSaving] = useState(false)

  const [sezonParamLoading, setSezonParamLoading] = useState(true)
  const [sezonParamError, setSezonParamError] = useState('')
  const [sezonParamMessage, setSezonParamMessage] = useState('')
  const [sezonParamSaving, setSezonParamSaving] = useState(false)
  const [turnoverInput, setTurnoverInput] = useState('0')
  const [emniyetInput, setEmniyetInput] = useState('0')
  const [sezonParamNot, setSezonParamNot] = useState('')
  const [turnoverOnerisi, setTurnoverOnerisi] = useState<TurnoverOranOnerisi | null>(null)

  useEffect(() => {
    loadKategoriler()
    loadSezonParametre()
    loadTurnoverOnerisi()
  }, [])

  async function loadSezonParametre() {
    setSezonParamLoading(true)
    try {
      const res = await fetch('/api/envanter/sezon-parametre')
      const json = await res.json()
      if (json.ok) {
        const parametre: SezonParametre = json.data
        setTurnoverInput(String(parametre.turnoverOrani))
        setEmniyetInput(String(parametre.emniyetPayiOrani))
        setSezonParamNot(parametre.not ?? '')
      }
    } finally {
      setSezonParamLoading(false)
    }
  }

  async function loadTurnoverOnerisi() {
    try {
      const res = await fetch('/api/envanter/sezon/oneriler')
      const json = await res.json()
      if (json.ok) setTurnoverOnerisi(json.data.turnoverOranOnerisi)
    } catch {
      // Öneri bilgisi opsiyonel — sessizce geç.
    }
  }

  async function handleSezonParametreKaydet() {
    setSezonParamError('')
    setSezonParamMessage('')

    const turnoverOrani = Number(turnoverInput)
    const emniyetPayiOrani = Number(emniyetInput)

    if (!Number.isFinite(turnoverOrani) || turnoverOrani < 0) {
      setSezonParamError('Turnover oranı geçerli bir sayı olmalıdır.')
      return
    }
    if (!Number.isFinite(emniyetPayiOrani) || emniyetPayiOrani < 0) {
      setSezonParamError('Emniyet payı oranı geçerli bir sayı olmalıdır.')
      return
    }

    setSezonParamSaving(true)
    try {
      const res = await fetch('/api/envanter/sezon-parametre', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turnoverOrani, emniyetPayiOrani, not: sezonParamNot || null }),
      })
      const json = await res.json()
      if (json.ok) {
        setSezonParamMessage('Parametreler kaydedildi.')
      } else {
        setSezonParamError(json.message || 'Parametreler kaydedilemedi.')
      }
    } catch (err) {
      setSezonParamError(err instanceof Error ? err.message : 'Parametreler kaydedilemedi.')
    } finally {
      setSezonParamSaving(false)
    }
  }

  function handleTurnoverOnerisiniKullan() {
    if (turnoverOnerisi) setTurnoverInput(String(turnoverOnerisi.value))
  }

  async function loadKategoriler() {
    setLoading(true)

    try {
      const response = await fetch('/api/envanter/kategoriler')
      const result = await response.json()

      if (result.ok) setKategoriler(result.data)
    } finally {
      setLoading(false)
    }
  }

  async function handleYeniKategori() {
    setError('')
    setMessage('')

    if (!newAd.trim()) {
      setError('Kategori adı zorunludur.')
      return
    }

    setNewSaving(true)

    try {
      const res = await fetch('/api/envanter/kategoriler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ad: newAd,
          yenilemePeriyoduAy: newPeriyot,
          minStokVarsayilan: newMinStok,
          not: newNot,
        }),
      })

      const json = await res.json()

      if (json.ok) {
        setMessage('Kategori oluşturuldu.')
        setNewAd('')
        setNewPeriyot('')
        setNewMinStok('')
        setNewNot('')
        setShowNewForm(false)
        await loadKategoriler()
      } else {
        setError(json.message || 'Kategori oluşturulamadı.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kategori oluşturulamadı.')
    } finally {
      setNewSaving(false)
    }
  }

  function startEdit(kategori: KategoriItem) {
    setError('')
    setMessage('')
    setEditingId(kategori.id)
    setEditAd(kategori.ad)
    setEditPeriyot(kategori.yenilemePeriyoduAy?.toString() ?? '')
    setEditMinStok(kategori.minStokVarsayilan?.toString() ?? '')
    setEditNot(kategori.not ?? '')
    setEditDurum(kategori.durum)
  }

  function cancelEdit() {
    setEditingId('')
  }

  async function saveEdit() {
    setError('')
    setMessage('')

    if (!editAd.trim()) {
      setError('Kategori adı zorunludur.')
      return
    }

    setEditSaving(true)

    try {
      const res = await fetch('/api/envanter/kategoriler', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingId,
          ad: editAd,
          yenilemePeriyoduAy: editPeriyot,
          minStokVarsayilan: editMinStok,
          not: editNot,
          durum: editDurum,
        }),
      })

      const json = await res.json()

      if (json.ok) {
        setMessage('Kategori güncellendi.')
        setEditingId('')
        await loadKategoriler()
      } else {
        setError(json.message || 'Kategori güncellenemedi.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kategori güncellenemedi.')
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Parametreler</h2>
            <p className="mt-2 text-sm text-slate-500">
              KKD grubu / kategori tanımları — yenileme periyodu ve varsayılan min stok.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowNewForm((prev) => !prev)}
            className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            {showNewForm ? 'Vazgeç' : 'Yeni Kategori'}
          </button>
        </div>

        {showNewForm && (
          <div className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Ad</label>
              <input
                value={newAd}
                onChange={(e) => setNewAd(e.target.value)}
                className="mt-1 w-full rounded-xl border p-2 text-sm"
                placeholder="Örn: ELDİVEN"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Yenileme Periyodu (Ay)</label>
              <input
                type="number"
                min={0}
                value={newPeriyot}
                onChange={(e) => setNewPeriyot(e.target.value)}
                className="mt-1 w-full rounded-xl border p-2 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Min Stok Varsayılanı</label>
              <input
                type="number"
                min={0}
                value={newMinStok}
                onChange={(e) => setNewMinStok(e.target.value)}
                className="mt-1 w-full rounded-xl border p-2 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Not</label>
              <input
                value={newNot}
                onChange={(e) => setNewNot(e.target.value)}
                className="mt-1 w-full rounded-xl border p-2 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="button"
                onClick={handleYeniKategori}
                disabled={newSaving}
                className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {newSaving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {message && (
          <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</div>
        )}
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">Yükleniyor...</p>
        ) : kategoriler.length === 0 ? (
          <p className="text-sm text-slate-500">Henüz kategori tanımlanmamış.</p>
        ) : (
          <div className="overflow-hidden overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Ad</th>
                  <th className="px-3 py-3 text-right">Yenileme Periyodu (Ay)</th>
                  <th className="px-3 py-3 text-right">Min Stok Varsayılanı</th>
                  <th className="px-3 py-3">Not</th>
                  <th className="px-3 py-3">Durum</th>
                  <th className="px-3 py-3">Düzenle</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {kategoriler.map((kategori) => {
                  const isEditing = editingId === kategori.id
                  const isPasif = kategori.durum === 'PASIF'

                  if (isEditing) {
                    return (
                      <tr key={kategori.id} className="bg-slate-50">
                        <td className="px-3 py-2">
                          <input
                            value={editAd}
                            onChange={(e) => setEditAd(e.target.value)}
                            className="w-full rounded-lg border p-1.5 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            value={editPeriyot}
                            onChange={(e) => setEditPeriyot(e.target.value)}
                            className="w-full rounded-lg border p-1.5 text-right text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            value={editMinStok}
                            onChange={(e) => setEditMinStok(e.target.value)}
                            className="w-full rounded-lg border p-1.5 text-right text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={editNot}
                            onChange={(e) => setEditNot(e.target.value)}
                            className="w-full rounded-lg border p-1.5 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={editDurum}
                            onChange={(e) => setEditDurum(e.target.value as KategoriItem['durum'])}
                            className="w-full rounded-lg border p-1.5 text-sm"
                          >
                            <option value="AKTIF">Aktif</option>
                            <option value="PASIF">Pasif</option>
                            <option value="ARSIV">Arşiv</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={saveEdit}
                              disabled={editSaving}
                              className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                            >
                              {editSaving ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={editSaving}
                              className="rounded-lg border px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
                            >
                              Vazgeç
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={kategori.id} className={isPasif ? 'bg-slate-50 text-slate-400' : ''}>
                      <td className="px-3 py-3 font-medium text-slate-900">
                        <span className={isPasif ? 'text-slate-400' : ''}>{kategori.ad}</span>
                      </td>
                      <td className="px-3 py-3 text-right">{kategori.yenilemePeriyoduAy ?? '-'}</td>
                      <td className="px-3 py-3 text-right">{kategori.minStokVarsayilan ?? '-'}</td>
                      <td className="px-3 py-3">{kategori.not || '-'}</td>
                      <td className="px-3 py-3">
                        {kategori.durum === 'PASIF' ? (
                          <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">
                            Pasif
                          </span>
                        ) : kategori.durum === 'ARSIV' ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                            Arşiv
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            Aktif
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => startEdit(kategori)}
                          className="rounded-lg border px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                        >
                          Düzenle
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold">Sezon Planlama Parametreleri</h2>
          <p className="mt-2 text-sm text-slate-500">
            Bu değerler tüm sezon planlarında varsayılan olarak kullanılır. Plan bazında ayrıca
            değiştirilebilir.
          </p>
        </div>

        {sezonParamLoading ? (
          <p className="mt-4 text-sm text-slate-500">Yükleniyor...</p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Turnover Oranı (%)</label>
              <input
                type="number"
                min={0}
                step="0.1"
                value={turnoverInput}
                onChange={(e) => setTurnoverInput(e.target.value)}
                className="mt-1 w-full rounded-xl border p-2 text-sm"
              />
              {turnoverOnerisi && (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>
                    Öneri: %{turnoverOnerisi.value.toLocaleString('tr-TR')} (son 12 ayda{' '}
                    {turnoverOnerisi.ayrilanSayisi} ayrılan / ortalama{' '}
                    {turnoverOnerisi.ortalamaHeadcount.toLocaleString('tr-TR')} kişi)
                  </span>
                  <button
                    type="button"
                    onClick={handleTurnoverOnerisiniKullan}
                    className="rounded-lg border px-2 py-0.5 font-medium text-teal-700 hover:bg-teal-50"
                  >
                    Öneriyi Kullan
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Emniyet Payı (%)</label>
              <input
                type="number"
                min={0}
                step="0.1"
                value={emniyetInput}
                onChange={(e) => setEmniyetInput(e.target.value)}
                className="mt-1 w-full rounded-xl border p-2 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium">Not</label>
              <textarea
                value={sezonParamNot}
                onChange={(e) => setSezonParamNot(e.target.value)}
                className="mt-1 min-h-20 w-full rounded-xl border p-2 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="button"
                onClick={handleSezonParametreKaydet}
                disabled={sezonParamSaving}
                className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {sezonParamSaving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        )}

        {sezonParamError && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{sezonParamError}</div>
        )}
        {sezonParamMessage && (
          <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            {sezonParamMessage}
          </div>
        )}
      </div>
    </div>
  )
}

function VeriAktarimi() {
  const [file, setFile] = useState<File | null>(null)
  const [zimmetleriHistorikAktar, setZimmetleriHistorikAktar] = useState(true)

  const [validating, setValidating] = useState(false)
  const [executing, setExecuting] = useState(false)

  const [rapor, setRapor] = useState<ValidateSonuc | null>(null)
  const [executeSonuc, setExecuteSonuc] = useState<ExecuteSonuc | null>(null)
  const [error, setError] = useState('')

  function handleDosyaSec(event: React.ChangeEvent<HTMLInputElement>) {
    const secilen = event.target.files?.[0] ?? null
    setFile(secilen)
    setRapor(null)
    setExecuteSonuc(null)
    setError('')
  }

  async function handleDogrula() {
    if (!file) {
      setError('Önce bir .xlsx dosyası seçiniz.')
      return
    }

    setValidating(true)
    setError('')
    setExecuteSonuc(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('mode', 'validate')

      const res = await fetch('/api/envanter/import', {
        method: 'POST',
        body: formData,
      })

      const json = await res.json()

      if (json.ok) {
        setRapor(json.data)
      } else {
        setError(json.message || 'Doğrulama başarısız oldu.')
        if (json.data) setRapor(json.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Doğrulama başarısız oldu.')
    } finally {
      setValidating(false)
    }
  }

  async function handleIceriAktar() {
    if (!file || !rapor || rapor.hatalar.length > 0) return

    setExecuting(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('mode', 'execute')
      formData.append('zimmetleriHistorikAktar', zimmetleriHistorikAktar ? 'true' : 'false')

      const res = await fetch('/api/envanter/import', {
        method: 'POST',
        body: formData,
      })

      const json = await res.json()

      if (json.ok) {
        setExecuteSonuc(json.data)
      } else {
        setError(json.message || 'İçeri aktarım başarısız oldu.')
        if (json.data) setRapor(json.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İçeri aktarım başarısız oldu.')
    } finally {
      setExecuting(false)
    }
  }

  const iceriAktarAktif = !!rapor && rapor.hatalar.length === 0 && !executing && !validating

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Veri Aktarımı</h2>
        <p className="mt-2 text-sm text-slate-500">
          Excel şablonuyla toplu ürün / varyant / stok / zimmet geçmişi aktarımı. Önce
          "Doğrula" ile rapor alın, hata yoksa "İçeri Aktar" ile veriyi işleyin.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="text-sm font-medium">Excel Dosyası (.xlsx)</label>
            <input
              type="file"
              accept=".xlsx"
              onChange={handleDosyaSec}
              className="mt-1 block rounded-xl border p-2 text-sm"
            />
          </div>

          <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={zimmetleriHistorikAktar}
              onChange={(e) => setZimmetleriHistorikAktar(e.target.checked)}
            />
            ZimmetGecmisi sayfasını da aktar
          </label>

          <button
            type="button"
            onClick={handleDogrula}
            disabled={!file || validating}
            className="rounded-xl border border-teal-700 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-60"
          >
            {validating ? 'Doğrulanıyor...' : 'Doğrula'}
          </button>

          <button
            type="button"
            onClick={handleIceriAktar}
            disabled={!iceriAktarAktif}
            className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {executing ? 'Aktarılıyor...' : 'İçeri Aktar'}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {executeSonuc && (
          <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            İçeri aktarım tamamlandı — Yeni ürün: {executeSonuc.yeniUrun}, Güncellenen ürün:{' '}
            {executeSonuc.guncellenecekUrun}, Varyant: {executeSonuc.varyant}, Stok:{' '}
            {executeSonuc.stok}. ZimmetGecmisi: {executeSonuc.zimmet} kayıt aktarıldı,{' '}
            {executeSonuc.atlananZimmet} satır atlandı.
          </div>
        )}

        {executeSonuc && executeSonuc.zimmetAtlananlar.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-slate-600">
              Atlanan ZimmetGecmisi Satırları ({executeSonuc.zimmetAtlananlar.length})
            </h3>
            <ImportAtlananTablosu satirlar={executeSonuc.zimmetAtlananlar} />
          </div>
        )}
      </div>

      {rapor && (
        <>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            <DashboardCard
              title="Yeni Ürün"
              value={String(rapor.ozet.yeniUrun)}
              description="Sistemde olmayan ürün"
              icon={Package}
            />
            <DashboardCard
              title="Güncellenecek Ürün"
              value={String(rapor.ozet.guncellenecekUrun)}
              description="urunKodu eşleşen mevcut ürün"
              icon={Package}
            />
            <DashboardCard
              title="Varyant"
              value={String(rapor.ozet.varyant)}
              description="Geçerli varyant satırı"
              icon={Boxes}
            />
            <DashboardCard
              title="Stok"
              value={String(rapor.ozet.stok)}
              description="Geçerli stok satırı"
              icon={Warehouse}
            />
            <DashboardCard
              title="Zimmet"
              value={String(rapor.ozet.zimmet)}
              description="Geçerli zimmet geçmişi satırı"
              icon={UserCheck}
            />
          </div>

          {rapor.hatalar.length > 0 && (
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-rose-700">Hatalar ({rapor.hatalar.length})</h3>
              <ImportRaporTablosu satirlar={rapor.hatalar} renk="rose" />
            </div>
          )}

          {rapor.uyarilar.length > 0 && (
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-amber-700">Uyarılar ({rapor.uyarilar.length})</h3>
              <ImportRaporTablosu satirlar={rapor.uyarilar} renk="amber" />
            </div>
          )}

          {rapor.atlananlar.length > 0 && (
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-slate-600">
                Atlanacak Satırlar ({rapor.atlananlar.length})
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Bu satırlar importu engellemez; sadece ZimmetGecmisi'nde eşleşmedikleri için
                atlanır.
              </p>
              <ImportAtlananTablosu satirlar={rapor.atlananlar} />
            </div>
          )}

          {rapor.ozet.eslesmeyenSicil.length > 0 && (
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-amber-700">
                Eşleşmeyen Sicil No ({rapor.ozet.eslesmeyenSicil.length})
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {rapor.ozet.eslesmeyenSicil.map((sicil) => (
                  <span
                    key={sicil}
                    className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700"
                  >
                    {sicil}
                  </span>
                ))}
              </div>
            </div>
          )}

          {rapor.hatalar.length === 0 && (
            <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              Hata bulunamadı — "İçeri Aktar" ile devam edebilirsiniz.
              {rapor.ozet.atlananZimmet > 0 && (
                <>
                  {' '}
                  ({rapor.ozet.atlananZimmet} ZimmetGecmisi satırı eşleşmediği için atlanacak.)
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ImportRaporTablosu({
  satirlar,
  renk,
}: {
  satirlar: ImportHata[]
  renk: 'rose' | 'amber'
}) {
  const baslikRenk = renk === 'rose' ? 'text-rose-700' : 'text-amber-700'

  return (
    <div className="mt-3 overflow-hidden overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
          <tr>
            <th className="px-3 py-3">Sayfa</th>
            <th className="px-3 py-3 text-right">Satır</th>
            <th className="px-3 py-3">Alan</th>
            <th className="px-3 py-3">Mesaj</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {satirlar.map((satir, i) => (
            <tr key={i}>
              <td className="px-3 py-3">{satir.sayfa}</td>
              <td className="px-3 py-3 text-right">{satir.satirNo || '-'}</td>
              <td className="px-3 py-3">{satir.alan || '-'}</td>
              <td className={`px-3 py-3 ${baslikRenk}`}>{satir.mesaj}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ImportAtlananTablosu({ satirlar }: { satirlar: ImportAtlanan[] }) {
  return (
    <div className="mt-3 overflow-hidden overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
          <tr>
            <th className="px-3 py-3">Sayfa</th>
            <th className="px-3 py-3 text-right">Satır</th>
            <th className="px-3 py-3">Sebep</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {satirlar.map((satir, i) => (
            <tr key={i}>
              <td className="px-3 py-3">{satir.sayfa}</td>
              <td className="px-3 py-3 text-right">{satir.satirNo || '-'}</td>
              <td className="px-3 py-3 text-amber-700">{satir.sebep}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function YenilemeDurumBadge({ durum }: { durum: YenilemeDurum }) {
  if (durum === 'GECIKMIS') {
    return (
      <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
        Gecikmiş
      </span>
    )
  }

  if (durum === 'YAKLASIYOR') {
    return (
      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
        Yaklaşıyor
      </span>
    )
  }

  if (durum === 'PERIYOT_YOK') {
    return (
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
        Periyot Yok
      </span>
    )
  }

  if (durum === 'TARIH_BELIRSIZ') {
    return (
      <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
        Tarih Belirsiz
      </span>
    )
  }

  return (
    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
      Güncel
    </span>
  )
}

function RaporlarYonetimi() {
  const [veriler, setVeriler] = useState<YenilemeSatiri[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedBolum, setSelectedBolum] = useState('')
  const [selectedDurum, setSelectedDurum] = useState<YenilemeDurum | ''>('')

  useEffect(() => {
    loadVeriler()
  }, [])

  async function loadVeriler() {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/envanter/yenileme')
      const result = await response.json()

      if (result.ok) {
        setVeriler(result.data)
      } else {
        setError(result.message || 'Rapor verisi alınamadı.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rapor verisi alınamadı.')
    } finally {
      setLoading(false)
    }
  }

  const bolumler = useMemo(
    () => Array.from(new Set(veriler.map((v) => v.bolum))).sort((a, b) => a.localeCompare(b, 'tr')),
    [veriler],
  )

  const bolumFiltreli = useMemo(
    () => (selectedBolum ? veriler.filter((v) => v.bolum === selectedBolum) : veriler),
    [veriler, selectedBolum],
  )

  const ozet = useMemo(
    () => ({
      gecikmis: bolumFiltreli.filter((v) => v.durum === 'GECIKMIS').length,
      yaklasiyor: bolumFiltreli.filter((v) => v.durum === 'YAKLASIYOR').length,
      guncel: bolumFiltreli.filter((v) => v.durum === 'GUNCEL').length,
      periyotYok: bolumFiltreli.filter((v) => v.durum === 'PERIYOT_YOK').length,
      tarihBelirsiz: bolumFiltreli.filter((v) => v.durum === 'TARIH_BELIRSIZ').length,
    }),
    [bolumFiltreli],
  )

  const tabloSatirlari = useMemo(() => {
    const liste = selectedDurum ? bolumFiltreli.filter((v) => v.durum === selectedDurum) : bolumFiltreli

    return [...liste].sort((a, b) => {
      if (a.kalanGun === null && b.kalanGun === null) return 0
      if (a.kalanGun === null) return 1
      if (b.kalanGun === null) return -1
      return a.kalanGun - b.kalanGun
    })
  }, [bolumFiltreli, selectedDurum])

  function handleExcelAktar() {
    const satirlar = tabloSatirlari.map((satir) => ({
      Sicil: satir.sicilNo ?? '',
      'Ad Soyad': satir.adSoyad,
      Bölüm: satir.bolum,
      Ürün: `${satir.urunKod} - ${satir.urunAd}`,
      Kategori: satir.kategori ?? '',
      'Son Teslim': satir.tarihBelirsiz
        ? 'Belirsiz'
        : new Date(satir.teslimTarihi).toLocaleDateString('tr-TR'),
      'Periyot (Ay)': satir.periyotAy ?? '',
      'Sonraki Hak Ediş': satir.sonrakiHakEdis
        ? new Date(satir.sonrakiHakEdis).toLocaleDateString('tr-TR')
        : '',
      'Kalan Gün': satir.kalanGun ?? '',
      Durum:
        satir.durum === 'GECIKMIS'
          ? 'Gecikmiş'
          : satir.durum === 'YAKLASIYOR'
            ? 'Yaklaşıyor'
            : satir.durum === 'PERIYOT_YOK'
              ? 'Periyot Yok'
              : satir.durum === 'TARIH_BELIRSIZ'
                ? 'Tarih Belirsiz'
                : 'Güncel',
    }))

    const ws = XLSX.utils.json_to_sheet(satirlar)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Yenileme Raporu')
    XLSX.writeFile(wb, `envanter-yenileme-raporu-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Raporlar — KKD Yenileme / Hak Ediş</h2>
            <p className="mt-2 text-sm text-slate-500">
              Aktif zimmetlerin, ürün kategorisinin yenileme periyoduna göre hak ediş durumu.
            </p>
          </div>

          <button
            type="button"
            onClick={handleExcelAktar}
            disabled={tabloSatirlari.length === 0}
            className="flex items-center gap-2 rounded-xl border border-teal-700 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            Excel'e Aktar
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Yükleniyor...</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            <DashboardCard
              title="Gecikmiş"
              value={String(ozet.gecikmis)}
              description="Hak ediş tarihi geçmiş"
              icon={AlertTriangle}
            />
            <DashboardCard
              title="Yaklaşıyor"
              value={String(ozet.yaklasiyor)}
              description="90 gün içinde hak ediş"
              icon={ClipboardCheck}
            />
            <DashboardCard
              title="Güncel"
              value={String(ozet.guncel)}
              description="Hak ediş tarihine 90 günden fazla var"
              icon={UserCheck}
            />
            <DashboardCard
              title="Periyot Yok"
              value={String(ozet.periyotYok)}
              description="Kategoride yenileme periyodu tanımlı değil"
              icon={Boxes}
            />
            <DashboardCard
              title="Tarih Belirsiz"
              value={String(ozet.tarihBelirsiz)}
              description="Teslim tarihi bilinmeyen historik kayıtlar, kontrol gerekli"
              icon={HelpCircle}
            />
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Bölüm</label>
                <select
                  className="mt-1 w-full rounded-xl border p-2 text-sm"
                  value={selectedBolum}
                  onChange={(e) => setSelectedBolum(e.target.value)}
                >
                  <option value="">Tüm bölümler</option>
                  {bolumler.map((bolum) => (
                    <option key={bolum} value={bolum}>
                      {bolum}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Durum</label>
                <select
                  className="mt-1 w-full rounded-xl border p-2 text-sm"
                  value={selectedDurum}
                  onChange={(e) => setSelectedDurum(e.target.value as YenilemeDurum | '')}
                >
                  <option value="">Tüm durumlar</option>
                  <option value="GECIKMIS">Gecikmiş</option>
                  <option value="YAKLASIYOR">Yaklaşıyor</option>
                  <option value="GUNCEL">Güncel</option>
                  <option value="PERIYOT_YOK">Periyot Yok</option>
                  <option value="TARIH_BELIRSIZ">Tarih Belirsiz</option>
                </select>
              </div>
            </div>

            {tabloSatirlari.length === 0 ? (
              <p className="mt-6 text-sm text-slate-500">Kayıt bulunamadı.</p>
            ) : (
              <div className="mt-6 overflow-hidden overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-3">Sicil</th>
                      <th className="px-3 py-3">Ad Soyad</th>
                      <th className="px-3 py-3">Bölüm</th>
                      <th className="px-3 py-3">Ürün</th>
                      <th className="px-3 py-3">Kategori</th>
                      <th className="px-3 py-3">Son Teslim</th>
                      <th className="px-3 py-3 text-right">Periyot (Ay)</th>
                      <th className="px-3 py-3">Sonraki Hak Ediş</th>
                      <th className="px-3 py-3 text-right">Kalan Gün</th>
                      <th className="px-3 py-3">Durum</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {tabloSatirlari.map((satir, i) => (
                      <tr key={`${satir.personnelId}-${satir.urunKod}-${i}`}>
                        <td className="px-3 py-3">{satir.sicilNo ?? '-'}</td>
                        <td className="px-3 py-3 font-medium text-slate-900">{satir.adSoyad}</td>
                        <td className="px-3 py-3">{satir.bolum}</td>
                        <td className="px-3 py-3">
                          {satir.urunKod} - {satir.urunAd}
                        </td>
                        <td className="px-3 py-3">{satir.kategori ?? '-'}</td>
                        <td className="px-3 py-3">
                          {satir.tarihBelirsiz ? (
                            <span className="text-sky-700">Belirsiz</span>
                          ) : (
                            new Date(satir.teslimTarihi).toLocaleDateString('tr-TR')
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">{satir.periyotAy ?? '-'}</td>
                        <td className="px-3 py-3">
                          {satir.sonrakiHakEdis
                            ? new Date(satir.sonrakiHakEdis).toLocaleDateString('tr-TR')
                            : '-'}
                        </td>
                        <td className="px-3 py-3 text-right">{satir.kalanGun ?? '-'}</td>
                        <td className="px-3 py-3">
                          <YenilemeDurumBadge durum={satir.durum} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

type SatinAlmaTalepListItem = {
  id: string
  formNo: string
  talepEdenAd: string
  bolum: string | null
  durum: SatinAlmaDurumTip
  createdAt: string
  kalemler: { id: string }[]
}

type SatinAlmaKalem = {
  id: string
  talepId: string
  urunId: string | null
  malzemeKodu: string | null
  malzemeAdi: string
  talepMiktar: number
  uygunMiktar: number | null
  depoMiktar: number | null
  teslimAlinanMiktar: number
  aciklama: string | null
}

type SatinAlmaGecmisSatiri = {
  id: string
  durum: SatinAlmaDurumTip
  aksiyon: SatinAlmaAksiyonTip | null
  yapanAd: string
  not: string | null
  createdAt: string
}

type SatinAlmaTalepDetay = {
  id: string
  formNo: string
  talepEdenAd: string
  bolum: string | null
  durum: SatinAlmaDurumTip
  createdAt: string
  masrafYeri: string | null
  asansorMekanik: string | null
  aciklama: string | null
  redSebebi: string | null
  terminTarihi: string | null
  kalemler: SatinAlmaKalem[]
  gecmis: SatinAlmaGecmisSatiri[]
}

const SATINALMA_DURUM_ETIKET: Record<SatinAlmaDurumTip, string> = {
  TASLAK: 'Taslak',
  IDARI_ISLER_ONAYI: 'İdari İşler Onayı',
  MUDUR_YRD_ONAYI: 'Müdür Yrd. Onayı',
  MUDUR_ONAYI: 'Müdür Onayı',
  SATINALMA_ONAYI: 'Satınalma Onayı',
  SIPARIS_ACILDI: 'Sipariş Açıldı',
  TERMIN_GIRILDI: 'Termin Girildi',
  TESLIM_ALINDI: 'Teslim Alındı',
  STOGA_ISLENDI: 'Stoğa İşlendi',
  REDDEDILDI: 'Reddedildi',
  IPTAL: 'İptal',
}

const SATINALMA_DURUM_STIL: Record<SatinAlmaDurumTip, string> = {
  TASLAK: 'bg-slate-100 text-slate-600',
  IDARI_ISLER_ONAYI: 'bg-amber-50 text-amber-700',
  MUDUR_YRD_ONAYI: 'bg-amber-50 text-amber-700',
  MUDUR_ONAYI: 'bg-amber-50 text-amber-700',
  SATINALMA_ONAYI: 'bg-amber-50 text-amber-700',
  SIPARIS_ACILDI: 'bg-sky-50 text-sky-700',
  TERMIN_GIRILDI: 'bg-indigo-50 text-indigo-700',
  TESLIM_ALINDI: 'bg-teal-50 text-teal-700',
  STOGA_ISLENDI: 'bg-emerald-50 text-emerald-700',
  REDDEDILDI: 'bg-rose-50 text-rose-700',
  IPTAL: 'bg-slate-100 text-slate-500',
}

function SatinAlmaDurumBadge({ durum }: { durum: SatinAlmaDurumTip }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${SATINALMA_DURUM_STIL[durum] ?? 'bg-slate-100 text-slate-600'}`}
    >
      {SATINALMA_DURUM_ETIKET[durum] ?? durum}
    </span>
  )
}

const ONAY_ZINCIRI_DURUMLARI: SatinAlmaDurumTip[] = [
  'TASLAK',
  'IDARI_ISLER_ONAYI',
  'MUDUR_YRD_ONAYI',
  'MUDUR_ONAYI',
  'SATINALMA_ONAYI',
]

type YeniKalemSatiri = {
  malzemeKodu: string
  malzemeAdi: string
  talepMiktar: string
  aciklama: string
}

function SatinAlmaYonetimi() {
  const [talepler, setTalepler] = useState<SatinAlmaTalepListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [durumFiltre, setDurumFiltre] = useState<SatinAlmaDurumTip | ''>('')

  const [bolumler, setBolumler] = useState<string[]>([])

  const [showNewForm, setShowNewForm] = useState(false)
  const [yeniBolum, setYeniBolum] = useState('')
  const [yeniMasrafYeri, setYeniMasrafYeri] = useState('')
  const [yeniAsansorMekanik, setYeniAsansorMekanik] = useState('')
  const [yeniAciklama, setYeniAciklama] = useState('')
  const [yeniKalemler, setYeniKalemler] = useState<YeniKalemSatiri[]>([
    { malzemeKodu: '', malzemeAdi: '', talepMiktar: '1', aciklama: '' },
  ])
  const [yeniSaving, setYeniSaving] = useState(false)

  const [selectedTalepId, setSelectedTalepId] = useState('')
  const [talepDetay, setTalepDetay] = useState<SatinAlmaTalepDetay | null>(null)
  const [detayLoading, setDetayLoading] = useState(false)

  const [aksiyonAcik, setAksiyonAcik] = useState<SatinAlmaAksiyonTip | ''>('')
  const [aksiyonNot, setAksiyonNot] = useState('')
  const [redSebebi, setRedSebebi] = useState('')
  const [revizeMiktarlar, setRevizeMiktarlar] = useState<Record<string, string>>({})
  const [revizeIlerlet, setRevizeIlerlet] = useState(false)
  const [aksiyonSaving, setAksiyonSaving] = useState(false)

  const [terminTarihi, setTerminTarihi] = useState('')
  const [terminSaving, setTerminSaving] = useState(false)

  const [teslimMiktarlar, setTeslimMiktarlar] = useState<Record<string, string>>({})
  const [teslimSaving, setTeslimSaving] = useState(false)

  const [stogaSaving, setStogaSaving] = useState(false)

  useEffect(() => {
    loadTalepler(durumFiltre || undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durumFiltre])

  useEffect(() => {
    loadBolumler()
  }, [])

  async function loadBolumler() {
    try {
      const res = await fetch('/api/envanter/satinalma/bolumler')
      const json = await res.json()
      if (json.ok) setBolumler(json.data)
    } catch {
      // Bölüm listesi alınamazsa dropdown boş kalır, form yine de gönderilebilir.
    }
  }

  async function loadTalepler(durum?: SatinAlmaDurumTip) {
    setLoading(true)

    try {
      const url = durum
        ? `/api/envanter/satinalma?durum=${durum}`
        : '/api/envanter/satinalma'
      const res = await fetch(url)
      const json = await res.json()
      if (json.ok) setTalepler(json.data)
    } finally {
      setLoading(false)
    }
  }

  async function loadDetay(id: string) {
    setDetayLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/envanter/satinalma/${id}`)
      const json = await res.json()

      if (json.ok) {
        setTalepDetay(json.data)
      } else {
        setError(json.message || 'Talep detayı alınamadı.')
      }
    } finally {
      setDetayLoading(false)
    }
  }

  function handleTalepSec(id: string) {
    setSelectedTalepId(id)
    setMessage('')
    setError('')
    setAksiyonAcik('')
    setAksiyonNot('')
    setRedSebebi('')
    setRevizeMiktarlar({})
    setRevizeIlerlet(false)
    setTeslimMiktarlar({})
    setTerminTarihi('')
    loadDetay(id)
  }

  function kalemEkle() {
    setYeniKalemler((prev) => [...prev, { malzemeKodu: '', malzemeAdi: '', talepMiktar: '1', aciklama: '' }])
  }

  function kalemSil(index: number) {
    setYeniKalemler((prev) => prev.filter((_, i) => i !== index))
  }

  function kalemGuncelle(index: number, alan: keyof YeniKalemSatiri, deger: string) {
    setYeniKalemler((prev) => prev.map((k, i) => (i === index ? { ...k, [alan]: deger } : k)))
  }

  async function handleYeniTalepOlustur() {
    setError('')
    setMessage('')

    const kalemler = yeniKalemler
      .filter((k) => k.malzemeAdi.trim())
      .map((k) => ({
        malzemeKodu: k.malzemeKodu || undefined,
        malzemeAdi: k.malzemeAdi,
        talepMiktar: Number(k.talepMiktar),
        aciklama: k.aciklama || undefined,
      }))

    if (kalemler.length === 0) {
      setError('En az bir kalem eklenmelidir (malzeme adı zorunlu).')
      return
    }

    setYeniSaving(true)

    try {
      const res = await fetch('/api/envanter/satinalma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bolum: yeniBolum || undefined,
          masrafYeri: yeniMasrafYeri || undefined,
          asansorMekanik: yeniAsansorMekanik || undefined,
          aciklama: yeniAciklama || undefined,
          kalemler,
        }),
      })

      const json = await res.json()

      if (json.ok) {
        setMessage(`Talep oluşturuldu: ${json.data.formNo}`)
        setShowNewForm(false)
        setYeniBolum('')
        setYeniMasrafYeri('')
        setYeniAsansorMekanik('')
        setYeniAciklama('')
        setYeniKalemler([{ malzemeKodu: '', malzemeAdi: '', talepMiktar: '1', aciklama: '' }])
        await loadTalepler(durumFiltre || undefined)
      } else {
        setError(json.message || 'Talep oluşturulamadı.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Talep oluşturulamadı.')
    } finally {
      setYeniSaving(false)
    }
  }

  async function handleAksiyonGonder(aksiyon: SatinAlmaAksiyonTip) {
    if (!selectedTalepId) return

    if (aksiyon === 'REDDET' && !redSebebi.trim()) {
      setError('Red sebebi zorunludur.')
      return
    }

    setError('')
    setMessage('')
    setAksiyonSaving(true)

    try {
      const uygunMiktarlar: Record<string, number> = {}
      for (const [kalemId, deger] of Object.entries(revizeMiktarlar)) {
        if (deger !== '') uygunMiktarlar[kalemId] = Number(deger)
      }

      const res = await fetch(`/api/envanter/satinalma/${selectedTalepId}/aksiyon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aksiyon,
          not: aksiyonNot || undefined,
          redSebebi: redSebebi || undefined,
          uygunMiktarlar,
          ilerlet: revizeIlerlet,
        }),
      })

      const json = await res.json()

      if (json.ok) {
        setMessage('İşlem uygulandı.')
        setAksiyonAcik('')
        setAksiyonNot('')
        setRedSebebi('')
        setRevizeMiktarlar({})
        setRevizeIlerlet(false)
        await loadDetay(selectedTalepId)
        await loadTalepler(durumFiltre || undefined)
      } else {
        setError(json.message || 'İşlem uygulanamadı.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem uygulanamadı.')
    } finally {
      setAksiyonSaving(false)
    }
  }

  async function handleTerminGonder() {
    if (!selectedTalepId || !terminTarihi) {
      setError('Termin tarihi seçiniz.')
      return
    }

    setError('')
    setMessage('')
    setTerminSaving(true)

    try {
      const res = await fetch(`/api/envanter/satinalma/${selectedTalepId}/termin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tarih: terminTarihi }),
      })

      const json = await res.json()

      if (json.ok) {
        setMessage('Termin tarihi girildi.')
        setTerminTarihi('')
        await loadDetay(selectedTalepId)
        await loadTalepler(durumFiltre || undefined)
      } else {
        setError(json.message || 'Termin tarihi girilemedi.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Termin tarihi girilemedi.')
    } finally {
      setTerminSaving(false)
    }
  }

  async function handleTeslimGonder() {
    if (!selectedTalepId) return

    const kalemler = Object.entries(teslimMiktarlar)
      .filter(([, deger]) => deger && Number(deger) > 0)
      .map(([kalemId, deger]) => ({ kalemId, miktar: Number(deger) }))

    if (kalemler.length === 0) {
      setError('En az bir kalem için teslim miktarı giriniz.')
      return
    }

    setError('')
    setMessage('')
    setTeslimSaving(true)

    try {
      const res = await fetch(`/api/envanter/satinalma/${selectedTalepId}/teslim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kalemler }),
      })

      const json = await res.json()

      if (json.ok) {
        setMessage('Teslimat işlendi.')
        setTeslimMiktarlar({})
        await loadDetay(selectedTalepId)
        await loadTalepler(durumFiltre || undefined)
      } else {
        setError(json.message || 'Teslimat işlenemedi.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Teslimat işlenemedi.')
    } finally {
      setTeslimSaving(false)
    }
  }

  async function handleStogaGonder() {
    if (!selectedTalepId) return

    setError('')
    setMessage('')
    setStogaSaving(true)

    try {
      const res = await fetch(`/api/envanter/satinalma/${selectedTalepId}/stok`, {
        method: 'POST',
      })

      const json = await res.json()

      if (json.ok) {
        setMessage('Kalemler stoğa işlendi.')
        await loadDetay(selectedTalepId)
        await loadTalepler(durumFiltre || undefined)
      } else {
        setError(json.message || 'Stoğa işlenemedi.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stoğa işlenemedi.')
    } finally {
      setStogaSaving(false)
    }
  }

  const onayZincirindeMi = talepDetay ? ONAY_ZINCIRI_DURUMLARI.includes(talepDetay.durum) : false

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Satın Alma / Malzeme Talep Formu</h2>
            <p className="mt-2 text-sm text-slate-500">
              Malzeme talebi oluştur, onay zincirinden geçir, sipariş/termin/teslim/stoğa işleme
              akışını takip et.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowNewForm((prev) => !prev)}
            className="flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            {showNewForm ? 'Vazgeç' : 'Yeni Talep'}
          </button>
        </div>

        {showNewForm && (
          <div className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium">Bölüm</label>
                <select
                  value={yeniBolum}
                  onChange={(e) => setYeniBolum(e.target.value)}
                  className="mt-1 w-full rounded-xl border p-2 text-sm"
                >
                  <option value="">Seçiniz</option>
                  {bolumler.map((bolum) => (
                    <option key={bolum} value={bolum}>
                      {bolum}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Masraf Yeri</label>
                <input
                  value={yeniMasrafYeri}
                  onChange={(e) => setYeniMasrafYeri(e.target.value)}
                  className="mt-1 w-full rounded-xl border p-2 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Asansör / Mekanik</label>
                <select
                  value={yeniAsansorMekanik}
                  onChange={(e) => setYeniAsansorMekanik(e.target.value)}
                  className="mt-1 w-full rounded-xl border p-2 text-sm"
                >
                  <option value="">Seçiniz</option>
                  <option value="ASANSOR">Asansör</option>
                  <option value="MEKANIK">Mekanik</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Kalemler</label>
                <button
                  type="button"
                  onClick={kalemEkle}
                  className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Satır Ekle
                </button>
              </div>

              <div className="mt-2 space-y-2">
                {yeniKalemler.map((kalem, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 rounded-lg border bg-white p-2">
                    <input
                      value={kalem.malzemeKodu}
                      onChange={(e) => kalemGuncelle(i, 'malzemeKodu', e.target.value)}
                      placeholder="Malzeme Kodu"
                      className="col-span-2 rounded-lg border p-1.5 text-sm"
                    />
                    <input
                      value={kalem.malzemeAdi}
                      onChange={(e) => kalemGuncelle(i, 'malzemeAdi', e.target.value)}
                      placeholder="Malzeme Adı *"
                      className="col-span-4 rounded-lg border p-1.5 text-sm"
                    />
                    <input
                      type="number"
                      min={1}
                      value={kalem.talepMiktar}
                      onChange={(e) => kalemGuncelle(i, 'talepMiktar', e.target.value)}
                      placeholder="Miktar"
                      className="col-span-2 rounded-lg border p-1.5 text-sm"
                    />
                    <input
                      value={kalem.aciklama}
                      onChange={(e) => kalemGuncelle(i, 'aciklama', e.target.value)}
                      placeholder="Açıklama"
                      className="col-span-3 rounded-lg border p-1.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => kalemSil(i)}
                      disabled={yeniKalemler.length === 1}
                      className="col-span-1 flex items-center justify-center rounded-lg border text-slate-400 hover:bg-slate-100 disabled:opacity-40"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Açıklama</label>
              <textarea
                value={yeniAciklama}
                onChange={(e) => setYeniAciklama(e.target.value)}
                className="mt-1 min-h-20 w-full rounded-xl border p-2 text-sm"
              />
            </div>

            <button
              type="button"
              onClick={handleYeniTalepOlustur}
              disabled={yeniSaving}
              className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {yeniSaving ? 'Kaydediliyor...' : 'Talebi Oluştur'}
            </button>
          </div>
        )}

        <div className="mt-4">
          <label className="text-sm font-medium">Durum Filtresi</label>
          <select
            value={durumFiltre}
            onChange={(e) => setDurumFiltre(e.target.value as SatinAlmaDurumTip | '')}
            className="mt-1 w-full max-w-xs rounded-xl border p-2 text-sm"
          >
            <option value="">Tüm durumlar</option>
            {(Object.keys(SATINALMA_DURUM_ETIKET) as SatinAlmaDurumTip[]).map((d) => (
              <option key={d} value={d}>
                {SATINALMA_DURUM_ETIKET[d]}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        {message && (
          <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</div>
        )}
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">Yükleniyor...</p>
        ) : talepler.length === 0 ? (
          <p className="text-sm text-slate-500">Kayıt bulunamadı.</p>
        ) : (
          <div className="overflow-hidden overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Form No</th>
                  <th className="px-3 py-3">Talep Eden</th>
                  <th className="px-3 py-3">Durum</th>
                  <th className="px-3 py-3">Tarih</th>
                  <th className="px-3 py-3 text-right">Kalem</th>
                  <th className="px-3 py-3">Detay</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {talepler.map((talep) => (
                  <tr key={talep.id} className={selectedTalepId === talep.id ? 'bg-slate-50' : ''}>
                    <td className="px-3 py-3 font-medium text-slate-900">{talep.formNo}</td>
                    <td className="px-3 py-3">{talep.talepEdenAd}</td>
                    <td className="px-3 py-3">
                      <SatinAlmaDurumBadge durum={talep.durum} />
                    </td>
                    <td className="px-3 py-3">
                      {new Date(talep.createdAt).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-3 py-3 text-right">{talep.kalemler.length}</td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => handleTalepSec(talep.id)}
                        className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Detay
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedTalepId && (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          {detayLoading ? (
            <p className="text-sm text-slate-500">Detay yükleniyor...</p>
          ) : !talepDetay ? (
            <p className="text-sm text-slate-500">Detay bulunamadı.</p>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{talepDetay.formNo}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {talepDetay.talepEdenAd}
                    {talepDetay.bolum ? ` — ${talepDetay.bolum}` : ''}
                    {talepDetay.masrafYeri ? ` — ${talepDetay.masrafYeri}` : ''}
                  </p>
                  {talepDetay.aciklama && (
                    <p className="mt-1 text-sm text-slate-500">{talepDetay.aciklama}</p>
                  )}
                  {talepDetay.redSebebi && (
                    <p className="mt-1 text-sm text-rose-700">Red sebebi: {talepDetay.redSebebi}</p>
                  )}
                  {talepDetay.terminTarihi && (
                    <p className="mt-1 text-sm text-slate-500">
                      Termin: {new Date(talepDetay.terminTarihi).toLocaleDateString('tr-TR')}
                    </p>
                  )}
                </div>
                <SatinAlmaDurumBadge durum={talepDetay.durum} />
              </div>

              <div>
                <h4 className="font-semibold text-slate-900">Kalemler</h4>
                <div className="mt-2 overflow-hidden overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-3">Kod</th>
                        <th className="px-3 py-3">Malzeme Adı</th>
                        <th className="px-3 py-3 text-right">Talep</th>
                        <th className="px-3 py-3 text-right">Uygun</th>
                        <th className="px-3 py-3 text-right">Teslim Alınan</th>
                        <th className="px-3 py-3">Açıklama</th>
                        {talepDetay.durum === 'TERMIN_GIRILDI' && (
                          <th className="px-3 py-3 text-right">Bu Teslimatta</th>
                        )}
                        {aksiyonAcik === 'REVIZE' && <th className="px-3 py-3 text-right">Uygun Miktar (yeni)</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {talepDetay.kalemler.map((kalem) => (
                        <tr key={kalem.id}>
                          <td className="px-3 py-3">{kalem.malzemeKodu || '-'}</td>
                          <td className="px-3 py-3">{kalem.malzemeAdi}</td>
                          <td className="px-3 py-3 text-right">{kalem.talepMiktar}</td>
                          <td className="px-3 py-3 text-right">{kalem.uygunMiktar ?? '-'}</td>
                          <td className="px-3 py-3 text-right">{kalem.teslimAlinanMiktar}</td>
                          <td className="px-3 py-3">{kalem.aciklama || '-'}</td>
                          {talepDetay.durum === 'TERMIN_GIRILDI' && (
                            <td className="px-3 py-3 text-right">
                              <input
                                type="number"
                                min={0}
                                value={teslimMiktarlar[kalem.id] ?? ''}
                                onChange={(e) =>
                                  setTeslimMiktarlar((prev) => ({ ...prev, [kalem.id]: e.target.value }))
                                }
                                className="w-20 rounded-lg border p-1 text-right text-sm"
                              />
                            </td>
                          )}
                          {aksiyonAcik === 'REVIZE' && (
                            <td className="px-3 py-3 text-right">
                              <input
                                type="number"
                                min={0}
                                value={revizeMiktarlar[kalem.id] ?? ''}
                                onChange={(e) =>
                                  setRevizeMiktarlar((prev) => ({ ...prev, [kalem.id]: e.target.value }))
                                }
                                placeholder={String(kalem.uygunMiktar ?? kalem.talepMiktar)}
                                className="w-20 rounded-lg border p-1 text-right text-sm"
                              />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900">Onay Geçmişi</h4>
                <div className="mt-2 space-y-2">
                  {talepDetay.gecmis.map((g) => (
                    <div key={g.id} className="rounded-xl border bg-slate-50 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-900">
                          {SATINALMA_DURUM_ETIKET[g.durum] ?? g.durum}
                          {g.aksiyon ? ` — ${g.aksiyon}` : ''}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(g.createdAt).toLocaleString('tr-TR')}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {g.yapanAd}
                        {g.not ? ` — ${g.not}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="font-semibold text-slate-900">Aksiyonlar</h4>

                {onayZincirindeMi && (
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleAksiyonGonder('ONAYLA')}
                        disabled={aksiyonSaving}
                        className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                      >
                        Onayla
                      </button>
                      <button
                        type="button"
                        onClick={() => setAksiyonAcik(aksiyonAcik === 'REDDET' ? '' : 'REDDET')}
                        className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
                      >
                        Reddet
                      </button>
                      <button
                        type="button"
                        onClick={() => setAksiyonAcik(aksiyonAcik === 'REVIZE' ? '' : 'REVIZE')}
                        className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                      >
                        Revize
                      </button>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Not</label>
                      <input
                        value={aksiyonNot}
                        onChange={(e) => setAksiyonNot(e.target.value)}
                        className="mt-1 w-full rounded-xl border p-2 text-sm"
                        placeholder="Opsiyonel not"
                      />
                    </div>

                    {aksiyonAcik === 'REDDET' && (
                      <div>
                        <label className="text-sm font-medium">Red Sebebi *</label>
                        <textarea
                          value={redSebebi}
                          onChange={(e) => setRedSebebi(e.target.value)}
                          className="mt-1 min-h-20 w-full rounded-xl border p-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => handleAksiyonGonder('REDDET')}
                          disabled={aksiyonSaving}
                          className="mt-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
                        >
                          {aksiyonSaving ? 'Kaydediliyor...' : 'Reddi Onayla'}
                        </button>
                      </div>
                    )}

                    {aksiyonAcik === 'REVIZE' && (
                      <div>
                        <p className="text-xs text-slate-500">
                          Yukarıdaki kalem tablosunda "Uygun Miktar (yeni)" kolonuna revize
                          değerlerini girin.
                        </p>
                        <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={revizeIlerlet}
                            onChange={(e) => setRevizeIlerlet(e.target.checked)}
                          />
                          Revizeden sonra bir sonraki aşamaya ilerlet
                        </label>
                        <button
                          type="button"
                          onClick={() => handleAksiyonGonder('REVIZE')}
                          disabled={aksiyonSaving}
                          className="mt-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                        >
                          {aksiyonSaving ? 'Kaydediliyor...' : 'Revizeyi Kaydet'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {talepDetay.durum === 'SIPARIS_ACILDI' && (
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <div>
                      <label className="text-sm font-medium">Termin Tarihi</label>
                      <input
                        type="date"
                        value={terminTarihi}
                        onChange={(e) => setTerminTarihi(e.target.value)}
                        className="mt-1 rounded-xl border p-2 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleTerminGonder}
                      disabled={terminSaving}
                      className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                    >
                      {terminSaving ? 'Kaydediliyor...' : 'Termin Gir'}
                    </button>
                  </div>
                )}

                {talepDetay.durum === 'TERMIN_GIRILDI' && (
                  <div className="mt-3">
                    <p className="text-xs text-slate-500">
                      Yukarıdaki kalem tablosunda "Bu Teslimatta" kolonuna alınan miktarları girin.
                    </p>
                    <button
                      type="button"
                      onClick={handleTeslimGonder}
                      disabled={teslimSaving}
                      className="mt-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                    >
                      {teslimSaving ? 'Kaydediliyor...' : 'Teslim Al'}
                    </button>
                  </div>
                )}

                {talepDetay.durum === 'TESLIM_ALINDI' && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={handleStogaGonder}
                      disabled={stogaSaving}
                      className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                    >
                      {stogaSaving ? 'Kaydediliyor...' : 'Stoğa İşle'}
                    </button>
                  </div>
                )}

                {(talepDetay.durum === 'STOGA_ISLENDI' ||
                  talepDetay.durum === 'REDDEDILDI' ||
                  talepDetay.durum === 'IPTAL') && (
                  <p className="mt-3 text-sm text-slate-500">
                    Bu talep sonlanmış durumda, aksiyon alınamaz.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

type SezonPlanListItem = {
  id: string
  ad: string
  sezonTipi: SezonTipiTip
  yil: number
  dagitimTarihi: string | null
  siparisKilitTarihi: string | null
  planlananAlim: number | null
  turnoverOrani: number | null
  emniyetPayiOrani: number | null
  durum: string
  not: string | null
  createdAt: string
  kalemler: { id: string }[]
}

type SezonKalemDetay = {
  id: string
  planId: string
  urunId: string
  kisiBasiAdet: number
  urun: { kod: string; ad: string; kategori: string | null; varyantTipi: string }
}

type SezonPlanDetay = {
  id: string
  ad: string
  sezonTipi: SezonTipiTip
  yil: number
  dagitimTarihi: string | null
  siparisKilitTarihi: string | null
  planlananAlim: number | null
  turnoverOrani: number | null
  emniyetPayiOrani: number | null
  durum: string
  not: string | null
  createdAt: string
  kalemler: SezonKalemDetay[]
}

type BedenProfilItem = {
  id: string
  personnelId: string
  ustBeden: string | null
  altBeden: string | null
  ayakkabiNo: string | null
  eldivenNo: string | null
  not: string | null
  personnel: { sicilNo: string | null; adSoyad: string; bolum: string }
}

function SezonPlaniYonetimi() {
  const [planlar, setPlanlar] = useState<SezonPlanListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [showNewForm, setShowNewForm] = useState(false)
  const [yeniAd, setYeniAd] = useState('')
  const [yeniSezonTipi, setYeniSezonTipi] = useState<SezonTipiTip>('YAZLIK')
  const [yeniYil, setYeniYil] = useState(String(new Date().getFullYear()))
  const [yeniDagitimTarihi, setYeniDagitimTarihi] = useState('')
  const [yeniSiparisKilitTarihi, setYeniSiparisKilitTarihi] = useState('')
  const [yeniNot, setYeniNot] = useState('')
  const [yeniPlanlananAlim, setYeniPlanlananAlim] = useState('')
  const [yeniTurnoverOrani, setYeniTurnoverOrani] = useState('')
  const [yeniEmniyetPayiOrani, setYeniEmniyetPayiOrani] = useState('')
  const [yeniSaving, setYeniSaving] = useState(false)

  const [urunler, setUrunler] = useState<EnvanterUrunListItem[]>([])

  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [planDetay, setPlanDetay] = useState<SezonPlanDetay | null>(null)
  const [detayLoading, setDetayLoading] = useState(false)

  const [overridePlanlananAlim, setOverridePlanlananAlim] = useState('')
  const [overrideTurnoverOrani, setOverrideTurnoverOrani] = useState('')
  const [overrideEmniyetPayiOrani, setOverrideEmniyetPayiOrani] = useState('')
  const [overrideSaving, setOverrideSaving] = useState(false)

  const [planlananAlimOnerisi, setPlanlananAlimOnerisi] = useState<PlanlananAlimOnerisi | null>(null)
  const [turnoverOranOnerisi, setTurnoverOranOnerisi] = useState<TurnoverOranOnerisi | null>(null)
  const [sezonParametre, setSezonParametre] = useState<SezonParametre | null>(null)

  const [yeniKalemUrunId, setYeniKalemUrunId] = useState('')
  const [yeniKalemKisiBasi, setYeniKalemKisiBasi] = useState('1')
  const [kalemEkleSaving, setKalemEkleSaving] = useState(false)

  const [ihtiyacSonuc, setIhtiyacSonuc] = useState<{
    satirlar: IhtiyacSatiri[]
    ozet: IhtiyacOzet
  } | null>(null)
  const [ihtiyacLoading, setIhtiyacLoading] = useState(false)

  const [talepOlusturSaving, setTalepOlusturSaving] = useState(false)

  const [personeller, setPersoneller] = useState<any[]>([])
  const [bedenProfilleri, setBedenProfilleri] = useState<BedenProfilItem[]>([])
  const [bedenProfilLoading, setBedenProfilLoading] = useState(true)
  const [bedenPersonelId, setBedenPersonelId] = useState('')
  const [bedenUst, setBedenUst] = useState('')
  const [bedenAlt, setBedenAlt] = useState('')
  const [bedenAyakkabi, setBedenAyakkabi] = useState('')
  const [bedenEldiven, setBedenEldiven] = useState('')
  const [bedenNot, setBedenNot] = useState('')
  const [bedenSaving, setBedenSaving] = useState(false)

  const [showBedenImport, setShowBedenImport] = useState(false)
  const [bedenImportDosya, setBedenImportDosya] = useState<File | null>(null)
  const [bedenImportRapor, setBedenImportRapor] = useState<BedenProfilValidateSonuc | null>(null)
  const [bedenImportSonuc, setBedenImportSonuc] = useState<BedenProfilExecuteSonuc | null>(null)
  const [bedenImportValidating, setBedenImportValidating] = useState(false)
  const [bedenImportExecuting, setBedenImportExecuting] = useState(false)

  useEffect(() => {
    loadPlanlar()
    loadUrunler()
    loadPersoneller()
    loadBedenProfilleri()
    loadSezonParametre()
    loadOneriler()
  }, [])

  async function loadSezonParametre() {
    const res = await fetch('/api/envanter/sezon-parametre')
    const json = await res.json()
    if (json.ok) setSezonParametre(json.data)
  }

  async function loadOneriler() {
    const res = await fetch('/api/envanter/sezon/oneriler')
    const json = await res.json()
    if (json.ok) {
      setPlanlananAlimOnerisi(json.data.planlananAlimOnerisi)
      setTurnoverOranOnerisi(json.data.turnoverOranOnerisi)
    }
  }

  async function loadPlanlar() {
    setLoading(true)
    try {
      const res = await fetch('/api/envanter/sezon')
      const json = await res.json()
      if (json.ok) setPlanlar(json.data)
    } finally {
      setLoading(false)
    }
  }

  async function loadUrunler() {
    const res = await fetch('/api/envanter/urunler')
    const json = await res.json()
    if (json.ok) setUrunler(json.data)
  }

  async function loadPersoneller() {
    const res = await fetch('/api/envanter/personeller')
    const json = await res.json()
    if (json.ok) setPersoneller(json.data)
  }

  async function loadBedenProfilleri() {
    setBedenProfilLoading(true)
    try {
      const res = await fetch('/api/envanter/beden-profili')
      const json = await res.json()
      if (json.ok) setBedenProfilleri(json.data)
    } finally {
      setBedenProfilLoading(false)
    }
  }

  async function loadDetay(id: string) {
    setDetayLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/envanter/sezon/${id}`)
      const json = await res.json()
      if (json.ok) {
        setPlanDetay(json.data)
        setOverridePlanlananAlim(json.data.planlananAlim != null ? String(json.data.planlananAlim) : '')
        setOverrideTurnoverOrani(json.data.turnoverOrani != null ? String(json.data.turnoverOrani) : '')
        setOverrideEmniyetPayiOrani(
          json.data.emniyetPayiOrani != null ? String(json.data.emniyetPayiOrani) : '',
        )
      } else {
        setError(json.message || 'Sezon planı detayı alınamadı.')
      }
    } finally {
      setDetayLoading(false)
    }
  }

  function handlePlanSec(id: string) {
    setSelectedPlanId(id)
    setMessage('')
    setError('')
    setIhtiyacSonuc(null)
    setYeniKalemUrunId('')
    setYeniKalemKisiBasi('1')
    loadDetay(id)
  }

  async function handleYeniPlanOlustur() {
    setError('')
    setMessage('')

    if (!yeniAd.trim()) {
      setError('Sezon planı adı zorunludur.')
      return
    }

    setYeniSaving(true)
    try {
      const res = await fetch('/api/envanter/sezon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ad: yeniAd,
          sezonTipi: yeniSezonTipi,
          yil: Number(yeniYil),
          dagitimTarihi: yeniDagitimTarihi || undefined,
          siparisKilitTarihi: yeniSiparisKilitTarihi || undefined,
          not: yeniNot || undefined,
          planlananAlim: yeniPlanlananAlim || undefined,
          turnoverOrani: yeniTurnoverOrani || undefined,
          emniyetPayiOrani: yeniEmniyetPayiOrani || undefined,
        }),
      })
      const json = await res.json()
      if (json.ok) {
        setMessage('Sezon planı oluşturuldu.')
        setShowNewForm(false)
        setYeniAd('')
        setYeniDagitimTarihi('')
        setYeniSiparisKilitTarihi('')
        setYeniNot('')
        setYeniPlanlananAlim('')
        setYeniTurnoverOrani('')
        setYeniEmniyetPayiOrani('')
        await loadPlanlar()
      } else {
        setError(json.message || 'Sezon planı oluşturulamadı.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sezon planı oluşturulamadı.')
    } finally {
      setYeniSaving(false)
    }
  }

  async function handleKalemEkle() {
    if (!selectedPlanId || !yeniKalemUrunId) {
      setError('Ürün seçiniz.')
      return
    }

    setError('')
    setMessage('')
    setKalemEkleSaving(true)
    try {
      const res = await fetch(`/api/envanter/sezon/${selectedPlanId}/kalem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urunId: yeniKalemUrunId, kisiBasiAdet: Number(yeniKalemKisiBasi) }),
      })
      const json = await res.json()
      if (json.ok) {
        setMessage('Kalem eklendi.')
        setYeniKalemUrunId('')
        setYeniKalemKisiBasi('1')
        await loadDetay(selectedPlanId)
        await loadPlanlar()
      } else {
        setError(json.message || 'Kalem eklenemedi.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kalem eklenemedi.')
    } finally {
      setKalemEkleSaving(false)
    }
  }

  async function handleIhtiyacHesapla() {
    if (!selectedPlanId) return

    setError('')
    setMessage('')
    setIhtiyacLoading(true)
    try {
      const res = await fetch(`/api/envanter/sezon/${selectedPlanId}/ihtiyac`)
      const json = await res.json()
      if (json.ok) {
        setIhtiyacSonuc(json.data)
      } else {
        setError(json.message || 'İhtiyaç hesaplanamadı.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İhtiyaç hesaplanamadı.')
    } finally {
      setIhtiyacLoading(false)
    }
  }

  async function handleOverrideKaydet() {
    if (!selectedPlanId) return

    setError('')
    setMessage('')
    setOverrideSaving(true)
    try {
      const res = await fetch(`/api/envanter/sezon/${selectedPlanId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planlananAlim: overridePlanlananAlim,
          turnoverOrani: overrideTurnoverOrani,
          emniyetPayiOrani: overrideEmniyetPayiOrani,
        }),
      })
      const json = await res.json()
      if (json.ok) {
        setMessage('Plan parametreleri kaydedildi.')
        setIhtiyacSonuc(null)
        await loadDetay(selectedPlanId)
        await loadPlanlar()
      } else {
        setError(json.message || 'Plan parametreleri kaydedilemedi.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Plan parametreleri kaydedilemedi.')
    } finally {
      setOverrideSaving(false)
    }
  }

  async function handleSatinAlmaTalebiOlustur() {
    if (!selectedPlanId) return

    setError('')
    setMessage('')
    setTalepOlusturSaving(true)
    try {
      const res = await fetch(`/api/envanter/sezon/${selectedPlanId}/satinalma-talebi`, {
        method: 'POST',
      })
      const json = await res.json()
      if (json.ok) {
        setMessage(json.message || 'Satın alma talebi oluşturuldu.')
      } else {
        setError(json.message || 'Talep oluşturulamadı.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Talep oluşturulamadı.')
    } finally {
      setTalepOlusturSaving(false)
    }
  }

  function handleBedenProfilDuzenle(profil: BedenProfilItem) {
    setBedenPersonelId(profil.personnelId)
    setBedenUst(profil.ustBeden ?? '')
    setBedenAlt(profil.altBeden ?? '')
    setBedenAyakkabi(profil.ayakkabiNo ?? '')
    setBedenEldiven(profil.eldivenNo ?? '')
    setBedenNot(profil.not ?? '')
  }

  async function handleBedenProfilKaydet() {
    if (!bedenPersonelId) {
      setError('Personel seçiniz.')
      return
    }

    setError('')
    setMessage('')
    setBedenSaving(true)
    try {
      const res = await fetch('/api/envanter/beden-profili', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personnelId: bedenPersonelId,
          ustBeden: bedenUst || undefined,
          altBeden: bedenAlt || undefined,
          ayakkabiNo: bedenAyakkabi || undefined,
          eldivenNo: bedenEldiven || undefined,
          not: bedenNot || undefined,
        }),
      })
      const json = await res.json()
      if (json.ok) {
        setMessage('Beden profili kaydedildi.')
        setBedenPersonelId('')
        setBedenUst('')
        setBedenAlt('')
        setBedenAyakkabi('')
        setBedenEldiven('')
        setBedenNot('')
        await loadBedenProfilleri()
      } else {
        setError(json.message || 'Beden profili kaydedilemedi.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Beden profili kaydedilemedi.')
    } finally {
      setBedenSaving(false)
    }
  }

  function handleBedenSablonIndir() {
    const ws = XLSX.utils.json_to_sheet([
      { sicilNo: '', ustBeden: '', altBeden: '', ayakkabiNo: '', eldivenNo: '', aciklama: '' },
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'BedenProfilleri')
    XLSX.writeFile(wb, 'beden-profili-sablonu.xlsx')
  }

  function handleBedenImportDosyaSec(event: React.ChangeEvent<HTMLInputElement>) {
    const secilen = event.target.files?.[0] ?? null
    setBedenImportDosya(secilen)
    setBedenImportRapor(null)
    setBedenImportSonuc(null)
    setError('')
  }

  async function handleBedenImportDogrula() {
    if (!bedenImportDosya) {
      setError('Önce bir .xlsx dosyası seçiniz.')
      return
    }

    setError('')
    setMessage('')
    setBedenImportSonuc(null)
    setBedenImportValidating(true)

    try {
      const formData = new FormData()
      formData.append('file', bedenImportDosya)
      formData.append('mode', 'validate')

      const res = await fetch('/api/envanter/beden-profili/import', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()

      if (json.ok) {
        setBedenImportRapor(json.data)
      } else {
        setError(json.message || 'Doğrulama başarısız oldu.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Doğrulama başarısız oldu.')
    } finally {
      setBedenImportValidating(false)
    }
  }

  async function handleBedenImportIceriAktar() {
    if (!bedenImportDosya) return

    setError('')
    setMessage('')
    setBedenImportExecuting(true)

    try {
      const formData = new FormData()
      formData.append('file', bedenImportDosya)
      formData.append('mode', 'execute')

      const res = await fetch('/api/envanter/beden-profili/import', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()

      if (json.ok) {
        setBedenImportSonuc(json.data)
        setMessage(json.message || 'İçeri aktarım tamamlandı.')
        setBedenImportDosya(null)
        setBedenImportRapor(null)
        await loadBedenProfilleri()
      } else {
        setError(json.message || 'İçeri aktarım başarısız oldu.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İçeri aktarım başarısız oldu.')
    } finally {
      setBedenImportExecuting(false)
    }
  }

  const netEksikVarMi = ihtiyacSonuc?.satirlar.some((s) => s.netEksik > 0) ?? false

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Sezon Planı</h2>
            <p className="mt-2 text-sm text-slate-500">
              Yazlık/kışlık kıyafet dağıtım planı, beden bazlı ihtiyaç hesabı ve satın alma
              bağlantısı.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowNewForm((prev) => !prev)}
            className="flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            {showNewForm ? 'Vazgeç' : 'Yeni Sezon Planı'}
          </button>
        </div>

        {showNewForm && (
          <div className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium">Ad</label>
              <input
                value={yeniAd}
                onChange={(e) => setYeniAd(e.target.value)}
                placeholder="Örn: 2026 Yazlık"
                className="mt-1 w-full rounded-xl border p-2 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Tip</label>
              <select
                value={yeniSezonTipi}
                onChange={(e) => setYeniSezonTipi(e.target.value as SezonTipiTip)}
                className="mt-1 w-full rounded-xl border p-2 text-sm"
              >
                <option value="YAZLIK">Yazlık</option>
                <option value="KISLIK">Kışlık</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Yıl</label>
              <input
                type="number"
                value={yeniYil}
                onChange={(e) => setYeniYil(e.target.value)}
                className="mt-1 w-full rounded-xl border p-2 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Dağıtım Tarihi</label>
              <input
                type="date"
                value={yeniDagitimTarihi}
                onChange={(e) => setYeniDagitimTarihi(e.target.value)}
                className="mt-1 w-full rounded-xl border p-2 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Sipariş Kilit Tarihi</label>
              <input
                type="date"
                value={yeniSiparisKilitTarihi}
                onChange={(e) => setYeniSiparisKilitTarihi(e.target.value)}
                className="mt-1 w-full rounded-xl border p-2 text-sm"
              />
            </div>

            <div className="md:col-span-3 border-t border-slate-200 pt-4">
              <p className="text-xs text-slate-500">
                Aşağıdaki 3 alan boş bırakılırsa Parametreler sekmesindeki varsayılan değerler
                kullanılır.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Planlanan İşe Alım (kişi)</label>
              <input
                type="number"
                min={0}
                value={yeniPlanlananAlim}
                onChange={(e) => setYeniPlanlananAlim(e.target.value)}
                placeholder="Boş = otomatik öneri"
                className="mt-1 w-full rounded-xl border p-2 text-sm"
              />
              {planlananAlimOnerisi && (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>
                    Öneri: {planlananAlimOnerisi.value} açık kadro
                    {planlananAlimOnerisi.yok ? ' (öneri yok)' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => setYeniPlanlananAlim(String(planlananAlimOnerisi.value))}
                    className="rounded-lg border px-2 py-0.5 font-medium text-teal-700 hover:bg-teal-50"
                  >
                    Öneriyi Kullan
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Turnover Oranı (%)</label>
              <input
                type="number"
                min={0}
                step="0.1"
                value={yeniTurnoverOrani}
                onChange={(e) => setYeniTurnoverOrani(e.target.value)}
                placeholder={`Varsayılan: %${sezonParametre?.turnoverOrani ?? 0}`}
                className="mt-1 w-full rounded-xl border p-2 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Emniyet Payı (%)</label>
              <input
                type="number"
                min={0}
                step="0.1"
                value={yeniEmniyetPayiOrani}
                onChange={(e) => setYeniEmniyetPayiOrani(e.target.value)}
                placeholder={`Varsayılan: %${sezonParametre?.emniyetPayiOrani ?? 0}`}
                className="mt-1 w-full rounded-xl border p-2 text-sm"
              />
            </div>

            <div className="md:col-span-3">
              <label className="text-sm font-medium">Not</label>
              <textarea
                value={yeniNot}
                onChange={(e) => setYeniNot(e.target.value)}
                className="mt-1 min-h-20 w-full rounded-xl border p-2 text-sm"
              />
            </div>

            <div className="md:col-span-3">
              <button
                type="button"
                onClick={handleYeniPlanOlustur}
                disabled={yeniSaving}
                className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {yeniSaving ? 'Kaydediliyor...' : 'Planı Oluştur'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        {message && (
          <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</div>
        )}
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">Yükleniyor...</p>
        ) : planlar.length === 0 ? (
          <p className="text-sm text-slate-500">Henüz sezon planı yok.</p>
        ) : (
          <div className="overflow-hidden overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Ad</th>
                  <th className="px-3 py-3">Tip</th>
                  <th className="px-3 py-3 text-right">Yıl</th>
                  <th className="px-3 py-3">Dağıtım Tarihi</th>
                  <th className="px-3 py-3">Sipariş Kilit</th>
                  <th className="px-3 py-3">Durum</th>
                  <th className="px-3 py-3 text-right">Kalem</th>
                  <th className="px-3 py-3">Detay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {planlar.map((plan) => (
                  <tr key={plan.id} className={selectedPlanId === plan.id ? 'bg-slate-50' : ''}>
                    <td className="px-3 py-3 font-medium text-slate-900">{plan.ad}</td>
                    <td className="px-3 py-3">{plan.sezonTipi === 'YAZLIK' ? 'Yazlık' : 'Kışlık'}</td>
                    <td className="px-3 py-3 text-right">{plan.yil}</td>
                    <td className="px-3 py-3">
                      {plan.dagitimTarihi ? new Date(plan.dagitimTarihi).toLocaleDateString('tr-TR') : '-'}
                    </td>
                    <td className="px-3 py-3">
                      {plan.siparisKilitTarihi
                        ? new Date(plan.siparisKilitTarihi).toLocaleDateString('tr-TR')
                        : '-'}
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        {plan.durum}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">{plan.kalemler.length}</td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => handlePlanSec(plan.id)}
                        className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Detay
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedPlanId && (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          {detayLoading ? (
            <p className="text-sm text-slate-500">Detay yükleniyor...</p>
          ) : !planDetay ? (
            <p className="text-sm text-slate-500">Detay bulunamadı.</p>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{planDetay.ad}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {planDetay.sezonTipi === 'YAZLIK' ? 'Yazlık' : 'Kışlık'} — {planDetay.yil}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="font-semibold text-slate-900">
                  İşe Alım / Turnover / Emniyet Payı (bu plana özel)
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  Boş bırakılırsa Parametreler sekmesindeki (veya otomatik öneri) varsayılan
                  kullanılır.
                </p>

                <div className="mt-3 grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-sm font-medium">Planlanan İşe Alım (kişi)</label>
                    <input
                      type="number"
                      min={0}
                      value={overridePlanlananAlim}
                      onChange={(e) => setOverridePlanlananAlim(e.target.value)}
                      placeholder="Boş = otomatik öneri"
                      className="mt-1 w-full rounded-xl border p-2 text-sm"
                    />
                    {planlananAlimOnerisi && (
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>
                          Öneri: {planlananAlimOnerisi.value} açık kadro
                          {planlananAlimOnerisi.yok ? ' (öneri yok)' : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => setOverridePlanlananAlim(String(planlananAlimOnerisi.value))}
                          className="rounded-lg border px-2 py-0.5 font-medium text-teal-700 hover:bg-teal-50"
                        >
                          Öneriyi Kullan
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium">Turnover Oranı (%)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      value={overrideTurnoverOrani}
                      onChange={(e) => setOverrideTurnoverOrani(e.target.value)}
                      placeholder={`Varsayılan: %${sezonParametre?.turnoverOrani ?? 0}`}
                      className="mt-1 w-full rounded-xl border p-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Emniyet Payı (%)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      value={overrideEmniyetPayiOrani}
                      onChange={(e) => setOverrideEmniyetPayiOrani(e.target.value)}
                      placeholder={`Varsayılan: %${sezonParametre?.emniyetPayiOrani ?? 0}`}
                      className="mt-1 w-full rounded-xl border p-2 text-sm"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOverrideKaydet}
                  disabled={overrideSaving}
                  className="mt-3 rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                >
                  {overrideSaving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900">Kalemler</h4>
                <div className="mt-2 overflow-hidden overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-3">Ürün</th>
                        <th className="px-3 py-3 text-right">Kişi Başı Adet</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {planDetay.kalemler.map((kalem) => (
                        <tr key={kalem.id}>
                          <td className="px-3 py-3">
                            {kalem.urun.kod} - {kalem.urun.ad}
                          </td>
                          <td className="px-3 py-3 text-right">{kalem.kisiBasiAdet}</td>
                        </tr>
                      ))}
                      {planDetay.kalemler.length === 0 && (
                        <tr>
                          <td colSpan={2} className="px-3 py-3 text-sm text-slate-500">
                            Henüz kalem eklenmedi.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="min-w-48">
                    <label className="text-sm font-medium">Ürün</label>
                    <select
                      value={yeniKalemUrunId}
                      onChange={(e) => setYeniKalemUrunId(e.target.value)}
                      className="mt-1 w-full rounded-xl border p-2 text-sm"
                    >
                      <option value="">Seçiniz</option>
                      {urunler.map((urun) => (
                        <option key={urun.id} value={urun.id}>
                          {urun.kod} - {urun.ad}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Kişi Başı Adet</label>
                    <input
                      type="number"
                      min={1}
                      value={yeniKalemKisiBasi}
                      onChange={(e) => setYeniKalemKisiBasi(e.target.value)}
                      className="mt-1 w-24 rounded-xl border p-2 text-sm"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleKalemEkle}
                    disabled={kalemEkleSaving}
                    className="flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" />
                    {kalemEkleSaving ? 'Ekleniyor...' : 'Kalem Ekle'}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleIhtiyacHesapla}
                    disabled={ihtiyacLoading || planDetay.kalemler.length === 0}
                    className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                  >
                    {ihtiyacLoading ? 'Hesaplanıyor...' : 'İhtiyaç Hesapla'}
                  </button>

                  {ihtiyacSonuc && (
                    <button
                      type="button"
                      onClick={handleSatinAlmaTalebiOlustur}
                      disabled={!netEksikVarMi || talepOlusturSaving}
                      className="rounded-xl border border-teal-700 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-60"
                    >
                      {talepOlusturSaving ? 'Oluşturuluyor...' : 'Satın Alma Talebi Oluştur'}
                    </button>
                  )}
                </div>

                {ihtiyacSonuc && (
                  <>
                    <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                      Baz: {ihtiyacSonuc.ozet.bazPersonel} kişi + Planlanan alım:{' '}
                      {ihtiyacSonuc.ozet.planlananAlim} + Turnover (%{ihtiyacSonuc.ozet.turnoverOrani}
                      ): {ihtiyacSonuc.ozet.turnoverKisi} ={' '}
                      {ihtiyacSonuc.ozet.bazPersonel +
                        ihtiyacSonuc.ozet.planlananAlim +
                        ihtiyacSonuc.ozet.turnoverKisi}{' '}
                      kişi · Emniyet payı: %{ihtiyacSonuc.ozet.emniyetOrani}
                    </p>

                    <div className="mt-2 overflow-hidden overflow-x-auto rounded-xl border">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                          <tr>
                            <th className="px-3 py-3">Ürün</th>
                            <th className="px-3 py-3">Beden</th>
                            <th className="px-3 py-3 text-right">Mevcut Personel</th>
                            <th className="px-3 py-3 text-right">Yeni Alım</th>
                            <th className="px-3 py-3 text-right">Turnover</th>
                            <th className="px-3 py-3 text-right">Emniyet</th>
                            <th className="px-3 py-3 text-right">Toplam İhtiyaç</th>
                            <th className="px-3 py-3 text-right">Mevcut Stok</th>
                            <th className="px-3 py-3 text-right">Net Eksik</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {ihtiyacSonuc.satirlar.map((satir, i) => (
                            <tr key={i}>
                              <td className="px-3 py-3">
                                {satir.urunKod} - {satir.urunAd}
                              </td>
                              <td className="px-3 py-3">
                                {satir.beden === 'BİLİNMİYOR' ? (
                                  <span className="text-amber-700">
                                    Bilinmiyor ({satir.bedenBilinmeyenSayisi} kişi)
                                  </span>
                                ) : (
                                  satir.beden ?? '-'
                                )}
                              </td>
                              <td className="px-3 py-3 text-right">{satir.mevcutPersonelSayisi}</td>
                              <td className="px-3 py-3 text-right">{satir.yeniAlimSayisi}</td>
                              <td className="px-3 py-3 text-right">{satir.turnoverSayisi}</td>
                              <td className="px-3 py-3 text-right">{satir.emniyetAdet}</td>
                              <td className="px-3 py-3 text-right font-medium">{satir.toplamIhtiyac}</td>
                              <td className="px-3 py-3 text-right">{satir.mevcutStok}</td>
                              <td
                                className={`px-3 py-3 text-right font-medium ${satir.netEksik > 0 ? 'text-rose-700' : 'text-slate-500'}`}
                              >
                                {satir.netEksik}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Beden Profilleri</h3>
            <p className="mt-1 text-sm text-slate-500">
              Personel bazlı üst beden / alt beden / ayakkabı no / eldiven no bilgisi. Sezon
              ihtiyaç hesabı bu bilgileri kullanır.
            </p>
          </div>

          <div className="flex flex-shrink-0 gap-2">
            <button
              type="button"
              onClick={handleBedenSablonIndir}
              className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              <Download className="h-4 w-4" />
              Şablon İndir
            </button>
            <button
              type="button"
              onClick={() => setShowBedenImport((prev) => !prev)}
              className="flex items-center gap-2 rounded-xl border border-teal-700 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50"
            >
              <Upload className="h-4 w-4" />
              {showBedenImport ? 'Vazgeç' : "Excel'den Yükle"}
            </button>
          </div>
        </div>

        {showBedenImport && (
          <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-sm font-medium">Excel Dosyası (.xlsx)</label>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={handleBedenImportDosyaSec}
                  className="mt-1 block rounded-xl border p-2 text-sm"
                />
              </div>

              <button
                type="button"
                onClick={handleBedenImportDogrula}
                disabled={!bedenImportDosya || bedenImportValidating}
                className="rounded-xl border border-teal-700 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-60"
              >
                {bedenImportValidating ? 'Doğrulanıyor...' : 'Doğrula'}
              </button>

              <button
                type="button"
                onClick={handleBedenImportIceriAktar}
                disabled={!bedenImportRapor || bedenImportRapor.hatalar.length > 0 || bedenImportExecuting}
                className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {bedenImportExecuting ? 'Aktarılıyor...' : 'İçeri Aktar'}
              </button>
            </div>

            {bedenImportRapor && (
              <div className="space-y-2 text-sm">
                <p>
                  Geçerli (eşleşen) satır: <strong>{bedenImportRapor.gecerliSayisi}</strong> —
                  Eşleşmeyen sicil: <strong>{bedenImportRapor.eslesmeyenSicil.length}</strong>
                </p>

                {bedenImportRapor.eslesmeyenSicil.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {bedenImportRapor.eslesmeyenSicil.map((sicil) => (
                      <span
                        key={sicil}
                        className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700"
                      >
                        {sicil}
                      </span>
                    ))}
                  </div>
                )}

                {bedenImportRapor.hatalar.length > 0 && (
                  <div className="overflow-hidden overflow-x-auto rounded-xl border">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Satır</th>
                          <th className="px-3 py-2">Sicil</th>
                          <th className="px-3 py-2">Mesaj</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bedenImportRapor.hatalar.map((hata, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-right">{hata.satirNo}</td>
                            <td className="px-3 py-2">{hata.sicilNo || '-'}</td>
                            <td className="px-3 py-2 text-rose-700">{hata.mesaj}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {bedenImportRapor.hatalar.length === 0 && (
                  <p className="text-emerald-700">Hata yok — "İçeri Aktar" ile devam edebilirsiniz.</p>
                )}
              </div>
            )}

            {bedenImportSonuc && (
              <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
                {bedenImportSonuc.guncellenen} kayıt güncellendi, {bedenImportSonuc.atlanan} satır
                atlandı.
              </div>
            )}
          </div>
        )}

        <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-5">
          <div className="md:col-span-1">
            <label className="text-sm font-medium">Personel</label>
            <select
              value={bedenPersonelId}
              onChange={(e) => setBedenPersonelId(e.target.value)}
              className="mt-1 w-full rounded-xl border p-2 text-sm"
            >
              <option value="">Seçiniz</option>
              {personeller.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sicilNo} - {p.adSoyad}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Üst Beden</label>
            <input
              value={bedenUst}
              onChange={(e) => setBedenUst(e.target.value)}
              className="mt-1 w-full rounded-xl border p-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Alt Beden</label>
            <input
              value={bedenAlt}
              onChange={(e) => setBedenAlt(e.target.value)}
              className="mt-1 w-full rounded-xl border p-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Ayakkabı No</label>
            <input
              value={bedenAyakkabi}
              onChange={(e) => setBedenAyakkabi(e.target.value)}
              className="mt-1 w-full rounded-xl border p-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Eldiven No</label>
            <input
              value={bedenEldiven}
              onChange={(e) => setBedenEldiven(e.target.value)}
              className="mt-1 w-full rounded-xl border p-2 text-sm"
            />
          </div>

          <div className="md:col-span-4">
            <label className="text-sm font-medium">Not</label>
            <input
              value={bedenNot}
              onChange={(e) => setBedenNot(e.target.value)}
              className="mt-1 w-full rounded-xl border p-2 text-sm"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleBedenProfilKaydet}
              disabled={bedenSaving}
              className="w-full rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {bedenSaving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>

        <div className="mt-4">
          {bedenProfilLoading ? (
            <p className="text-sm text-slate-500">Yükleniyor...</p>
          ) : bedenProfilleri.length === 0 ? (
            <p className="text-sm text-slate-500">Henüz beden profili girilmedi.</p>
          ) : (
            <div className="overflow-hidden overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Sicil</th>
                    <th className="px-3 py-3">Ad Soyad</th>
                    <th className="px-3 py-3">Bölüm</th>
                    <th className="px-3 py-3">Üst Beden</th>
                    <th className="px-3 py-3">Alt Beden</th>
                    <th className="px-3 py-3">Ayakkabı No</th>
                    <th className="px-3 py-3">Eldiven No</th>
                    <th className="px-3 py-3">Düzenle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bedenProfilleri.map((profil) => (
                    <tr key={profil.id}>
                      <td className="px-3 py-3">{profil.personnel.sicilNo ?? '-'}</td>
                      <td className="px-3 py-3 font-medium text-slate-900">{profil.personnel.adSoyad}</td>
                      <td className="px-3 py-3">{profil.personnel.bolum}</td>
                      <td className="px-3 py-3">{profil.ustBeden ?? '-'}</td>
                      <td className="px-3 py-3">{profil.altBeden ?? '-'}</td>
                      <td className="px-3 py-3">{profil.ayakkabiNo ?? '-'}</td>
                      <td className="px-3 py-3">{profil.eldivenNo ?? '-'}</td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => handleBedenProfilDuzenle(profil)}
                          className="rounded-lg border px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                        >
                          Düzenle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
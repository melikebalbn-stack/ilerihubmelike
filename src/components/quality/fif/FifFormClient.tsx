'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { fifEtiket } from '@/lib/quality/fif-durum-etiket'
import { faaliyetKapaliMi, faaliyetTerminEtiketleri, faaliyetDurumu, type TerminEtiketi } from '@/lib/quality/fif-termin'
import { FifFaaliyetIslemleri, type BekleyenTalep } from '@/components/quality/fif/FifFaaliyetIslemleri'

/** Faz 1: Rev 3 sayfa sırasıyla bölümler; zorunluluk validator'da (tur+bölüm+tespit). */
type Bolum = { id: string; name: string }
type Kaynak = { id: string; ad: string; aktif: boolean }
type Faaliyet = {
  id?: string
  sira: number
  aciklama: string
  aksiyonTuru: string
  hedefTarih: string
  sorumluUserId: string
  /** Sunucudaki (kayıtlı) hedef tarih — FAALIYET'te doluysa formda kilitli. */
  kayitliHedef: string
  // Salt-okunur termin bilgisi (rozetler + kapalı kilidi) — payload'a GİRMEZ.
  ilkHedefTarih: string | null
  gerceklesenTarih: string | null
  sonuc: string | null
  etkinlikPlanTarihi: string | null
  etkinlikUygun: boolean | null
  bekleyenTalep: BekleyenTalep | null
}

type InitialFaaliyet = {
  id: string; sira: number; aciklama: string; hedefTarih: string | null; aksiyonTuru: string | null
  sorumluUserId: string | null; ilkHedefTarih: string | null; gerceklesenTarih: string | null; sonuc: string | null
  etkinlikPlanTarihi: string | null; etkinlikUygun: boolean | null; bekleyenTalep: BekleyenTalep | null
}

const TON_SINIF: Record<TerminEtiketi['ton'], string> = {
  basari: 'border-green-200 bg-green-50 text-green-700',
  uyari: 'border-amber-200 bg-amber-50 text-amber-800',
  tehlike: 'border-red-200 bg-red-50 text-red-700',
}

export type FifInitial = {
  id: string
  /** Paket 3: "Kayda Al"a kadar NULL → "Taslak". */
  kayitNo: string | null
  tur: 'DUZELTICI' | 'ONLEYICI'
  tarih: string
  durum: string
  sorumluBolumId: string | null
  yayinlayanBolumId: string | null
  sorumluOnaylayanUserId: string | null
  yayinlayanOnaylayanUserId: string | null
  izlemeSorumlusuUserId: string | null
  kaynakId: string | null
  /** Eski serbest metin kaynak — yalnız kaynakId boşsa salt-okunur gösterilir. */
  denetlemeAdi: string | null
  uygunsuzlukTanimi: string | null
  standartMadde: string | null
  ekTerminNedeni: string | null
  kokNedenAnalizi: string | null
  kysDegisikligi: boolean
  riskFirsatGuncelleme: boolean
  ogrenilenDers: boolean
  yayilimVarMi: boolean
  yayilimAciklama: string | null
  faaliyetler: InitialFaaliyet[]
} | null

const kartLabel = 'text-xs font-medium text-slate-600'
const bolumBaslik = 'text-sm font-semibold text-[#1B4F72] uppercase tracking-wide'

/**
 * kullaniciAdlari: kayıtlı userId → ad soyad (sunucuda tek sorguda çözülür).
 * Yoksa ekranda "Seçili" kalıyordu — kişi bilgisi kaybolmuş gibi görünüyordu.
 * aktifKullaniciId: satır işlemi "Ek Termin İste" yalnız satırın sorumlusuna görünür.
 * duzenlenebilir: false → form SALT-OKUNUR (Paket 3b-2: yalnız satır sorumlusu olan
 * kullanıcı formu görür ama düzenleyemez; satır işlemleri yine çalışır).
 * isKss: satır "Sonuç Gir" (K/YT) + ek termin kararı + satır etkinlik kontrolü butonları.
 * faaliyetPlanlayabilir (Paket 4): satır ekleme, hedef tarih, uygulama sorumlusu atama —
 * FAALIYET'te izleme sorumlusu / sorumlu bölüm müdürü / manage (sunucu da aynı kuralı uygular).
 * kokNedenDolu (Paket 4): kayıtlı kök neden (özet / Ek-1 / 5 Neden) var mı — yoksa
 * ve formda da özet yazılmamışsa faaliyet bölümü pasif ("Önce kök neden…").
 */
export function FifFormClient({
  initial, kullaniciAdlari = {}, aktifKullaniciId = null, duzenlenebilir = true, isKss = false,
  faaliyetPlanlayabilir = false, kokNedenDolu = false,
}: {
  initial: FifInitial
  kullaniciAdlari?: Record<string, string>
  aktifKullaniciId?: string | null
  duzenlenebilir?: boolean
  isKss?: boolean
  faaliyetPlanlayabilir?: boolean
  kokNedenDolu?: boolean
}) {
  const router = useRouter()
  const duzenleme = !!initial
  const iptalli = initial?.durum === 'IPTAL'
  const ro = iptalli || !duzenlenebilir

  const [bolumler, setBolumler] = useState<Bolum[]>([])
  const [tur, setTur] = useState(initial?.tur ?? 'DUZELTICI')
  const [tarih, setTarih] = useState(initial?.tarih ? initial.tarih.slice(0, 10) : new Date().toISOString().slice(0, 10))
  const [sorumluBolumId, setSorumluBolumId] = useState(initial?.sorumluBolumId ?? '')
  const [yayinlayanBolumId, setYayinlayanBolumId] = useState(initial?.yayinlayanBolumId ?? '')
  const [onaylayanAd, setOnaylayanAd] = useState<string>('')
  const [sorumluOnaylayanUserId, setSorumluOnaylayanUserId] = useState(initial?.sorumluOnaylayanUserId ?? '')
  const [yayinlayanOnaylayanUserId, setYayinlayanOnaylayanUserId] = useState(initial?.yayinlayanOnaylayanUserId ?? '')
  const [yayinlayanOnaylayanAd, setYayinlayanOnaylayanAd] = useState('')
  // Paket 4: izleme sorumlusunu sorumlu bölüm müdürü "Sorumlu Bölüm Onayı"nda seçer —
  // formda yalnız gösterilir, payload'a GİRMEZ (kayıttaki değer korunur).
  const izlemeSorumlusuUserId = initial?.izlemeSorumlusuUserId ?? ''
  const [kaynaklar, setKaynaklar] = useState<Kaynak[]>([])
  const [kaynakId, setKaynakId] = useState(initial?.kaynakId ?? '')
  const [uygunsuzlukTanimi, setUygunsuzlukTanimi] = useState(initial?.uygunsuzlukTanimi ?? '')
  const [standartMadde, setStandartMadde] = useState(initial?.standartMadde ?? '')
  const [kokNedenAnalizi, setKokNedenAnalizi] = useState(initial?.kokNedenAnalizi ?? '')
  // Kapanış değerlendirmesi (Rev 3 son sayfa) — alanlar şemada vardı, ekranda YOKTU.
  const [kysDegisikligi, setKysDegisikligi] = useState(initial?.kysDegisikligi ?? false)
  const [riskFirsatGuncelleme, setRiskFirsatGuncelleme] = useState(initial?.riskFirsatGuncelleme ?? false)
  const [ogrenilenDers, setOgrenilenDers] = useState(initial?.ogrenilenDers ?? false)
  const [yayilimVarMi, setYayilimVarMi] = useState(initial?.yayilimVarMi ?? false)
  const [yayilimAciklama, setYayilimAciklama] = useState(initial?.yayilimAciklama ?? '')
  const [faaliyetler, setFaaliyetler] = useState<Faaliyet[]>(
    initial?.faaliyetler?.map((f) => ({
      id: f.id, sira: f.sira, aciklama: f.aciklama,
      aksiyonTuru: f.aksiyonTuru ?? '',
      hedefTarih: f.hedefTarih?.slice(0, 10) ?? '',
      sorumluUserId: f.sorumluUserId ?? '',
      kayitliHedef: f.hedefTarih?.slice(0, 10) ?? '',
      ilkHedefTarih: f.ilkHedefTarih, gerceklesenTarih: f.gerceklesenTarih, sonuc: f.sonuc,
      etkinlikPlanTarihi: f.etkinlikPlanTarihi, etkinlikUygun: f.etkinlikUygun, bekleyenTalep: f.bekleyenTalep,
    })) ?? [],
  )
  const faaliyetAsamasi = initial?.durum === 'FAALIYET'
  const planlamaAsamasi = faaliyetAsamasi
  // Kaydedilmemiş özet metin de sayılır — PUT aynı kayıtta gelen kök nedeni dikkate alır.
  const kokNedenHazir = kokNedenDolu || !!kokNedenAnalizi.trim()
  const satirEkleyebilir = !ro && faaliyetPlanlayabilir && kokNedenHazir
  const [kaydediyor, setKaydediyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/kalite/fif/bolumler').then((r) => (r.ok ? r.json() : { bolumler: [] })).then((d) => setBolumler(d.bolumler ?? [])).catch(() => {})
    fetch('/api/kalite/fif/kaynak').then((r) => (r.ok ? r.json() : { kaynaklar: [] })).then((d) => setKaynaklar(d.kaynaklar ?? [])).catch(() => {})
  }, [])

  // Seçimde yalnız AKTİF kaynaklar; kayıttaki kaynak sonradan pasife alındıysa
  // "(pasif)" olarak listede kalır (seçim kaybolmasın, yeniden seçilemez).
  const kaynakSecenekleri = kaynaklar.filter((k) => k.aktif || k.id === kaynakId)

  // Sorumlu bölüm seçilince müdür otomatik dolar (kullanıcı elle değiştirebilir).
  async function bolumMuduruGetir(bolumId: string) {
    if (!bolumId) { setOnaylayanAd(''); setSorumluOnaylayanUserId(''); return }
    try {
      const r = await fetch(`/api/kalite/fif/bolum-muduru?bolumId=${bolumId}`)
      if (!r.ok) return
      const d = await r.json()
      if (d.onaylayan) { setSorumluOnaylayanUserId(d.onaylayan.userId); setOnaylayanAd(d.onaylayan.ad) }
      else { setSorumluOnaylayanUserId(''); setOnaylayanAd('(müdür tanımlı değil)') }
    } catch { /* sessiz */ }
  }
  // Yayınlayan bölüm seçilince yayınlayan onaylayan (müdür) otomatik dolar.
  async function yayinlayanMuduruGetir(bolumId: string) {
    if (!bolumId) { setYayinlayanOnaylayanAd(''); setYayinlayanOnaylayanUserId(''); return }
    try {
      const r = await fetch(`/api/kalite/fif/bolum-muduru?bolumId=${bolumId}`)
      if (!r.ok) return
      const d = await r.json()
      if (d.onaylayan) { setYayinlayanOnaylayanUserId(d.onaylayan.userId); setYayinlayanOnaylayanAd(d.onaylayan.ad) }
      else { setYayinlayanOnaylayanUserId(''); setYayinlayanOnaylayanAd('(müdür tanımlı değil)') }
    } catch { /* sessiz */ }
  }

  function addFaaliyet() {
    setFaaliyetler((p) => [...p, {
      sira: p.length + 1, aciklama: '', aksiyonTuru: '', hedefTarih: '', sorumluUserId: '',
      kayitliHedef: '', ilkHedefTarih: null, gerceklesenTarih: null, sonuc: null,
      etkinlikPlanTarihi: null, etkinlikUygun: null, bekleyenTalep: null,
    }])
  }
  function updFaaliyet(i: number, patch: Partial<Faaliyet>) {
    setFaaliyetler((p) => p.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  }
  function delFaaliyet(i: number) {
    setFaaliyetler((p) => p.filter((_, idx) => idx !== i).map((f, idx) => ({ ...f, sira: idx + 1 })))
  }

  async function kaydet() {
    setHata(null)
    // Taslak kısmi kaydedilebilir — zorunlu alanlar "Onaya Gönder" geçişinde
    // uygulanır (fif-durum ön koşulu). Burada engel yok.
    setKaydediyor(true)
    const payload = {
      tur, tarih, sorumluBolumId,
      yayinlayanBolumId: yayinlayanBolumId || null,
      sorumluOnaylayanUserId: sorumluOnaylayanUserId || null,
      yayinlayanOnaylayanUserId: yayinlayanOnaylayanUserId || null,
      kaynakId: kaynakId || null,
      uygunsuzlukTanimi,
      standartMadde: standartMadde || null,
      kokNedenAnalizi: kokNedenAnalizi || null,
      kysDegisikligi, riskFirsatGuncelleme, ogrenilenDers,
      yayilimVarMi,
      yayilimAciklama: yayilimAciklama || null,
      // id → PUT mevcut satırı günceller (paraf/sonuç korunur); id'siz → yeni satır.
      faaliyetler: faaliyetler.filter((f) => f.aciklama.trim()).map((f) => ({
        ...(f.id ? { id: f.id } : {}),
        sira: f.sira, aciklama: f.aciklama,
        aksiyonTuru: f.aksiyonTuru || null,
        hedefTarih: f.hedefTarih || null,
        sorumluUserId: f.sorumluUserId || null,
      })),
    }
    try {
      const url = duzenleme ? `/api/kalite/fif/${initial!.id}` : '/api/kalite/fif'
      const r = await fetch(url, { method: duzenleme ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setHata(d.error ?? 'Kayıt başarısız'); setKaydediyor(false); return }
      router.push(`/kalite/fif/${duzenleme ? initial!.id : d.item.id}`)
      router.refresh()
    } catch { setHata('Ağ hatası'); setKaydediyor(false) }
  }

  const taslakMi = initial?.durum === 'TASLAK'
  async function iptalEt() {
    if (!duzenleme) return
    const soru = taslakMi ? 'Taslak silinsin mi?' : 'FİF iptal edilsin mi?'
    if (!confirm(soru)) return
    setKaydediyor(true)
    const r = await fetch(`/api/kalite/fif/${initial!.id}`, { method: 'DELETE' })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setHata(d.error ?? 'İşlem başarısız'); setKaydediyor(false); return }
    // Hard delete → kayıt yok; IPTAL → kayıt var ama işlem yok. Her iki hâlde de
    // detayda kalınırsa 404 (hard) / boş ekran olur; listeye dön + toast.
    toast.success(d.silindi === 'hard' ? 'Taslak silindi' : 'FİF iptal edildi')
    router.push('/kalite/fif')
    router.refresh()
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {duzenleme && (
        <div className="flex items-center justify-between rounded-md border bg-white p-3">
          <div className={`font-semibold ${initial!.kayitNo ? 'text-[#1B4F72]' : 'italic text-slate-500'}`}>{fifEtiket(initial!)}</div>
          <div className="text-xs text-slate-500">
            {iptalli ? 'İptal edildi (düzenlenemez)' : !duzenlenebilir ? 'Salt-okunur — yalnız kendi satırınızda işlem yapabilirsiniz' : ''}
          </div>
        </div>
      )}

      {/* 1. Başlık / kimlik */}
      <div className="rounded-md border bg-white p-4 space-y-3">
        <h3 className={bolumBaslik}>Form Bilgileri</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className={kartLabel}>Tür *</Label>
            <Select value={tur} onValueChange={(v) => setTur(v as typeof tur)} disabled={ro}>
              <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DUZELTICI">Düzeltici</SelectItem>
                <SelectItem value="ONLEYICI">Önleyici</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className={kartLabel}>Tarih</Label>
            <Input type="date" className="mt-1 h-9" value={tarih} onChange={(e) => setTarih(e.target.value)} disabled={ro} />
          </div>
          <div>
            <Label className={kartLabel}>Denetleme / Kaynak</Label>
            <Select value={kaynakId || 'none'} onValueChange={(v) => setKaynakId(v === 'none' ? '' : v)} disabled={ro}>
              <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Seçin" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {kaynakSecenekleri.map((k) => (
                  <SelectItem key={k.id} value={k.id} disabled={!k.aktif}>{k.ad}{k.aktif ? '' : ' (pasif)'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!kaynakId && initial?.denetlemeAdi && (
              <p className="mt-1 text-[11px] text-slate-500">Eski kayıt: <span className="font-medium">{initial.denetlemeAdi}</span></p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className={kartLabel}>Sorumlu Bölüm *</Label>
            <Select value={sorumluBolumId} onValueChange={(v) => { setSorumluBolumId(v); bolumMuduruGetir(v) }} disabled={ro}>
              <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Seçin" /></SelectTrigger>
              <SelectContent>
                {bolumler.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className={kartLabel}>Yayınlayan Bölüm *</Label>
            <Select value={yayinlayanBolumId || 'none'} onValueChange={(v) => { const nv = v === 'none' ? '' : v; setYayinlayanBolumId(nv); yayinlayanMuduruGetir(nv) }} disabled={ro}>
              <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Seçin" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {bolumler.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className={kartLabel}>Sorumlu Onaylayan (müdür — otomatik)</Label>
            <Input className="mt-1 h-9" value={onaylayanAd || (sorumluOnaylayanUserId ? kullaniciAdlari[sorumluOnaylayanUserId] ?? 'Seçili' : '')} readOnly placeholder="bölüm seçince dolar" />
          </div>
        </div>
      </div>

      {/* 1b. Sorumlular / onaylayanlar */}
      <div className="rounded-md border bg-white p-4 space-y-3">
        <h3 className={bolumBaslik}>Sorumlular</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className={kartLabel}>Yayınlayan Onaylayan (müdür — otomatik)</Label>
            <Input className="mt-1 h-9" value={yayinlayanOnaylayanAd || (yayinlayanOnaylayanUserId ? kullaniciAdlari[yayinlayanOnaylayanUserId] ?? 'Seçili' : '')} readOnly placeholder="yayınlayan bölüm seçince dolar" />
          </div>
          <div>
            <Label className={kartLabel}>Faaliyet İzleme Sorumlusu (sorumlu bölüm müdürü seçer)</Label>
            <Input className="mt-1 h-9" value={izlemeSorumlusuUserId ? kullaniciAdlari[izlemeSorumlusuUserId] ?? 'Seçili' : ''} readOnly placeholder="Sorumlu Bölüm Onayı'nda seçilir" />
          </div>
        </div>
      </div>

      {/* 2. Tespit */}
      <div className="rounded-md border bg-white p-4 space-y-3">
        <h3 className={bolumBaslik}>Uygunsuzluk / Tespit *</h3>
        <Textarea rows={3} value={uygunsuzlukTanimi} onChange={(e) => setUygunsuzlukTanimi(e.target.value)} disabled={ro} placeholder="Tespit edilen uygunsuzluk…" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className={kartLabel}>İlgili Standart Madde</Label>
            <Input className="mt-1 h-9" value={standartMadde} onChange={(e) => setStandartMadde(e.target.value)} disabled={ro} />
          </div>
          {/* ESKİ alan (FİF geneli ek termin nedeni): yalnız doluysa salt-okunur.
              Yeni ek termin nedenleri satırdaki talepte ve Geçmiş'te tutulur. */}
          {initial?.ekTerminNedeni && (
            <div>
              <Label className={kartLabel}>Ek Termin Nedeni (eski kayıt)</Label>
              <p className="mt-1 min-h-9 rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-600">{initial.ekTerminNedeni}</p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Kök neden (Paket 4: faaliyetlerden ÖNCE — kök neden boşken faaliyet eklenemez) */}
      <div className="rounded-md border bg-white p-4 space-y-2">
        <h3 className={bolumBaslik}>Kök Neden Analizi</h3>
        <Textarea rows={2} value={kokNedenAnalizi} onChange={(e) => setKokNedenAnalizi(e.target.value)} disabled={ro} placeholder="Özet kök neden (Ek-1 balık kılçığı / 5 Neden Faz 3'te)" />
        <p className="text-[11px] text-slate-400">Ek-1 (balık kılçığı 9 kategori + 5 Neden) ve Ek-2 (öncesi/sonrası foto) Faz 3'te tamamlanacak.</p>
      </div>

      {/* 4. Faaliyetler */}
      <div className={`rounded-md border bg-white p-4 space-y-3 ${planlamaAsamasi && !kokNedenHazir ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between">
          <h3 className={bolumBaslik}>Faaliyetler</h3>
          {!ro && faaliyetPlanlayabilir && (
            <Button type="button" variant="outline" size="sm" onClick={addFaaliyet} disabled={!satirEkleyebilir}>+ Satır</Button>
          )}
        </div>
        {planlamaAsamasi && !kokNedenHazir && (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Önce kök neden analizini doldurun (özet, Ek-1 balık kılçığı veya 5 Neden). Ardından faaliyet satırları eklenebilir.
          </p>
        )}
        {!planlamaAsamasi && faaliyetler.length === 0 &&
          (initial?.durum === 'TASLAK' || initial?.durum === 'KSS_KAYIT_BEKLIYOR' || initial?.durum === 'SORUMLU_ATAMA_BEKLIYOR') && (
          <p className="text-xs text-slate-500">
            Kök neden ve faaliyetler, Sorumlu Bölüm Onayı&apos;ndan sonra faaliyet izleme sorumlusu ve sorumlu bölüm müdürü tarafından planlanır.
          </p>
        )}
        {faaliyetler.length === 0 ? (
          <p className="text-xs text-slate-400">Henüz faaliyet yok.</p>
        ) : faaliyetler.map((f, i) => {
          // Kapalı satır (KSS "Sonuç Gir" → K) formdan düzenlenmez; FAALIYET'te kayıtlı
          // hedef tarih kilitli (değişiklik ek süre akışıyla) — sunucu da aynı kuralı uygular.
          // Uygulama sorumlusu yalnız izleme sorumlusu / sorumlu bölüm müdürü / manage tarafından atanır (faaliyetPlanlayabilir).
          const kapali = faaliyetKapaliMi(f)
          const satirRo = ro || kapali
          // FAALIYET'te hedef tarih girmek planlamadır (izleme sorumlusu / müdür / manage).
          const hedefKilitli = satirRo || (faaliyetAsamasi && (!!f.kayitliHedef || !faaliyetPlanlayabilir))
          const rozetler = faaliyetTerminEtiketleri(
            { hedefTarih: f.kayitliHedef || null, ilkHedefTarih: f.ilkHedefTarih, gerceklesenTarih: f.gerceklesenTarih, sonuc: f.sonuc },
            new Date(),
          )
          const durumRozeti = faaliyetDurumu({
            sonuc: f.sonuc, gerceklesenTarih: f.gerceklesenTarih, etkinlikPlanTarihi: f.etkinlikPlanTarihi,
            etkinlikUygun: f.etkinlikUygun, bekleyenTalep: !!f.bekleyenTalep,
            sorumluAd: f.sorumluUserId ? kullaniciAdlari[f.sorumluUserId] ?? null : null,
          })
          return (
          <div key={f.id ?? `yeni-${i}`} className="border-t pt-2 space-y-2">
            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-1"><Label className={kartLabel}>#</Label><Input className="mt-1 h-9" value={f.sira} readOnly /></div>
              <div className="col-span-5"><Label className={kartLabel}>Açıklama</Label><Input className="mt-1 h-9" value={f.aciklama} onChange={(e) => updFaaliyet(i, { aciklama: e.target.value })} disabled={satirRo} /></div>
              <div className="col-span-2">
                <Label className={kartLabel}>Aksiyon Türü</Label>
                <select
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
                  value={f.aksiyonTuru}
                  onChange={(e) => updFaaliyet(i, { aksiyonTuru: e.target.value })}
                  disabled={satirRo}
                >
                  <option value="">—</option>
                  <option value="ACIL">Acil</option>
                  <option value="KALICI">Kalıcı</option>
                </select>
              </div>
              <div className="col-span-3"><Label className={kartLabel}>Hedef Tarih</Label><Input type="date" className="mt-1 h-9" value={f.hedefTarih} onChange={(e) => updFaaliyet(i, { hedefTarih: e.target.value })} disabled={hedefKilitli} /></div>
              <div className="col-span-1">{!satirRo && <Button type="button" variant="ghost" size="sm" onClick={() => delFaaliyet(i)}>✕</Button>}</div>
            </div>
            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-6">
                <UserSecici label="Uygulama Sorumlusu" value={f.sorumluUserId} kayitliAd={kullaniciAdlari[f.sorumluUserId]}
                  onChange={(id) => updFaaliyet(i, { sorumluUserId: id })} disabled={satirRo || !faaliyetPlanlayabilir} />
              </div>
              <div className="col-span-6 flex flex-wrap items-center justify-end gap-2 pb-1">
                {f.id && <Badge variant="outline" className={TON_SINIF[durumRozeti.ton]}>{durumRozeti.metin}</Badge>}
                {rozetler.map((r) => (
                  <Badge key={r.metin} variant="outline" className={TON_SINIF[r.ton]}>{r.metin}</Badge>
                ))}
              </div>
            </div>
            {f.id && initial && (
              <FifFaaliyetIslemleri
                fifId={initial.id}
                fifDurum={initial.durum}
                faaliyet={{
                  id: f.id, sira: f.sira, kayitliHedef: f.kayitliHedef, kapali, sorumluUserId: f.sorumluUserId, sonuc: f.sonuc,
                  etkinlikPlanTarihi: f.etkinlikPlanTarihi, etkinlikUygun: f.etkinlikUygun,
                }}
                bekleyenTalep={f.bekleyenTalep}
                aktifKullaniciId={aktifKullaniciId}
                isKss={isKss}
                kilitli={iptalli}
              />
            )}
          </div>
          )
        })}
      </div>

      {/* 5. Kapanış değerlendirmesi (Rev 3 son sayfa) — FAZ B'de KSS'ye kilitlenecek. */}
      <div className="rounded-md border bg-white p-4 space-y-3">
        <h3 className={bolumBaslik}>Kapanış Değerlendirmesi</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {([
            ['kys', 'KYS değişikliği gerekti', kysDegisikligi, setKysDegisikligi],
            ['risk', 'Risk/fırsat güncellendi', riskFirsatGuncelleme, setRiskFirsatGuncelleme],
            ['ders', 'Öğrenilen ders kaydedildi', ogrenilenDers, setOgrenilenDers],
          ] as const).map(([key, etiket, deger, setDeger]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={deger}
                onChange={(e) => (setDeger as (v: boolean) => void)(e.target.checked)}
                disabled={ro}
              />
              {etiket}
            </label>
          ))}
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4" checked={yayilimVarMi} onChange={(e) => setYayilimVarMi(e.target.checked)} disabled={ro} />
            Yayılım var (aynı/benzer uygunsuzluk başka proses, hat veya üründe de olabilir)
          </label>
          {yayilimVarMi && (
            <Textarea
              rows={2}
              className="mt-2"
              value={yayilimAciklama}
              onChange={(e) => setYayilimAciklama(e.target.value)}
              disabled={ro}
              placeholder="Nerelerde değerlendirildi, hangi aksiyon alındı… (yayılım işaretliyse zorunlu)"
            />
          )}
        </div>
      </div>

      {hata && <p className="text-sm text-red-600">{hata}</p>}

      <div className="flex gap-3">
        {!ro && <Button onClick={kaydet} disabled={kaydediyor} className="bg-[#1B4F72] hover:bg-[#1B4F72]/90">{kaydediyor ? 'Kaydediliyor…' : 'Kaydet'}</Button>}
        {duzenleme && !ro && <Button variant="outline" onClick={iptalEt} disabled={kaydediyor} className="text-red-600 border-red-300">{taslakMi ? 'Taslağı Sil' : 'İptal Et'}</Button>}
      </div>
    </div>
  )
}


/**
 * Basit kullanıcı seçici: arama → seç. Seçili userId'yi parent tutar.
 * kayitliAd: sayfa açılışında kayıtlı kişinin adı (arama yapılmadan gösterilir).
 */
export function UserSecici({ label, value, kayitliAd, onChange, disabled }: { label: string; value: string; kayitliAd?: string; onChange: (id: string) => void; disabled?: boolean }) {
  const [q, setQ] = useState('')
  const [sonuc, setSonuc] = useState<{ userId: string; ad: string; bolum: string }[]>([])
  const [secili, setSecili] = useState<string>('')
  const [acik, setAcik] = useState(false)
  useEffect(() => {
    if (q.trim().length < 2) { setSonuc([]); return }
    let iptal = false
    const t = setTimeout(() => {
      fetch(`/api/kalite/fif/kullanici-ara?q=${encodeURIComponent(q.trim())}`)
        .then((r) => (r.ok ? r.json() : { kullanicilar: [] }))
        .then((d) => { if (!iptal) setSonuc(d.kullanicilar ?? []) })
        .catch(() => {})
    }, 250)
    return () => { iptal = true; clearTimeout(t) }
  }, [q])
  return (
    <div className="relative">
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      {value && !acik ? (
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm">{secili || kayitliAd || 'Seçili'}</span>
          {!disabled && <button type="button" className="text-xs text-red-500" onClick={() => { onChange(''); setSecili(''); setAcik(true) }}>temizle</button>}
        </div>
      ) : (
        <Input className="mt-1 h-9" value={q} onChange={(e) => { setQ(e.target.value); setAcik(true) }} disabled={disabled} placeholder="ad ile ara…" />
      )}
      {acik && sonuc.length > 0 && (
        <div className="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded-md border bg-white shadow">
          {sonuc.map((u) => (
            <button key={u.userId} type="button" className="block w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50"
              onClick={() => { onChange(u.userId); setSecili(u.ad); setAcik(false); setQ('') }}>
              {u.ad} <span className="text-slate-400 text-xs">{u.bolum}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

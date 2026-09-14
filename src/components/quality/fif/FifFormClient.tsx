'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/** Faz 1: Rev 3 sayfa sırasıyla bölümler; zorunluluk validator'da (tur+bölüm+tespit). */
type Bolum = { id: string; name: string }
type Faaliyet = { id?: string; sira: number; aciklama: string; hedefTarih: string }

export type FifInitial = {
  id: string
  kayitNo: string
  tur: 'DUZELTICI' | 'ONLEYICI'
  tarih: string
  durum: string
  sorumluBolumId: string | null
  yayinlayanBolumId: string | null
  sorumluOnaylayanUserId: string | null
  yayinlayanOnaylayanUserId: string | null
  izlemeSorumlusuUserId: string | null
  uygulamaSorumlusuUserId: string | null
  takipSorumlusuUserId: string | null
  denetlemeAdi: string | null
  uygunsuzlukTanimi: string | null
  standartMadde: string | null
  ekTerminNedeni: string | null
  kokNedenAnalizi: string | null
  faaliyetler: { id: string; sira: number; aciklama: string; hedefTarih: string | null }[]
} | null

const kartLabel = 'text-xs font-medium text-slate-600'
const bolumBaslik = 'text-sm font-semibold text-[#1B4F72] uppercase tracking-wide'

export function FifFormClient({ initial }: { initial: FifInitial }) {
  const router = useRouter()
  const duzenleme = !!initial
  const iptalli = initial?.durum === 'IPTAL'
  const ro = iptalli

  const [bolumler, setBolumler] = useState<Bolum[]>([])
  const [tur, setTur] = useState(initial?.tur ?? 'DUZELTICI')
  const [tarih, setTarih] = useState(initial?.tarih ? initial.tarih.slice(0, 10) : new Date().toISOString().slice(0, 10))
  const [sorumluBolumId, setSorumluBolumId] = useState(initial?.sorumluBolumId ?? '')
  const [yayinlayanBolumId, setYayinlayanBolumId] = useState(initial?.yayinlayanBolumId ?? '')
  const [onaylayanAd, setOnaylayanAd] = useState<string>('')
  const [sorumluOnaylayanUserId, setSorumluOnaylayanUserId] = useState(initial?.sorumluOnaylayanUserId ?? '')
  const [yayinlayanOnaylayanUserId, setYayinlayanOnaylayanUserId] = useState(initial?.yayinlayanOnaylayanUserId ?? '')
  const [yayinlayanOnaylayanAd, setYayinlayanOnaylayanAd] = useState('')
  const [izlemeSorumlusuUserId, setIzlemeSorumlusuUserId] = useState(initial?.izlemeSorumlusuUserId ?? '')
  const [uygulamaSorumlusuUserId, setUygulamaSorumlusuUserId] = useState(initial?.uygulamaSorumlusuUserId ?? '')
  const [takipSorumlusuUserId, setTakipSorumlusuUserId] = useState(initial?.takipSorumlusuUserId ?? '')
  const [denetlemeAdi, setDenetlemeAdi] = useState(initial?.denetlemeAdi ?? '')
  const [uygunsuzlukTanimi, setUygunsuzlukTanimi] = useState(initial?.uygunsuzlukTanimi ?? '')
  const [standartMadde, setStandartMadde] = useState(initial?.standartMadde ?? '')
  const [ekTerminNedeni, setEkTerminNedeni] = useState(initial?.ekTerminNedeni ?? '')
  const [kokNedenAnalizi, setKokNedenAnalizi] = useState(initial?.kokNedenAnalizi ?? '')
  const [faaliyetler, setFaaliyetler] = useState<Faaliyet[]>(
    initial?.faaliyetler?.map((f) => ({ id: f.id, sira: f.sira, aciklama: f.aciklama, hedefTarih: f.hedefTarih?.slice(0, 10) ?? '' })) ?? [],
  )
  const [kaydediyor, setKaydediyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/kalite/fif/bolumler').then((r) => (r.ok ? r.json() : { bolumler: [] })).then((d) => setBolumler(d.bolumler ?? [])).catch(() => {})
  }, [])

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
    setFaaliyetler((p) => [...p, { sira: p.length + 1, aciklama: '', hedefTarih: '' }])
  }
  function updFaaliyet(i: number, patch: Partial<Faaliyet>) {
    setFaaliyetler((p) => p.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  }
  function delFaaliyet(i: number) {
    setFaaliyetler((p) => p.filter((_, idx) => idx !== i).map((f, idx) => ({ ...f, sira: idx + 1 })))
  }

  async function kaydet() {
    setHata(null)
    if (!tur) return setHata('Tür zorunlu')
    if (!sorumluBolumId) return setHata('Sorumlu bölüm zorunlu')
    if (!uygunsuzlukTanimi.trim()) return setHata('Tespit (uygunsuzluk tanımı) zorunlu')
    setKaydediyor(true)
    const payload = {
      tur, tarih, sorumluBolumId,
      yayinlayanBolumId: yayinlayanBolumId || null,
      sorumluOnaylayanUserId: sorumluOnaylayanUserId || null,
      yayinlayanOnaylayanUserId: yayinlayanOnaylayanUserId || null,
      izlemeSorumlusuUserId: izlemeSorumlusuUserId || null,
      uygulamaSorumlusuUserId: uygulamaSorumlusuUserId || null,
      takipSorumlusuUserId: takipSorumlusuUserId || null,
      denetlemeAdi: denetlemeAdi || null,
      uygunsuzlukTanimi,
      standartMadde: standartMadde || null,
      ekTerminNedeni: ekTerminNedeni || null,
      kokNedenAnalizi: kokNedenAnalizi || null,
      faaliyetler: faaliyetler.filter((f) => f.aciklama.trim()).map((f) => ({
        sira: f.sira, aciklama: f.aciklama, hedefTarih: f.hedefTarih || null,
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

  async function iptalEt() {
    if (!duzenleme || !confirm('FİF iptal edilsin mi? (kayıt silinmez)')) return
    setKaydediyor(true)
    const r = await fetch(`/api/kalite/fif/${initial!.id}`, { method: 'DELETE' })
    if (r.ok) { router.refresh() } else { setHata('İptal başarısız'); setKaydediyor(false) }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {duzenleme && (
        <div className="flex items-center justify-between rounded-md border bg-white p-3">
          <div className="font-semibold text-[#1B4F72]">{initial!.kayitNo}</div>
          <div className="text-xs text-slate-500">Durum: {initial!.durum}{iptalli ? ' (düzenlenemez)' : ''}</div>
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
            <Input className="mt-1 h-9" value={denetlemeAdi} onChange={(e) => setDenetlemeAdi(e.target.value)} disabled={ro} />
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
            <Label className={kartLabel}>Yayınlayan Bölüm</Label>
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
            <Input className="mt-1 h-9" value={onaylayanAd || (sorumluOnaylayanUserId ? 'Seçili' : '')} readOnly placeholder="bölüm seçince dolar" />
          </div>
        </div>
      </div>

      {/* 1b. Sorumlular / onaylayanlar */}
      <div className="rounded-md border bg-white p-4 space-y-3">
        <h3 className={bolumBaslik}>Sorumlular</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className={kartLabel}>Yayınlayan Onaylayan (müdür — otomatik)</Label>
            <Input className="mt-1 h-9" value={yayinlayanOnaylayanAd || (yayinlayanOnaylayanUserId ? 'Seçili' : '')} readOnly placeholder="yayınlayan bölüm seçince dolar" />
          </div>
          <UserSecici label="İzleme Sorumlusu" value={izlemeSorumlusuUserId} onChange={setIzlemeSorumlusuUserId} disabled={ro} />
          <UserSecici label="Uygulama Sorumlusu" value={uygulamaSorumlusuUserId} onChange={setUygulamaSorumlusuUserId} disabled={ro} />
          <UserSecici label="Takip Sorumlusu" value={takipSorumlusuUserId} onChange={setTakipSorumlusuUserId} disabled={ro} />
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
          <div>
            <Label className={kartLabel}>Ek Termin Nedeni</Label>
            <Input className="mt-1 h-9" value={ekTerminNedeni} onChange={(e) => setEkTerminNedeni(e.target.value)} disabled={ro} />
          </div>
        </div>
      </div>

      {/* 3. Faaliyetler */}
      <div className="rounded-md border bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className={bolumBaslik}>Faaliyetler</h3>
          {!ro && <Button type="button" variant="outline" size="sm" onClick={addFaaliyet}>+ Satır</Button>}
        </div>
        {faaliyetler.length === 0 ? (
          <p className="text-xs text-slate-400">Henüz faaliyet yok.</p>
        ) : faaliyetler.map((f, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end border-t pt-2">
            <div className="col-span-1"><Label className={kartLabel}>#</Label><Input className="mt-1 h-9" value={f.sira} readOnly /></div>
            <div className="col-span-7"><Label className={kartLabel}>Açıklama</Label><Input className="mt-1 h-9" value={f.aciklama} onChange={(e) => updFaaliyet(i, { aciklama: e.target.value })} disabled={ro} /></div>
            <div className="col-span-3"><Label className={kartLabel}>Hedef Tarih</Label><Input type="date" className="mt-1 h-9" value={f.hedefTarih} onChange={(e) => updFaaliyet(i, { hedefTarih: e.target.value })} disabled={ro} /></div>
            <div className="col-span-1">{!ro && <Button type="button" variant="ghost" size="sm" onClick={() => delFaaliyet(i)}>✕</Button>}</div>
          </div>
        ))}
      </div>

      {/* 4. Kök neden (Ek-1 basit; tam Ek-1/Ek-2 Faz 3) */}
      <div className="rounded-md border bg-white p-4 space-y-2">
        <h3 className={bolumBaslik}>Kök Neden Analizi</h3>
        <Textarea rows={2} value={kokNedenAnalizi} onChange={(e) => setKokNedenAnalizi(e.target.value)} disabled={ro} placeholder="Özet kök neden (Ek-1 balık kılçığı / 5 Neden Faz 3'te)" />
        <p className="text-[11px] text-slate-400">Ek-1 (balık kılçığı 9 kategori + 5 Neden) ve Ek-2 (öncesi/sonrası foto) Faz 3'te tamamlanacak.</p>
      </div>

      {hata && <p className="text-sm text-red-600">{hata}</p>}

      <div className="flex gap-3">
        {!iptalli && <Button onClick={kaydet} disabled={kaydediyor} className="bg-[#1B4F72] hover:bg-[#1B4F72]/90">{kaydediyor ? 'Kaydediliyor…' : duzenleme ? 'Güncelle' : 'Taslak Oluştur'}</Button>}
        {duzenleme && !iptalli && <Button variant="outline" onClick={iptalEt} disabled={kaydediyor} className="text-red-600 border-red-300">İptal Et</Button>}
      </div>
    </div>
  )
}


/** Basit kullanıcı seçici: arama → seç. Seçili userId'yi parent tutar. */
function UserSecici({ label, value, onChange, disabled }: { label: string; value: string; onChange: (id: string) => void; disabled?: boolean }) {
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
          <span className="text-sm">{secili || 'Seçili'}</span>
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

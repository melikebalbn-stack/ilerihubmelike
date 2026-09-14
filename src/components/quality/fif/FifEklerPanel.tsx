'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const KOK_KATEGORILER: { key: string; label: string }[] = [
  { key: 'INSAN', label: 'İnsan' }, { key: 'MAKINE', label: 'Makine' }, { key: 'MALZEME', label: 'Malzeme' },
  { key: 'CEVRE', label: 'Çevre' }, { key: 'METOD', label: 'Metod' }, { key: 'OLCUM', label: 'Ölçüm' },
  { key: 'YONETIM', label: 'Yönetim' }, { key: 'EMNIYET', label: 'Emniyet' }, { key: 'GUVENLIK', label: 'Güvenlik' },
]

type Faaliyet = { id: string; sira: number; aciklama: string; hedefTarih: string | null; sonuc: string | null }
type Etkinlik = { madde: string; planlananTarih: string | null; gerceklesenTarih: string | null; uygun: boolean | null }
type KokNeden = { kategori: string; aciklama: string }
type BesNeden = { muhtemelSebep: string; neden1: string | null; neden2: string | null; neden3: string | null; neden4: string | null; neden5: string | null }
type Ek = { id: string; tip: string; dosyaYolu: string }

const iso = (d: string | null) => (d ? d.slice(0, 10) : '')

export function FifEklerPanel({
  fifId, durum, duzenlenebilir, faaliyetler, etkinlikler, kokNedenler, besNedenler, ekler,
}: {
  fifId: string; durum: string; duzenlenebilir: boolean
  faaliyetler: Faaliyet[]; etkinlikler: Etkinlik[]; kokNedenler: KokNeden[]; besNedenler: BesNeden[]; ekler: Ek[]
}) {
  const router = useRouter()
  const [sekme, setSekme] = useState<'faaliyet' | 'etkinlik' | 'ek1' | 'ek2'>('etkinlik')
  const [hata, setHata] = useState<string | null>(null)
  const [mesgul, setMesgul] = useState(false)

  const ro = !duzenlenebilir
  const etkRo = ro || durum !== 'ETKINLIK'  // etkinlik yalnız ETKINLIK aşamasında

  // ── ETKINLIK ──
  const etkMap = (m: string) => etkinlikler.find((e) => e.madde === m)
  const [etk, setEtk] = useState<Record<string, Etkinlik>>({
    KAPATMA: etkMap('KAPATMA') ?? { madde: 'KAPATMA', planlananTarih: null, gerceklesenTarih: null, uygun: null },
    TEKRAR_ETMEME: etkMap('TEKRAR_ETMEME') ?? { madde: 'TEKRAR_ETMEME', planlananTarih: null, gerceklesenTarih: null, uygun: null },
  })
  async function etkKaydet(madde: string) {
    setMesgul(true); setHata(null)
    const e = etk[madde]
    const r = await fetch(`/api/kalite/fif/${fifId}/etkinlik`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ madde, planlananTarih: e.planlananTarih || null, gerceklesenTarih: e.gerceklesenTarih || null, uygun: e.uygun }),
    })
    const d = await r.json().catch(() => ({}))
    setMesgul(false)
    if (!r.ok) { setHata(d.error ?? 'Kayıt başarısız'); return }
    router.refresh()
  }

  // ── ES (faaliyet sonuçları) ──
  const [esRow, setEsRow] = useState<Record<string, { sonuc: string; hedefTarih: string; neden: string }>>(
    Object.fromEntries(faaliyetler.map((f) => [f.id, { sonuc: f.sonuc ?? '', hedefTarih: iso(f.hedefTarih), neden: '' }])),
  )
  async function faaliyetKaydet(f: Faaliyet) {
    const row = esRow[f.id]
    setMesgul(true); setHata(null)
    const body: Record<string, unknown> = { sira: f.sira, aciklama: f.aciklama, hedefTarih: row.hedefTarih || null, sonuc: row.sonuc || null }
    if (row.sonuc === 'ES') body.ekTerminNedeni = row.neden
    const r = await fetch(`/api/kalite/fif/${fifId}/faaliyet?faaliyetId=${f.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const d = await r.json().catch(() => ({}))
    setMesgul(false)
    if (!r.ok) { setHata(d.error ?? 'Kayıt başarısız'); return }
    router.refresh()
  }

  // ── EK-1 ──
  const [kok, setKok] = useState<Record<string, string>>(
    Object.fromEntries(KOK_KATEGORILER.map((k) => [k.key, kokNedenler.find((x) => x.kategori === k.key)?.aciklama ?? ''])),
  )
  const [bes, setBes] = useState<BesNeden[]>(besNedenler.length ? besNedenler : [])
  async function ek1Kaydet() {
    setMesgul(true); setHata(null)
    const r = await fetch(`/api/kalite/fif/${fifId}/ek1`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kokNedenler: KOK_KATEGORILER.map((k) => ({ kategori: k.key, aciklama: kok[k.key] ?? '' })),
        besNedenler: bes.filter((b) => b.muhtemelSebep?.trim()),
      }),
    })
    const d = await r.json().catch(() => ({}))
    setMesgul(false)
    if (!r.ok) { setHata(d.error ?? 'Kayıt başarısız'); return }
    router.refresh()
  }

  // ── EK-2 foto ──
  async function fotoYukle(tip: string, file: File) {
    setMesgul(true); setHata(null)
    const fd = new FormData(); fd.append('tip', tip); fd.append('file', file)
    const r = await fetch(`/api/kalite/fif/${fifId}/foto`, { method: 'POST', body: fd })
    const d = await r.json().catch(() => ({}))
    setMesgul(false)
    if (!r.ok) { setHata(d.error ?? 'Yükleme başarısız'); return }
    router.refresh()
  }
  async function fotoSil(fotoId: string) {
    if (!confirm('Fotoğraf silinsin mi?')) return
    setMesgul(true)
    await fetch(`/api/kalite/fif/${fifId}/foto/${fotoId}`, { method: 'DELETE' })
    setMesgul(false); router.refresh()
  }

  const sekmeBtn = (k: typeof sekme, l: string) => (
    <button onClick={() => setSekme(k)} className={`px-3 py-1.5 text-sm rounded-t ${sekme === k ? 'bg-white font-semibold text-[#1B4F72] border border-b-white' : 'text-slate-500'}`}>{l}</button>
  )

  return (
    <div className="rounded-md border bg-white">
      <div className="flex gap-1 border-b px-2 pt-2 bg-slate-50">
        {sekmeBtn('etkinlik', 'Etkinlik')}
        {sekmeBtn('faaliyet', 'Faaliyet Sonuçları (ES)')}
        {sekmeBtn('ek1', 'Ek-1 Kök Neden')}
        {sekmeBtn('ek2', 'Ek-2 Fotoğraf')}
      </div>
      <div className="p-4 space-y-3">
        {hata && <p className="text-sm text-red-600">{hata}</p>}

        {sekme === 'etkinlik' && (
          <div className="space-y-4">
            {durum !== 'ETKINLIK' && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                Henüz etkinlik aşamasında değil (durum: {durum}). Alanlar salt-okunur; FİF "Etkinlik" aşamasına geldiğinde doldurulacak.
              </p>
            )}
            <p className="text-xs text-slate-500">İki madde de "Uygun" olunca FİF "Kapat (Etkin)" ile kapatılabilir. Onay = kaydeden + tarih otomatik.</p>
            {(['KAPATMA', 'TEKRAR_ETMEME'] as const).map((m) => (
              <div key={m} className="border rounded p-3 space-y-2">
                <div className="font-medium text-sm">{m === 'KAPATMA' ? 'Kapatma etkinliği' : 'Tekrar etmeme etkinliği'}</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div><Label className="text-xs">Planlanan</Label><Input type="date" className="mt-1 h-9" value={iso(etk[m].planlananTarih)} disabled={etkRo} onChange={(e) => setEtk((p) => ({ ...p, [m]: { ...p[m], planlananTarih: e.target.value } }))} /></div>
                  <div><Label className="text-xs">Gerçekleşen</Label><Input type="date" className="mt-1 h-9" value={iso(etk[m].gerceklesenTarih)} disabled={etkRo} onChange={(e) => setEtk((p) => ({ ...p, [m]: { ...p[m], gerceklesenTarih: e.target.value } }))} /></div>
                  <div>
                    <Label className="text-xs">Değerlendirme</Label>
                    <Select value={etk[m].uygun === null ? 'none' : etk[m].uygun ? 'evet' : 'hayir'} disabled={etkRo}
                      onValueChange={(v) => setEtk((p) => ({ ...p, [m]: { ...p[m], uygun: v === 'none' ? null : v === 'evet' } }))}>
                      <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        <SelectItem value="evet">Uygun</SelectItem>
                        <SelectItem value="hayir">Uygun Değil</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {!etkRo && <Button size="sm" className="bg-[#1B4F72]" disabled={mesgul} onClick={() => etkKaydet(m)}>Kaydet</Button>}
              </div>
            ))}
          </div>
        )}

        {sekme === 'faaliyet' && (
          <div className="space-y-3">
            {faaliyetler.length === 0 ? <p className="text-xs text-slate-400">Faaliyet yok.</p> : faaliyetler.map((f) => (
              <div key={f.id} className="border rounded p-3 space-y-2">
                <div className="text-sm">#{f.sira} — {f.aciklama}</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Sonuç</Label>
                    <Select value={esRow[f.id]?.sonuc || 'none'} disabled={ro}
                      onValueChange={(v) => setEsRow((p) => ({ ...p, [f.id]: { ...p[f.id], sonuc: v === 'none' ? '' : v } }))}>
                      <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        <SelectItem value="YT">Yapılamadı (YT)</SelectItem>
                        <SelectItem value="ES">Ek Süre (ES)</SelectItem>
                        <SelectItem value="K">Kapandı (K)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {esRow[f.id]?.sonuc === 'ES' && (
                    <>
                      <div><Label className="text-xs">Yeni Hedef Tarih *</Label><Input type="date" className="mt-1 h-9" value={esRow[f.id]?.hedefTarih ?? ''} disabled={ro} onChange={(e) => setEsRow((p) => ({ ...p, [f.id]: { ...p[f.id], hedefTarih: e.target.value } }))} /></div>
                      <div><Label className="text-xs">Ek Termin Nedeni *</Label><Input className="mt-1 h-9" value={esRow[f.id]?.neden ?? ''} disabled={ro} onChange={(e) => setEsRow((p) => ({ ...p, [f.id]: { ...p[f.id], neden: e.target.value } }))} /></div>
                    </>
                  )}
                </div>
                {!ro && <Button size="sm" className="bg-[#1B4F72]" disabled={mesgul} onClick={() => faaliyetKaydet(f)}>Kaydet</Button>}
              </div>
            ))}
          </div>
        )}

        {sekme === 'ek1' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {KOK_KATEGORILER.map((k) => (
                <div key={k.key}>
                  <Label className="text-xs font-medium">{k.label}</Label>
                  <Textarea rows={2} className="mt-1" value={kok[k.key] ?? ''} disabled={ro} onChange={(e) => setKok((p) => ({ ...p, [k.key]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-[#1B4F72]">5 Neden</h4>
                {!ro && <Button size="sm" variant="outline" onClick={() => setBes((p) => [...p, { muhtemelSebep: '', neden1: '', neden2: '', neden3: '', neden4: '', neden5: '' }])}>+ Satır</Button>}
              </div>
              {bes.map((b, i) => (
                <div key={i} className="border rounded p-2 space-y-1">
                  <Input placeholder="Muhtemel sebep" value={b.muhtemelSebep} disabled={ro} onChange={(e) => setBes((p) => p.map((x, ix) => ix === i ? { ...x, muhtemelSebep: e.target.value } : x))} />
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Input key={n} placeholder={`Neden ${n}`} value={(b as Record<string, string | null>)[`neden${n}`] ?? ''} disabled={ro}
                      onChange={(e) => setBes((p) => p.map((x, ix) => ix === i ? { ...x, [`neden${n}`]: e.target.value } : x))} />
                  ))}
                  {!ro && <button className="text-xs text-red-500" onClick={() => setBes((p) => p.filter((_, ix) => ix !== i))}>satırı sil</button>}
                </div>
              ))}
            </div>
            {!ro && <Button size="sm" className="bg-[#1B4F72]" disabled={mesgul} onClick={ek1Kaydet}>Ek-1 Kaydet</Button>}
          </div>
        )}

        {sekme === 'ek2' && (
          <div className="space-y-4">
            {(['ONCE', 'SONRA'] as const).map((tip) => (
              <div key={tip} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">{tip === 'ONCE' ? 'Öncesi' : 'Sonrası'}</h4>
                  {!ro && <input type="file" accept="image/jpeg,image/png,image/webp" disabled={mesgul}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) fotoYukle(tip, f) }} className="text-xs" />}
                </div>
                <div className="flex flex-wrap gap-2">
                  {ekler.filter((e) => e.tip === tip).map((e) => (
                    <div key={e.id} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={e.dosyaYolu} alt={tip} className="h-24 w-24 object-cover rounded border" />
                      {!ro && <button onClick={() => fotoSil(e.id)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs">×</button>}
                    </div>
                  ))}
                  {ekler.filter((e) => e.tip === tip).length === 0 && <span className="text-xs text-slate-400">Fotoğraf yok</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

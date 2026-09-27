'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type Mola = { id: string; vardiyaId: string; tur: 'YEMEK' | 'CAY'; baslangic: string; bitis: string; dusulur: boolean; departmentId: string | null; aktif: boolean; department: { name: string } | null }
type Vardiya = {
  id: string; kod: string; ad: string; girisSaat: string; cikisSaat: string; gunDonumSaat: string; yakaTipi: 'BEYAZ' | 'MAVI' | 'HEPSI'
  gecToleransDk: number; erkenToleransDk: number; varsayilan: boolean; sira: number; aktif: boolean; molalar: Mola[]; _count: { atamalar: number }
}
type Atama = { id: string; vardiya: string; sicil: string | null; adSoyad: string; departman: string | null; baslangic: string; bitis: string | null }
type Veri = { vardiyalar: Vardiya[]; atamalar: Atama[]; departmanlar: { id: string; name: string }[] }
type Aday = { id: string; sicil: string | null; adSoyad: string; departman: string | null }

const YAKA: Record<Vardiya['yakaTipi'], string> = { BEYAZ: 'Beyaz yaka', MAVI: 'Mavi + gri yaka', HEPSI: 'Herkes' }
const bugun = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10)

async function istek(url: string, method: string, govde?: unknown) {
  const r = await fetch(url, { method, headers: govde ? { 'Content-Type': 'application/json' } : undefined, body: govde ? JSON.stringify(govde) : undefined })
  const d = await r.json().catch(() => ({}))
  return { ok: r.ok && d.ok !== false, veri: d as Record<string, unknown> }
}

export function VardiyalarClient() {
  const [veri, setVeri] = useState<Veri | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [vDuzen, setVDuzen] = useState<Partial<Vardiya> | null>(null)
  const [mDuzen, setMDuzen] = useState<Partial<Mola> | null>(null)
  const [formHata, setFormHata] = useState<string | null>(null)

  const yukle = useCallback(async () => {
    const { ok, veri: d } = await istek('/api/pdks/vardiyalar', 'GET')
    if (!ok) return setHata(String(d.error ?? 'Vardiyalar alınamadı'))
    setHata(null)
    setVeri(d as unknown as Veri)
  }, [])
  useEffect(() => void yukle(), [yukle])

  const kaydet = async (url: string, method: string, govde: unknown, kapat: () => void) => {
    setFormHata(null)
    const { ok, veri: d } = await istek(url, method, govde)
    if (!ok) return setFormHata(String(d.error ?? 'Kaydedilemedi'))
    kapat()
    void yukle()
  }

  if (!veri) return hata ? <p className="text-sm text-amber-800">{hata}</p> : <Loader2 className="h-5 w-5 animate-spin text-slate-400" />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Atamasız kişiye yakasına uyan <strong>varsayılan</strong> vardiya uygulanır (gri yaka = mavi).</p>
        <Button size="sm" onClick={() => setVDuzen({ girisSaat: '07:00', cikisSaat: '17:00', gunDonumSaat: '04:00', yakaTipi: 'HEPSI', gecToleransDk: 0, erkenToleransDk: 0, aktif: true, varsayilan: false, sira: 0 })}>
          <Plus className="mr-1 h-4 w-4" /> Vardiya ekle
        </Button>
      </div>

      {veri.vardiyalar.map((v) => (
        <Card key={v.id} className={cn('shadow-none', !v.aktif && 'opacity-60')}>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                {v.kod} <span className="font-normal text-slate-600">— {v.ad}</span>
                {v.varsayilan && <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">varsayılan</span>}
                {!v.aktif && <span className="rounded-full border px-2 py-0.5 text-xs text-slate-500">pasif</span>}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setVDuzen({ ...v })}><Pencil className="h-4 w-4" /></Button>
            </div>
            <p className="text-sm text-slate-600">
              {v.girisSaat}–{v.cikisSaat} · gün dönümü {v.gunDonumSaat} · {YAKA[v.yakaTipi]} · geç tol. {v.gecToleransDk} dk · erken tol. {v.erkenToleransDk} dk · {v._count.atamalar} atama
            </p>
          </CardHeader>
          <CardContent>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Molalar</span>
              <Button variant="ghost" size="sm" onClick={() => setMDuzen({ vardiyaId: v.id, tur: 'CAY', baslangic: '10:00', bitis: '10:15', dusulur: false, departmentId: null, aktif: true })}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Mola
              </Button>
            </div>
            <ul className="divide-y rounded-md border text-sm">
              {v.molalar.map((m) => (
                <li key={m.id} className={cn('flex items-center justify-between px-3 py-1.5', !m.aktif && 'opacity-50')}>
                  <span>
                    <span className="font-medium">{m.tur === 'YEMEK' ? 'Yemek' : 'Çay'}</span> {m.baslangic}–{m.bitis}
                    <span className={cn('ml-2 rounded-full border px-1.5 text-xs', m.dusulur ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-500')}>
                      {m.dusulur ? 'çalışmadan düşülür' : 'düşülmez'}
                    </span>
                    <span className="ml-2 text-xs text-slate-500">{m.department?.name ?? 'tüm bölümler'}</span>
                  </span>
                  <span className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setMDuzen({ ...m })}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={async () => { if (confirm('Mola silinsin mi?')) { await istek(`/api/pdks/vardiyalar/mola/${m.id}`, 'DELETE'); void yukle() } }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                </li>
              ))}
              {v.molalar.length === 0 && <li className="px-3 py-2 text-slate-400">Mola yok</li>}
            </ul>
          </CardContent>
        </Card>
      ))}

      <AtamaBolumu veri={veri} yenile={yukle} />

      {/* Vardiya dialog */}
      <Dialog open={!!vDuzen} onOpenChange={(o) => { if (!o) { setVDuzen(null); setFormHata(null) } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{vDuzen?.id ? `Vardiya — ${vDuzen.kod}` : 'Vardiya ekle'}</DialogTitle></DialogHeader>
          {vDuzen && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {!vDuzen.id && <div className="col-span-2"><Label>Kod</Label><Input value={vDuzen.kod ?? ''} onChange={(e) => setVDuzen({ ...vDuzen, kod: e.target.value.toUpperCase() })} placeholder="MAVI-GECE" /></div>}
              <div className="col-span-2"><Label>Ad</Label><Input value={vDuzen.ad ?? ''} onChange={(e) => setVDuzen({ ...vDuzen, ad: e.target.value })} /></div>
              <div><Label>Giriş</Label><Input value={vDuzen.girisSaat ?? ''} onChange={(e) => setVDuzen({ ...vDuzen, girisSaat: e.target.value })} placeholder="07:00" /></div>
              <div><Label>Çıkış</Label><Input value={vDuzen.cikisSaat ?? ''} onChange={(e) => setVDuzen({ ...vDuzen, cikisSaat: e.target.value })} placeholder="17:00" /></div>
              <div><Label>Gün dönümü</Label><Input value={vDuzen.gunDonumSaat ?? ''} onChange={(e) => setVDuzen({ ...vDuzen, gunDonumSaat: e.target.value })} placeholder="04:00" /></div>
              <div>
                <Label>Yaka</Label>
                <Select value={vDuzen.yakaTipi ?? 'HEPSI'} onValueChange={(x) => setVDuzen({ ...vDuzen, yakaTipi: x as Vardiya['yakaTipi'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(YAKA).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Geç giriş toleransı (dk)</Label><Input type="number" min={0} value={vDuzen.gecToleransDk ?? 0} onChange={(e) => setVDuzen({ ...vDuzen, gecToleransDk: Number(e.target.value) })} /></div>
              <div><Label>Erken çıkış toleransı (dk)</Label><Input type="number" min={0} value={vDuzen.erkenToleransDk ?? 0} onChange={(e) => setVDuzen({ ...vDuzen, erkenToleransDk: Number(e.target.value) })} /></div>
              <div className="col-span-2 flex items-center justify-between"><Label>Bu yaka için varsayılan</Label><Switch checked={!!vDuzen.varsayilan} onCheckedChange={(c) => setVDuzen({ ...vDuzen, varsayilan: c })} /></div>
              <div className="col-span-2 flex items-center justify-between"><Label>Aktif</Label><Switch checked={vDuzen.aktif ?? true} onCheckedChange={(c) => setVDuzen({ ...vDuzen, aktif: c })} /></div>
              <p className="col-span-2 text-xs text-slate-500">Gün dönümü, vardiya saatlerinin DIŞINDA olmalı: bu saatten önceki okutmalar önceki vardiya gününe yazılır (gece 21–07 için 12:00).</p>
              {formHata && <p className="col-span-2 text-amber-800">{formHata}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setVDuzen(null)}>İptal</Button>
            <Button onClick={() => vDuzen && kaydet(vDuzen.id ? `/api/pdks/vardiyalar/${vDuzen.id}` : '/api/pdks/vardiyalar', vDuzen.id ? 'PATCH' : 'POST', vDuzen, () => setVDuzen(null))}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mola dialog */}
      <Dialog open={!!mDuzen} onOpenChange={(o) => { if (!o) { setMDuzen(null); setFormHata(null) } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{mDuzen?.id ? 'Mola düzenle' : 'Mola ekle'}</DialogTitle></DialogHeader>
          {mDuzen && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <Label>Tür</Label>
                <Select value={mDuzen.tur ?? 'CAY'} onValueChange={(x) => setMDuzen({ ...mDuzen, tur: x as Mola['tur'], dusulur: x === 'YEMEK' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="YEMEK">Yemek</SelectItem><SelectItem value="CAY">Çay</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bölüm</Label>
                <Select value={mDuzen.departmentId ?? 'HEPSI'} onValueChange={(x) => setMDuzen({ ...mDuzen, departmentId: x === 'HEPSI' ? null : x })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HEPSI">Tüm bölümler</SelectItem>
                    {veri.departmanlar.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Başlangıç</Label><Input value={mDuzen.baslangic ?? ''} onChange={(e) => setMDuzen({ ...mDuzen, baslangic: e.target.value })} placeholder="12:00" /></div>
              <div><Label>Bitiş</Label><Input value={mDuzen.bitis ?? ''} onChange={(e) => setMDuzen({ ...mDuzen, bitis: e.target.value })} placeholder="13:00" /></div>
              <div className="col-span-2 flex items-center justify-between"><Label>Çalışma süresinden düşülür</Label><Switch checked={!!mDuzen.dusulur} onCheckedChange={(c) => setMDuzen({ ...mDuzen, dusulur: c })} /></div>
              <div className="col-span-2 flex items-center justify-between"><Label>Aktif</Label><Switch checked={mDuzen.aktif ?? true} onCheckedChange={(c) => setMDuzen({ ...mDuzen, aktif: c })} /></div>
              <p className="col-span-2 text-xs text-slate-500">Bölüme özel satır, aynı türdeki “tüm bölümler” satırını o bölüm için ezer (mavi yaka yemek saati).</p>
              {formHata && <p className="col-span-2 text-amber-800">{formHata}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMDuzen(null)}>İptal</Button>
            <Button onClick={() => mDuzen && kaydet(mDuzen.id ? `/api/pdks/vardiyalar/mola/${mDuzen.id}` : '/api/pdks/vardiyalar/mola', mDuzen.id ? 'PATCH' : 'POST', mDuzen, () => setMDuzen(null))}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AtamaBolumu({ veri, yenile }: { veri: Veri; yenile: () => void }) {
  const [mod, setMod] = useState<'KISI' | 'DEPARTMAN'>('KISI')
  const [vardiyaId, setVardiyaId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [arama, setArama] = useState('')
  const [adaylar, setAdaylar] = useState<Aday[]>([])
  const [kisi, setKisi] = useState<Aday | null>(null)
  const [bas, setBas] = useState(bugun())
  const [bit, setBit] = useState('')
  const [mesaj, setMesaj] = useState<string | null>(null)

  useEffect(() => {
    if (mod !== 'KISI') return
    const t = setTimeout(async () => {
      const r = await fetch(`/api/pdks/kartlar/personel-aday?q=${encodeURIComponent(arama.trim())}`)
      const d = await r.json().catch(() => ({}))
      if (r.ok) setAdaylar(d.personeller ?? [])
    }, 250)
    return () => clearTimeout(t)
  }, [arama, mod])

  const ata = async () => {
    setMesaj(null)
    const govde = { vardiyaId, baslangic: bas, bitis: bit || null, ...(mod === 'KISI' ? { personnelId: kisi?.id } : { departmentId }) }
    const { ok, veri: d } = await istek('/api/pdks/vardiyalar/atama', 'POST', govde)
    if (!ok) return setMesaj(`Hata: ${String(d.error ?? 'atanamadı')}`)
    const atlanan = (d.atlanan as string[]) ?? []
    setMesaj(`${d.atanan} kişi atandı, ${d.kapatilan} önceki atama kapatıldı${atlanan.length ? `; ${atlanan.length} kişi atlandı (aynı/sonraki tarihte ataması var: ${atlanan.join(', ')})` : ''}`)
    setKisi(null)
    yenile()
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2"><CardTitle className="text-base">Personel ataması</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="inline-flex rounded-lg border p-0.5">
            {(['KISI', 'DEPARTMAN'] as const).map((m) => (
              <button key={m} onClick={() => setMod(m)} className={cn('rounded-md px-3 py-1.5', mod === m ? 'bg-[#1B4F72] text-white' : 'text-slate-600')}>
                {m === 'KISI' ? 'Tek kişi' : 'Departman (toplu)'}
              </button>
            ))}
          </div>
          <div className="w-56">
            <Label>Vardiya</Label>
            <Select value={vardiyaId} onValueChange={setVardiyaId}>
              <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
              <SelectContent>{veri.vardiyalar.filter((v) => v.aktif).map((v) => <SelectItem key={v.id} value={v.id}>{v.kod}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Başlangıç</Label><Input type="date" value={bas} onChange={(e) => setBas(e.target.value)} className="w-40" /></div>
          <div><Label>Bitiş (boş = süresiz)</Label><Input type="date" value={bit} onChange={(e) => setBit(e.target.value)} className="w-40" /></div>
        </div>
        {mod === 'KISI' ? (
          <div>
            <Input value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Sicil veya ad ile ara" className="max-w-sm" />
            <div className="mt-2 max-h-44 max-w-xl overflow-y-auto rounded-md border">
              {adaylar.map((a) => (
                <button key={a.id} onClick={() => setKisi(a)} className={cn('flex w-full justify-between border-b px-3 py-1.5 text-left last:border-b-0', kisi?.id === a.id ? 'bg-blue-50' : 'hover:bg-slate-50')}>
                  <span>{a.adSoyad} <span className="text-xs text-slate-500">{a.sicil}</span></span>
                  <span className="text-xs text-slate-500">{a.departman ?? '—'}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="w-72">
            <Label>Departman</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
              <SelectContent>{veri.departmanlar.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
            <p className="mt-1 text-xs text-slate-500">Departmandaki tüm AKTİF personele atanır.</p>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Button onClick={ata} disabled={!vardiyaId || !bas || (mod === 'KISI' ? !kisi : !departmentId)}>Ata</Button>
          {mesaj && <span className={cn(mesaj.startsWith('Hata') ? 'text-amber-800' : 'text-slate-600')}>{mesaj}</span>}
        </div>
        <p className="text-xs text-slate-500">Önceki açık atama yeni başlangıçtan bir gün önce kapanır. Aynı ya da sonraki tarihte başlayan ataması olan kişi atlanır.</p>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-3 py-2">Sicil</th><th className="px-3 py-2">Ad Soyad</th><th className="px-3 py-2">Departman</th><th className="px-3 py-2">Vardiya</th><th className="px-3 py-2">Başlangıç</th><th className="px-3 py-2">Bitiş</th><th /></tr>
            </thead>
            <tbody>
              {veri.atamalar.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-3 py-1.5">{a.sicil ?? '—'}</td><td className="px-3 py-1.5">{a.adSoyad}</td><td className="px-3 py-1.5 text-slate-600">{a.departman ?? '—'}</td>
                  <td className="px-3 py-1.5">{a.vardiya}</td><td className="px-3 py-1.5">{a.baslangic}</td><td className="px-3 py-1.5">{a.bitis ?? 'süresiz'}</td>
                  <td className="px-3 py-1.5 text-right">
                    <Button variant="ghost" size="sm" onClick={async () => { if (confirm('Atama silinsin mi?')) { await istek(`/api/pdks/vardiyalar/atama/${a.id}`, 'DELETE'); yenile() } }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {veri.atamalar.length === 0 && <tr><td colSpan={7} className="px-3 py-4 text-center text-slate-400">Güncel atama yok — herkes yakasına göre varsayılan vardiyada</td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

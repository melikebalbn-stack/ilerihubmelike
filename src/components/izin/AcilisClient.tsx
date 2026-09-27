'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Sinif = 'ESLESEN' | 'ZATEN_VAR' | 'HUBDA_PASIF' | 'HUBDA_YOK' | 'MUKERRER_SICIL' | 'GECERSIZ_DEGER'
type Deneme = {
  sha256: string
  tarih: string
  gecisTarihi: string | null
  baslikSatiri: number
  sutunlar: { sicil: string; kalan: string }
  satir: number
  ozet: Record<Sinif, number>
  toplamGun: number
  eslesmeyen: { pay: number; payda: number; oran: number }
  esik: number
  kapi: string | null
  rapor: string
  sorunlu: { satir: number; sicil: string; deger: string; sinif: Sinif; adSoyad: string | null; aciklama: string }[]
  eslesen: { satir: number; sicil: string; gun: number; adSoyad: string; departman: string | null }[]
  hubAktifDosyadaYok: { sicil: string | null; adSoyad: string; departman: string | null }[]
}

const SINIF: Record<Sinif, { ad: string; ton: 'mavi' | 'turuncu' | 'gri' }> = {
  ESLESEN: { ad: 'Yazılacak', ton: 'mavi' },
  ZATEN_VAR: { ad: 'Zaten yüklü', ton: 'gri' },
  HUBDA_PASIF: { ad: "Hub'da pasif", ton: 'turuncu' },
  HUBDA_YOK: { ad: "Hub'da yok", ton: 'turuncu' },
  MUKERRER_SICIL: { ad: 'Mükerrer sicil', ton: 'turuncu' },
  GECERSIZ_DEGER: { ad: 'Geçersiz değer', ton: 'turuncu' },
}
const gunFmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 1 })
const tarihFmt = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`

export function AcilisClient({ canApply }: { canApply: boolean }) {
  const [dosya, setDosya] = useState<File | null>(null)
  const [tarih, setTarih] = useState('')
  const [d, setD] = useState<Deneme | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [calisiyor, setCalisiyor] = useState(false)
  const [onayMetni, setOnayMetni] = useState('')
  const [sonuc, setSonuc] = useState<{ yazilan: number; toplamGun: number; rapor: string } | null>(null)

  const gonder = async (url: string, ek: Record<string, string> = {}) => {
    if (!dosya || !tarih) return null
    const fd = new FormData()
    fd.append('dosya', dosya)
    fd.append('tarih', tarih)
    for (const [k, v] of Object.entries(ek)) fd.append(k, v)
    setCalisiyor(true)
    setHata(null)
    try {
      const r = await fetch(url, { method: 'POST', body: fd })
      const v = await r.json().catch(() => ({}))
      if (!r.ok || v.ok === false) { setHata(v.error ?? 'İşlem başarısız'); return null }
      return v
    } catch {
      setHata('Sunucuya ulaşılamadı')
      return null
    } finally {
      setCalisiyor(false)
    }
  }

  const deneme = async () => {
    setD(null); setSonuc(null); setOnayMetni('')
    const v = await gonder('/api/izin/acilis/deneme')
    if (v) setD(v as Deneme)
  }
  const aktar = async () => {
    if (!d) return
    const v = await gonder('/api/izin/acilis/aktar', { denemeSha256: d.sha256, onay: onayMetni })
    if (v) setSonuc(v as { yazilan: number; toplamGun: number; rapor: string })
  }

  const e = d?.eslesmeyen
  return (
    <div className="space-y-5">
      <Card className="shadow-none">
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_200px_auto] sm:items-end">
            <div>
              <Label htmlFor="acilis-dosya">İV açılış Excel&apos;i (.xlsx)</Label>
              <Input id="acilis-dosya" type="file" accept=".xlsx,.xls" className="mt-1 bg-white" onChange={(ev) => { setDosya(ev.target.files?.[0] ?? null); setD(null); setSonuc(null) }} />
            </div>
            <div>
              <Label htmlFor="acilis-tarih">Bakiye tarihi (geçiş günü)</Label>
              <Input id="acilis-tarih" type="date" value={tarih} onChange={(ev) => { setTarih(ev.target.value); setD(null); setSonuc(null) }} className="mt-1 bg-white" />
            </div>
            <Button onClick={deneme} disabled={!dosya || !tarih || calisiyor} className="h-10">
              {calisiyor && !d ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-1 h-4 w-4" />}
              Deneme çalıştır
            </Button>
          </div>
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-500">
            <li>Dosyadan yalnız <strong>sicil</strong> ve <strong>kalan</strong> sütunları okunur (başlıkta &quot;Sicil&quot; ve &quot;Kalan&quot; ya da &quot;Bakiye&quot; geçmeli). Ondalık yalnız 0,5.</li>
            <li>Deneme veritabanına yazmaz; rapor sunucuda korumalı dizine (uploads/izin, yalnız sahip okur) kaydedilir.</li>
            <li>Bakiye tarihine kadarki yıldönümleri Excel&apos;de sayılmış kabul edilir; otomatik hak ediş sonraki yıldönümünden başlar.</li>
          </ul>
        </CardContent>
      </Card>

      {hata && <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{hata}</div>}

      {d && (
        <>
          <div className="text-sm text-slate-600">
            Başlık {d.baslikSatiri}. satır · sicil sütunu &quot;{d.sutunlar.sicil}&quot; · kalan sütunu &quot;{d.sutunlar.kalan}&quot; · {d.satir} veri satırı · bakiye tarihi {tarihFmt(d.tarih)}
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kutu baslik="Yazılacak kişi" deger={String(d.ozet.ESLESEN)} ton="mavi" alt={`toplam ${gunFmt(d.toplamGun)} gün`} />
            <Kutu baslik="Yazılamayan satır" deger={String(e!.pay)} ton={e!.pay ? 'turuncu' : 'gri'} alt={`%${(e!.oran * 100).toFixed(1)} · eşik %${(d.esik * 100).toFixed(0)}`} />
            <Kutu baslik="Zaten yüklü" deger={String(d.ozet.ZATEN_VAR)} ton="gri" />
            <Kutu baslik="Hub'da aktif, dosyada yok" deger={String(d.hubAktifDosyadaYok.length)} ton={d.hubAktifDosyadaYok.length ? 'turuncu' : 'gri'} alt="açılışları 0 kalır" />
          </div>

          {d.sorunlu.length > 0 && (
            <Tablo baslik={`Yazılmayacak satırlar (${d.sorunlu.length})`}>
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr><th className="px-3 py-1.5 font-medium">Satır</th><th className="px-3 py-1.5 font-medium">Sicil</th><th className="px-3 py-1.5 font-medium">Dosyadaki kalan</th><th className="px-3 py-1.5 font-medium">Durum</th><th className="px-3 py-1.5 font-medium">Hub&apos;daki ad</th><th className="px-3 py-1.5 font-medium">Açıklama</th></tr>
              </thead>
              <tbody>
                {d.sorunlu.map((s) => (
                  <tr key={s.satir} className="border-t">
                    <td className="px-3 py-1.5 font-mono text-xs">{s.satir}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{s.sicil}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{s.deger || '—'}</td>
                    <td className="px-3 py-1.5"><Rozet ton={SINIF[s.sinif].ton}>{SINIF[s.sinif].ad}</Rozet></td>
                    <td className="px-3 py-1.5">{s.adSoyad ?? '—'}</td>
                    <td className="px-3 py-1.5 text-xs text-slate-600">{s.aciklama}</td>
                  </tr>
                ))}
              </tbody>
            </Tablo>
          )}

          {d.hubAktifDosyadaYok.length > 0 && (
            <Tablo baslik={`Hub'da aktif ama dosyada yok (${d.hubAktifDosyadaYok.length})`}>
              <tbody>
                {d.hubAktifDosyadaYok.map((p, i) => (
                  <tr key={`${p.sicil}-${i}`} className="border-t">
                    <td className="px-3 py-1.5 font-mono text-xs">{p.sicil ?? '—'}</td>
                    <td className="px-3 py-1.5">{p.adSoyad}</td>
                    <td className="px-3 py-1.5 text-slate-600">{p.departman ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </Tablo>
          )}

          <Tablo baslik={`Yazılacak açılışlar (${d.eslesen.length})`}>
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr><th className="px-3 py-1.5 font-medium">Sicil</th><th className="px-3 py-1.5 font-medium">Ad Soyad</th><th className="px-3 py-1.5 font-medium">Departman</th><th className="px-3 py-1.5 text-right font-medium">Açılış</th></tr>
            </thead>
            <tbody>
              {d.eslesen.map((s) => (
                <tr key={s.satir} className="border-t">
                  <td className="px-3 py-1.5 font-mono text-xs">{s.sicil}</td>
                  <td className="px-3 py-1.5">{s.adSoyad}</td>
                  <td className="px-3 py-1.5 text-slate-600">{s.departman ?? '—'}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{gunFmt(s.gun)}</td>
                </tr>
              ))}
            </tbody>
          </Tablo>

          <p className="text-xs text-slate-500">Rapor: {d.rapor}</p>

          {/* Gerçek aktarım — ayrı ve kilitli adım */}
          <Card className={cn('shadow-none', d.kapi ? 'border-amber-300' : 'border-blue-200')}>
            <CardContent className="space-y-3 p-5 text-sm">
              {sonuc ? (
                <div className="flex items-start gap-2 text-blue-900">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                  <span><strong>{sonuc.yazilan}</strong> kişiye toplam <strong>{gunFmt(sonuc.toplamGun)}</strong> gün açılış bakiyesi yazıldı. Geçiş tarihi {tarihFmt(d.tarih)}. Rapor: {sonuc.rapor}</span>
                </div>
              ) : d.kapi ? (
                <div className="flex items-start gap-2 text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Gerçek aktarım yapılamaz: {d.kapi}.</span>
                </div>
              ) : !canApply ? (
                <p className="text-slate-600">Gerçek aktarım <strong>izin.bakiye.admin</strong> yetkisiyle, canlıya geçiş günü yapılır. Bu deneme raporu onay için yeterli.</p>
              ) : (
                <>
                  <p className="text-slate-700">
                    Gerçek aktarım <strong>{d.ozet.ESLESEN}</strong> kişiye açılış yazar ve geçiş tarihini <strong>{tarihFmt(d.tarih)}</strong> olarak sabitler. Geri alınamaz (defter yalnız eklenir; düzeltme yeni satırla yapılır).
                    Onaylamak için kutuya <span className="font-mono font-semibold">AKTAR</span> yazın.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input value={onayMetni} onChange={(ev) => setOnayMetni(ev.target.value)} className="w-40 font-mono" aria-label="Onay metni" />
                    <Button onClick={aktar} disabled={onayMetni !== 'AKTAR' || calisiyor}>
                      {calisiyor && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Gerçek aktarımı yap
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function Rozet({ ton, children }: { ton: 'mavi' | 'turuncu' | 'gri'; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
      ton === 'mavi' && 'border-blue-200 bg-blue-50 text-blue-800',
      ton === 'turuncu' && 'border-amber-200 bg-amber-50 text-amber-800',
      ton === 'gri' && 'border-slate-200 bg-slate-100 text-slate-600')}>
      {children}
    </span>
  )
}

function Kutu({ baslik, deger, ton, alt }: { baslik: string; deger: string; ton: 'mavi' | 'turuncu' | 'gri'; alt?: string }) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <div className={cn('text-xs font-medium', ton === 'mavi' && 'text-blue-700', ton === 'turuncu' && 'text-amber-700', ton === 'gri' && 'text-slate-500')}>{baslik}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{deger}</div>
        {alt && <div className="mt-0.5 text-xs text-slate-500">{alt}</div>}
      </CardContent>
    </Card>
  )
}

function Tablo({ baslik, children }: { baslik: string; children: React.ReactNode }) {
  return (
    <details className="rounded-lg border bg-white" open={baslik.startsWith('Yazılmayacak')}>
      <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">{baslik}</summary>
      <div className="max-h-[50vh] overflow-auto border-t">
        <table className="w-full text-sm">{children}</table>
      </div>
    </details>
  )
}

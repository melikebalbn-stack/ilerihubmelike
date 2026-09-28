'use client'

import { useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { DateField } from '@/components/ui/date-field'
import { FileBarChart2, FileSpreadsheet, Loader2, PencilRuler, Play, Printer } from 'lucide-react'
import { GeriRozet, RozetLink } from '../../_components/rozet-link'
import { apiGonder, apiYanit, hataListesi, hataYapisi } from '../../_components/api'
import HataKutusu from '../../_components/hata-kutusu'
import type { CevrilmisHata } from '@/lib/rapor/hata-cevir'
import type { SablonParametre } from '@/lib/rapor/tipler'

const NAVY = '#1B4F72'

interface Props {
  sablon: { id: string; kod: string; ad: string; aciklama: string | null; durum: 'TASLAK' | 'YAYINDA' | 'ARSIV'; veriSetiAd?: string; teknikAciklama?: string | null }
  parametreler: SablonParametre[]
  tasarlayabilir?: boolean
}

interface Sonuc { html: string; satirSayisi: number; sureMs: number }

export default function RaporCalistirClient({ sablon, parametreler, tasarlayabilir }: Props) {
  const [degerler, setDegerler] = useState<Record<string, string>>({})
  const [sonuc, setSonuc] = useState<Sonuc | null>(null)
  const [hata, setHata] = useState<CevrilmisHata | null>(null)
  const [hataMaddeleri, setHataMaddeleri] = useState<string[]>([])
  const [calisiyor, setCalisiyor] = useState<'EKRAN' | 'XLSX' | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const eksikZorunlu = parametreler.filter((p) => p.zorunlu && !(degerler[p.ad] ?? '').trim()).map((p) => p.etiket)

  const govde = () => JSON.stringify({ parametreler: degerler })

  async function calistir() {
    setHata(null)
    setCalisiyor('EKRAN')
    try {
      const d = await apiGonder<Sonuc>(`/api/raporlar/${sablon.id}/calistir`, 'POST', { parametreler: degerler, cikti: 'EKRAN' })
      setSonuc(d)
    } catch (e) {
      setSonuc(null)
      setHata(hataYapisi(e)); setHataMaddeleri(hataListesi(e))
    } finally {
      setCalisiyor(null)
    }
  }

  async function excelIndir() {
    setHata(null)
    setCalisiyor('XLSX')
    try {
      const r = await apiYanit(`/api/raporlar/${sablon.id}/calistir`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parametreler: degerler, cikti: 'XLSX' }),
      })
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${sablon.kod}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setHata(hataYapisi(e)); setHataMaddeleri([])
    } finally {
      setCalisiyor(null)
    }
  }

  function yazdir() {
    const w = iframeRef.current?.contentWindow
    if (!w) return
    w.focus()
    w.print()
  }

  const alan = (p: SablonParametre) => {
    const v = degerler[p.ad] ?? ''
    const set = (deger: string) => setDegerler((d) => ({ ...d, [p.ad]: deger }))
    switch (p.tip) {
      case 'tarih':
        return <DateField id={`p-${p.ad}`} value={v} onChange={set} takvim />
      case 'sayi':
        return <Input id={`p-${p.ad}`} type="number" inputMode="decimal" value={v} onChange={(e) => set(e.target.value)} />
      case 'liste': // Faz 1: liste kaynağı tanımlı değil — serbest metin (virgülle ayrılmış)
      default:
        return <Input id={`p-${p.ad}`} type="text" value={v} onChange={(e) => set(e.target.value)} />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <GeriRozet href="/raporlar">Raporlar</GeriRozet>
          <h1 className="text-xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
            <FileBarChart2 className="h-6 w-6 lg:h-7 lg:w-7" style={{ color: NAVY }} />
            {sablon.ad}
            {sablon.durum === 'TASLAK' && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Taslak</Badge>}
          </h1>
          {/* Kullanıcı açıklaması herkese; teknik satır (veri seti + kaynak) yalnız rapor.tasarla. */}
          {sablon.aciklama && <p className="text-sm text-muted-foreground mt-1">{sablon.aciklama}</p>}
          {tasarlayabilir && (
            <p className="text-xs text-muted-foreground/80 mt-1">
              <span className="font-mono">{sablon.kod}</span>
              {sablon.veriSetiAd ? <> · veri seti: <span className="font-mono">{sablon.veriSetiAd}</span></> : null}
              {sablon.teknikAciklama ? ` · ${sablon.teknikAciklama}` : ''}
            </p>
          )}
        </div>
        {tasarlayabilir && (
          <RozetLink href={`/raporlar/tasarim/${sablon.id}`} icon={<PencilRuler className="h-3.5 w-3.5" />}>Tasarımı düzenle</RozetLink>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Parametreler</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {parametreler.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bu rapor parametre almıyor.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {parametreler.map((p) => (
                <div key={p.ad} className="space-y-1.5">
                  <Label htmlFor={`p-${p.ad}`}>{p.etiket}{p.zorunlu && <span className="text-red-600 ml-0.5">*</span>}</Label>
                  {alan(p)}
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button onClick={calistir} disabled={calisiyor !== null || eksikZorunlu.length > 0} style={{ backgroundColor: NAVY }}>
              {calisiyor === 'EKRAN' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Çalıştır
            </Button>
            <Button variant="outline" onClick={excelIndir} disabled={calisiyor !== null || eksikZorunlu.length > 0}>
              {calisiyor === 'XLSX' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
              Excel
            </Button>
            <Button variant="outline" onClick={yazdir} disabled={!sonuc || calisiyor !== null}>
              <Printer className="h-4 w-4 mr-2" />Yazdır
            </Button>
            {eksikZorunlu.length > 0 && (
              <span className="text-xs text-muted-foreground">Zorunlu: {eksikZorunlu.join(', ')}</span>
            )}
            {sonuc && !calisiyor && (
              <span className="text-xs text-muted-foreground ml-auto">{sonuc.satirSayisi.toLocaleString('tr-TR')} satır · {sonuc.sureMs} ms</span>
            )}
          </div>
          <HataKutusu hata={hata} maddeler={hataMaddeleri} />
        </CardContent>
      </Card>

      {calisiyor === 'EKRAN' && !sonuc && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Rapor hazırlanıyor…
        </div>
      )}

      {sonuc && (
        <Card className="overflow-hidden">
          <iframe
            ref={iframeRef}
            title={sablon.ad}
            srcDoc={sonuc.html}
            sandbox="allow-same-origin allow-modals"
            className="w-full bg-white border-0"
            style={{ height: 'calc(100vh - 220px)', minHeight: 480 }}
          />
        </Card>
      )}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Pencil, Plus, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { normalizeTr } from '@/lib/normalize-tr'
import { HataKoduFormDialog } from './HataKoduFormDialog'
import type { HataKoduRow } from './types'

type Durum = 'aktif' | 'pasif' | 'tumu'

/**
 * Hata kodu listesi (KAL-KYT-15 Bölüm 1) — DÜZ tablo, hiyerarşi YOK.
 *
 * Kaynak Excel'de tek düz liste var (kod + hata adı); üst/alt kod ilişkisi
 * 2026-08-09'da kaldırıldı. Gruplama, katlama, girinti ve "Alt kod ekle"
 * kısayolu ile birlikte ağaç kurma mantığı da silindi.
 *
 * Küme küçük (~126 satır) → tamamı tek istekte gelir; arama ve aktif/pasif
 * filtresi istemcide, yeniden istek atmadan çalışır.
 */
export function HataKoduListeClient({ canManage }: { canManage: boolean }) {
  const [rows, setRows] = useState<HataKoduRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [q, setQ] = useState('')
  const [durum, setDurum] = useState<Durum>('aktif')
  const [geciyor, setGeciyor] = useState<string | null>(null)

  const [formAcik, setFormAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<HataKoduRow | null>(null)

  const fetchList = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      // aktif filtresi istemcide → filtre değişince yeniden istek yok.
      const res = await fetch('/api/quality/hata-kodu')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setRows(json.items ?? [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const aranan = q.trim()
  const nq = normalizeTr(aranan)

  /** Sıralama kod artan. Arama: kod (metin içerir) veya ad (Türkçe-duyarlı). */
  const gorunur = useMemo(() => {
    return rows
      .filter((r) => (durum === 'tumu' ? true : durum === 'aktif' ? r.aktif : !r.aktif))
      .filter(
        (r) => !aranan || String(r.kod).includes(aranan) || normalizeTr(r.ad).includes(nq),
      )
      .sort((a, b) => a.kod - b.kod)
  }, [rows, durum, aranan, nq])

  async function aktifDegistir(r: HataKoduRow, yeni: boolean) {
    setGeciyor(r.id)
    // İyimser güncelleme — hata olursa geri alınır.
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, aktif: yeni } : x)))
    try {
      const res = await fetch(`/api/quality/hata-kodu/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktif: yeni }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'Güncelleme başarısız')
    } catch (e) {
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, aktif: !yeni } : x)))
      toast.error(e instanceof Error ? e.message : 'Güncelleme başarısız')
    } finally {
      setGeciyor(null)
    }
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex items-center justify-end">
          <Button
            onClick={() => {
              setDuzenlenen(null)
              setFormAcik(true)
            }}
            className="bg-[#1B4F72] hover:bg-[#1B4F72]/90"
          >
            <Plus className="h-4 w-4 mr-2" /> Yeni Kod Ekle
          </Button>
        </div>
      )}

      {/* Filtre bar */}
      <div className="rounded-md border bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs text-slate-600">Ara (kod veya ad)</Label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="462 / kalıp hatası / kaynak…"
              className="mt-1 h-9"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-600">Durum</Label>
            <Select value={durum} onValueChange={(v) => setDurum(v as Durum)}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aktif">Aktif</SelectItem>
                <SelectItem value="pasif">Pasif</SelectItem>
                <SelectItem value="tumu">Tümü</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {(aranan !== '' || durum !== 'aktif') && (
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{gorunur.length} sonuç</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ('')
                setDurum('aktif')
              }}
              className="h-7 text-xs"
            >
              <X className="h-3 w-3 mr-1" /> Filtreleri Temizle
            </Button>
          </div>
        )}
      </div>

      {/* Tablo */}
      {loading ? (
        <div className="rounded-md border bg-white p-12 text-center text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Yükleniyor...
        </div>
      ) : err ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          Hata: {err}
        </div>
      ) : gorunur.length === 0 ? (
        <div className="rounded-md border border-dashed bg-slate-50 p-12 text-center">
          <Search className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          <p className="text-slate-600">
            {aranan !== '' || durum !== 'aktif' ? 'Filtrelere uyan kod yok' : 'Henüz kod yok'}
          </p>
        </div>
      ) : (
        <div className="rounded-md border bg-white overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide w-24">
                  Kod
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Ad
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide w-28">
                  Durum
                </th>
                {canManage && (
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide w-40">
                    İşlem
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {/* Pasif satır SOLUK gösterilir, üstü çizili DEĞİL. */}
              {gorunur.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-slate-100 last:border-b-0 hover:bg-slate-50 ${
                    !r.aktif ? 'opacity-60' : ''
                  }`}
                >
                  <td className="px-3 py-2 font-quality-mono tabular-nums text-slate-600">
                    {r.kod}
                  </td>
                  <td className="px-3 py-2 text-slate-800">{r.ad}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={
                        r.aktif
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }
                    >
                      {r.aktif ? 'Aktif' : 'Pasif'}
                    </Badge>
                  </td>
                  {canManage && (
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Switch
                          checked={r.aktif}
                          disabled={geciyor === r.id}
                          onCheckedChange={(v) => aktifDegistir(r, v)}
                          aria-label={`${r.kod} aktif/pasif`}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDuzenlenen(r)
                            setFormAcik(true)
                          }}
                          title="Düzenle"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage && (
        <HataKoduFormDialog
          open={formAcik}
          onOpenChange={setFormAcik}
          kayit={duzenlenen}
          tumKayitlar={rows}
          onKaydedildi={fetchList}
        />
      )}

    </div>
  )
}

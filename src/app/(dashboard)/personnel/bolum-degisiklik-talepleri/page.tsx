'use client'

// Bölüm Değişikliği Talepleri — İV ONAY KUYRUĞU (İnsan Varlıkları menüsü).
// Tek onay adımı: İV onaylar (değişiklik ANINDA uygulanır) ya da gerekçeyle reddeder.
// İSG + doktor onayı ve (talepte boş bırakılmışsa) transfer tarihi burada girilir.
//
// Kapsam/yetki SUNUCUDAN: uç İV değilse 403 döner, ekran yetkisiz görünümü çizer.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRightLeft, ShieldAlert, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { SplitBadge } from '@/components/akademi/SplitBadge'
import { EnvanterArama, envanterAramaEslesir } from '@/components/envanter/EnvanterArama'
import { TalepDurumRozet } from '@/components/bolum-talep/durum-rozet'
import { koltukRozeti } from '@/lib/bolum-talep/bolum-talep-gorev'
import { ACAN_ROL_ETIKET, type BolumTalepSatiri } from '@/components/bolum-talep/tipler'
import { gerekceLabel, ONAY_OPTIONS } from '@/components/personnel/department-transfer/constants'

type Sekme = 'BEKLIYOR' | 'KARARLI' | 'TUMU'

export default function BolumTalepKuyrukPage() {
  const [yetkisiz, setYetkisiz] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [talepler, setTalepler] = useState<BolumTalepSatiri[]>([])
  const [sekme, setSekme] = useState<Sekme>('BEKLIYOR')
  const [arama, setArama] = useState('')
  const [secili, setSecili] = useState<BolumTalepSatiri | null>(null)
  const [kararForm, setKararForm] = useState({ transferTarihi: '', isgOnayi: '', doktorOnayi: '', redGerekcesi: '' })
  const [kaydediliyor, setKaydediliyor] = useState(false)

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    try {
      const qs = sekme === 'BEKLIYOR' ? '?durum=BEKLIYOR' : ''
      const res = await fetch(`/api/bolum-degisiklik-talep${qs}`)
      if (res.status === 403) {
        setYetkisiz(true)
        return
      }
      if (!res.ok) return
      const j = await res.json()
      if (!j.iv) {
        setYetkisiz(true)
        return
      }
      setTalepler(j.talepler ?? [])
    } finally {
      setYukleniyor(false)
    }
  }, [sekme])

  useEffect(() => {
    void yukle()
  }, [yukle])

  const gosterilen = useMemo(() => {
    const kapsamli =
      sekme === 'KARARLI' ? talepler.filter((t) => t.durum !== 'BEKLIYOR') : talepler
    return kapsamli.filter((t) =>
      envanterAramaEslesir(arama, [
        t.talepNo,
        t.personnel.adSoyad,
        t.personnel.sicilNo,
        t.mevcutBolum,
        t.hedefBolum,
        t.acan?.name,
        t.acan?.email,
      ]),
    )
  }, [talepler, sekme, arama])

  function detayAc(t: BolumTalepSatiri) {
    setSecili(t)
    setKararForm({
      transferTarihi: t.transferTarihi ? String(t.transferTarihi).slice(0, 10) : '',
      isgOnayi: t.isgOnayi ?? '',
      doktorOnayi: t.doktorOnayi ?? '',
      redGerekcesi: '',
    })
  }

  async function karar(tip: 'ONAYLA' | 'REDDET') {
    if (!secili) return
    setKaydediliyor(true)
    try {
      const res = await fetch(`/api/bolum-degisiklik-talep/${secili.id}/karar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          karar: tip,
          transferTarihi: kararForm.transferTarihi || null,
          isgOnayi: kararForm.isgOnayi || null,
          doktorOnayi: kararForm.doktorOnayi || null,
          redGerekcesi: kararForm.redGerekcesi || null,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(j.error ?? 'Karar kaydedilemedi', { duration: 8000 })
        return
      }
      if (tip === 'ONAYLA') {
        const koltuk = j.koltuk?.tasindi
          ? 'şema koltuğu taşındı'
          : j.koltukAcma?.koltukAcildi
            ? 'şema koltuğu açıldı'
            : `şema koltuğu taşınamadı (${j.koltuk?.sebep ?? 'sebep yok'})`
        toast.success(`Onaylandı — bölüm değişikliği uygulandı, ${koltuk}`, { duration: 8000 })
      } else {
        toast.success('Talep reddedildi — talebi açana bildirildi')
      }
      setSecili(null)
      await yukle()
    } finally {
      setKaydediliyor(false)
    }
  }

  const onaylanabilir = kararForm.transferTarihi !== '' && kararForm.isgOnayi !== '' && kararForm.doktorOnayi !== ''

  if (!yukleniyor && yetkisiz) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="mb-2 text-lg font-semibold">Bu ekrana erişim yetkiniz yok</h1>
        <p className="text-sm text-muted-foreground">
          Bölüm değişikliği talepleri kuyruğu İnsan Varlıkları'na özeldir.
        </p>
      </div>
    )
  }

  const bekleyenSayisi = talepler.filter((t) => t.durum === 'BEKLIYOR').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ArrowRightLeft className="h-6 w-6" /> Bölüm Değişikliği Talepleri
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Müdür ve müdür yardımcılarının açtığı talepler. Onayladığınızda bölüm değişikliği
          (personel kaydı, bölüm FK'sı ve şema koltuğu) ANINDA uygulanır.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
          {(
            [
              ['BEKLIYOR', `Bekleyen${bekleyenSayisi ? ` (${bekleyenSayisi})` : ''}`],
              ['KARARLI', 'Karara bağlanan'],
              ['TUMU', 'Tümü'],
            ] as [Sekme, string][]
          ).map(([k, etiket]) => (
            <button
              key={k}
              type="button"
              onClick={() => setSekme(k)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                sekme === k ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {etiket}
            </button>
          ))}
        </div>
        <EnvanterArama
          value={arama}
          onChange={setArama}
          placeholder="Talep no, personel, sicil, bölüm veya talep eden ara..."
          className="max-w-md flex-1"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left font-semibold uppercase tracking-wide text-slate-500">
              <tr className="[&>th]:whitespace-nowrap [&>th]:px-3 [&>th]:py-2.5">
                <th>Talep No</th>
                <th>Personel</th>
                <th>Bölüm değişikliği</th>
                <th>Talep eden</th>
                <th>Talep tarihi</th>
                <th>Transfer tarihi</th>
                <th>Durum</th>
                <th className="text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {yukleniyor && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              )}
              {!yukleniyor && gosterilen.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    {arama.trim() ? 'Aramaya uyan talep yok.' : 'Bu kapsamda talep yok.'}
                  </td>
                </tr>
              )}
              {!yukleniyor &&
                gosterilen.map((t) => (
                  <tr key={t.id} className="[&>td]:px-3 [&>td]:py-2.5 hover:bg-slate-50">
                    <td className="font-medium text-slate-700">{t.talepNo}</td>
                    <td>
                      <div className="font-medium">{t.personnel.adSoyad}</div>
                      <div className="text-xs text-muted-foreground">{t.personnel.sicilNo ?? '—'}</div>
                    </td>
                    <td className="whitespace-nowrap">
                      {t.mevcutBolum} → <span className="font-medium">{t.hedefBolum}</span>
                    </td>
                    <td>
                      <div>{t.acan?.name ?? t.acan?.email ?? '—'}</div>
                      <div className="text-xs text-muted-foreground">
                        {ACAN_ROL_ETIKET[t.acanRol] ?? t.acanRol}
                        {t.acanBolum ? ` · ${t.acanBolum}` : ''}
                      </div>
                    </td>
                    <td className="whitespace-nowrap tabular-nums">
                      {new Date(t.talepTarihi).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="whitespace-nowrap tabular-nums">
                      {t.transferTarihi ? (
                        new Date(t.transferTarihi).toLocaleDateString('tr-TR')
                      ) : (
                        <span className="text-amber-700">İV belirleyecek</span>
                      )}
                    </td>
                    <td>
                      <TalepDurumRozet durum={t.durum} />
                      {/* Koltuk taşınmadıysa görünür rozet (06.10.2026) — bu bilgi
                          eskiden yalnız denetim kaydına ve anlık toast'a düşüyordu. */}
                      {koltukRozeti(t).gorunur && (
                        <div
                          className="mt-1 inline-block rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700"
                          title={t.koltukSebep ?? undefined}
                        >
                          ⚠ {koltukRozeti(t).metin}
                        </div>
                      )}
                    </td>
                    <td className="text-right">
                      <SplitBadge
                        color={t.durum === 'BEKLIYOR' ? 'blue' : 'gray'}
                        left={t.durum === 'BEKLIYOR' ? 'Karar' : 'Kayıt'}
                        right={t.durum === 'BEKLIYOR' ? 'İncele' : 'Detay'}
                        onClick={() => detayAc(t)}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {secili && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="w-full max-w-2xl space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {secili.talepNo} · {secili.personnel.adSoyad}
                </h2>
                <p className="text-sm text-slate-600">
                  {secili.mevcutBolum} → <span className="font-medium">{secili.hedefBolum}</span> ·{' '}
                  {secili.acan?.name ?? secili.acan?.email} ({ACAN_ROL_ETIKET[secili.acanRol]})
                </p>
              </div>
              <TalepDurumRozet durum={secili.durum} />
            </div>

            <div className="rounded-xl border bg-slate-50 p-4 text-sm">
              <p className="font-medium text-slate-700">
                Yeni görev: {secili.hedefGorev ?? '(talepte belirtilmedi — mevcut görev korunur)'}
              </p>
              <p className="mt-2 font-medium text-slate-700">Gerekçeler</p>
              <ul className="mt-1 list-inside list-disc text-slate-600">
                {secili.gerekceler.map((g) => (
                  <li key={g}>{gerekceLabel(g)}</li>
                ))}
                {secili.gerekceDigerKisi && <li>Diğer (kişi): {secili.gerekceDigerKisi}</li>}
                {secili.gerekceDigerIs && <li>Diğer (iş): {secili.gerekceDigerIs}</li>}
              </ul>
              {secili.gerekceAciklamasi && (
                <p className="mt-2 text-slate-600">Açıklama: {secili.gerekceAciklamasi}</p>
              )}
            </div>

            {secili.durum === 'BEKLIYOR' ? (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-sm font-medium">Transfer tarihi *</label>
                    <input
                      type="date"
                      value={kararForm.transferTarihi}
                      onChange={(e) => setKararForm((f) => ({ ...f, transferTarihi: e.target.value }))}
                      className="mt-1 h-10 w-full rounded-xl border px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">İSG onayı *</label>
                    <select
                      value={kararForm.isgOnayi}
                      onChange={(e) => setKararForm((f) => ({ ...f, isgOnayi: e.target.value }))}
                      className="mt-1 h-10 w-full rounded-xl border px-3 text-sm"
                    >
                      <option value="">Seçiniz</option>
                      {ONAY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Doktor onayı *</label>
                    <select
                      value={kararForm.doktorOnayi}
                      onChange={(e) => setKararForm((f) => ({ ...f, doktorOnayi: e.target.value }))}
                      className="mt-1 h-10 w-full rounded-xl border px-3 text-sm"
                    >
                      <option value="">Seçiniz</option>
                      {ONAY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Red gerekçesi (reddedecekseniz zorunlu)</label>
                  <textarea
                    value={kararForm.redGerekcesi}
                    onChange={(e) => setKararForm((f) => ({ ...f, redGerekcesi: e.target.value }))}
                    className="mt-1 min-h-20 w-full rounded-xl border p-3 text-sm"
                    placeholder="Talebi reddetme sebebi — talebi açana bildirilir"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
                  <button
                    type="button"
                    onClick={() => setSecili(null)}
                    className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Kapat
                  </button>
                  <SplitBadge
                    color="red"
                    left="Talep"
                    right={kaydediliyor ? 'Kaydediliyor...' : 'Reddet'}
                    onClick={() => void karar('REDDET')}
                    disabled={kaydediliyor || kararForm.redGerekcesi.trim() === ''}
                  />
                  <SplitBadge
                    color="green"
                    left="Bölüm değişikliği"
                    right={kaydediliyor ? 'Uygulanıyor...' : 'Onayla ve Uygula'}
                    onClick={() => void karar('ONAYLA')}
                    disabled={kaydediliyor || !onaylanabilir}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-3 rounded-xl border p-4 text-sm md:grid-cols-2">
                  <div>
                    Karar: <span className="font-medium">{secili.durum}</span>
                  </div>
                  <div>
                    Karar tarihi:{' '}
                    {secili.kararTarihi ? new Date(secili.kararTarihi).toLocaleString('tr-TR') : '—'}
                  </div>
                  <div>Karar veren: {secili.kararVeren?.name ?? secili.kararVeren?.email ?? '—'}</div>
                  <div>
                    Transfer tarihi:{' '}
                    {secili.transferTarihi ? new Date(secili.transferTarihi).toLocaleDateString('tr-TR') : '—'}
                  </div>
                  <div>İSG onayı: {secili.isgOnayi ?? '—'}</div>
                  <div>Doktor onayı: {secili.doktorOnayi ?? '—'}</div>
                  <div>Yeni görev: {secili.hedefGorev ?? '(değişmedi)'}</div>
                  <div>
                    Şema koltuğu:{' '}
                    {secili.koltukTasindi === null ? (
                      '—'
                    ) : secili.koltukTasindi ? (
                      <span className="text-emerald-700">taşındı</span>
                    ) : (
                      <span className="text-rose-700">taşınmadı</span>
                    )}
                  </div>
                  {secili.koltukTasindi === false && secili.koltukSebep && (
                    <div className="md:col-span-2 text-rose-700">Koltuk sebebi: {secili.koltukSebep}</div>
                  )}
                  {secili.redGerekcesi && (
                    <div className="md:col-span-2 text-rose-700">Red gerekçesi: {secili.redGerekcesi}</div>
                  )}
                </div>
                <div className="flex justify-end border-t pt-4">
                  <button
                    type="button"
                    onClick={() => setSecili(null)}
                    className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Kapat
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

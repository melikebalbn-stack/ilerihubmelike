'use client'

// Bölüm Değişikliği Talep Formu — TALEP ekranı (Formlar › İnsan Varlıkları).
// Yalnız müdür / müdür yardımcısı görür (menü bayrağı + uçlar aynı kuralı uygular).
// İV bu ekranı kullanmaz: onun yolu personel kartındaki doğrudan "Bölüm Değiştir".
//
// Personel seçici kapsamı SUNUCUDAN gelir (kendi bölümü + alt ağacı) — client'ta
// yetki/kapsam hesaplanmaz.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRightLeft, ShieldAlert, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { AramaliSecim } from '@/components/envanter/AramaliSecim'
import { SplitBadge } from '@/components/akademi/SplitBadge'
import { TalepDurumRozet } from '@/components/bolum-talep/durum-rozet'
import { ACAN_ROL_ETIKET, type BolumTalepSatiri } from '@/components/bolum-talep/tipler'
import { KISI_GEREKCELER, IS_GEREKCELER, gerekceLabel } from '@/components/personnel/department-transfer/constants'

type SeciciVeri = {
  personeller: { id: string; sicilNo: string | null; adSoyad: string; bolum: string | null; gorev: string | null }[]
  kapsamBolumler: { id: string; name: string }[]
  hedefBolumler: { id: string; name: string }[]
  rol: 'MUDUR' | 'MUDUR_YRD' | null
}

const BOS_FORM = {
  personnelId: '',
  hedefBolum: '',
  hedefGorev: '',
  transferTarihi: '',
  gerekceler: [] as string[],
  gerekceAciklamasi: '',
  gerekceDigerKisi: '',
  gerekceDigerIs: '',
}

export default function BolumDegisiklikTalepPage() {
  const [yetkisiz, setYetkisiz] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [talepler, setTalepler] = useState<BolumTalepSatiri[]>([])
  const [secici, setSecici] = useState<SeciciVeri | null>(null)
  const [formAcik, setFormAcik] = useState(false)
  const [form, setForm] = useState(BOS_FORM)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  // Hedef bölümün şemasındaki BOŞ kutuların unvanları (06.10.2026). Serbest metin
  // değil: koltuk eşleşmesi {bolum, gorev} çiftine bakıyor, listede olmayan bir
  // unvan seçilse koltuk yine taşınamazdı.
  const [gorevSecenekleri, setGorevSecenekleri] = useState<{ ad: string; bosKutu: number }[]>([])
  const [gorevUyari, setGorevUyari] = useState('')
  const [iptalEdilen, setIptalEdilen] = useState<BolumTalepSatiri | null>(null)

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    try {
      const res = await fetch('/api/bolum-degisiklik-talep')
      if (res.status === 403) {
        setYetkisiz(true)
        return
      }
      if (!res.ok) return
      const j = await res.json()
      setTalepler(j.talepler ?? [])
      // İV bu ekranı görmez; bayrak yine sunucudan.
      if (!j.talepAcabilir) setYetkisiz(true)
    } finally {
      setYukleniyor(false)
    }
  }, [])

  useEffect(() => {
    void yukle()
    fetch('/api/bolum-degisiklik-talep/personel-secici')
      .then(async (r) => (r.ok ? setSecici(await r.json()) : null))
      .catch(() => {})
  }, [yukle])

  // Hedef bölüm değişince görev seçenekleri yenilenir; seçili görev listede
  // kalmazsa temizlenir (bölüm değişti, eski unvan artık geçersiz olabilir).
  useEffect(() => {
    if (!form.hedefBolum) {
      setGorevSecenekleri([])
      setGorevUyari('')
      return
    }
    fetch(`/api/bolum-degisiklik-talep/gorev-secenekleri?bolum=${encodeURIComponent(form.hedefBolum)}`)
      .then(async (r) => (r.ok ? r.json() : null))
      .then((d: { secenekler?: { ad: string; bosKutu: number }[]; uyari?: string } | null) => {
        const liste = d?.secenekler ?? []
        setGorevSecenekleri(liste)
        setGorevUyari(
          d?.uyari ??
            (liste.length === 0
              ? 'Hedef bölümde boş kadro kutusu yok — görev seçilemez, koltuk elle taşınır.'
              : ''),
        )
        setForm((f) => (f.hedefGorev && !liste.some((x) => x.ad === f.hedefGorev) ? { ...f, hedefGorev: '' } : f))
      })
      .catch(() => {})
  }, [form.hedefBolum])

  const seciliPersonel = useMemo(
    () => secici?.personeller.find((p) => p.id === form.personnelId) ?? null,
    [secici, form.personnelId],
  )

  function gerekceTogle(value: string) {
    setForm((f) => ({
      ...f,
      gerekceler: f.gerekceler.includes(value)
        ? f.gerekceler.filter((g) => g !== value)
        : [...f.gerekceler, value],
    }))
  }

  const gonderilebilir =
    form.personnelId !== '' &&
    form.hedefBolum !== '' &&
    form.gerekceler.length > 0 &&
    form.hedefBolum !== (seciliPersonel?.bolum ?? '')

  async function gonder() {
    setKaydediliyor(true)
    try {
      const res = await fetch('/api/bolum-degisiklik-talep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, transferTarihi: form.transferTarihi || null }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(j.error ?? 'Talep oluşturulamadı', { duration: 8000 })
        return
      }
      toast.success(`Talep oluşturuldu (${j.talep?.talepNo ?? ''}) — İnsan Varlıkları'na bildirildi`)
      setForm(BOS_FORM)
      setFormAcik(false)
      await yukle()
    } finally {
      setKaydediliyor(false)
    }
  }

  async function geriCek(talep: BolumTalepSatiri) {
    const res = await fetch(`/api/bolum-degisiklik-talep/${talep.id}/iptal`, { method: 'POST' })
    const j = await res.json().catch(() => ({}))
    setIptalEdilen(null)
    if (!res.ok) {
      toast.error(j.error ?? 'Talep geri çekilemedi')
      return
    }
    toast.success('Talep geri çekildi')
    await yukle()
  }

  if (!yukleniyor && yetkisiz) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="mb-2 text-lg font-semibold">Bu forma erişim yetkiniz yok</h1>
        <p className="text-sm text-muted-foreground">
          Bölüm değişikliği talebi yalnız bir departmanın müdürü ya da müdür yardımcısı
          tarafından açılabilir. İnsan Varlıkları bölüm değişikliğini personel kartından
          doğrudan uygular.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ArrowRightLeft className="h-5 w-5" /> Bölüm Değişikliği Talebi
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ekibinizdeki personel için bölüm değişikliği talep edin. Talebi İnsan Varlıkları
            karara bağlar; onaylanınca değişiklik uygulanır.
            {secici?.rol ? ` · Rolünüz: ${ACAN_ROL_ETIKET[secici.rol]}` : ''}
          </p>
        </div>
        <SplitBadge
          color={formAcik ? 'gray' : 'green'}
          left="Talep"
          right={formAcik ? 'Vazgeç' : 'Yeni Talep'}
          onClick={() => setFormAcik((a) => !a)}
        />
      </div>

      {formAcik && (
        <div className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Personel *</label>
              <AramaliSecim
                deger={form.personnelId}
                onChange={(id) => setForm((f) => ({ ...f, personnelId: id }))}
                placeholder="Personel seçin"
                aramaPlaceholder="Sicil, ad veya bölüm ara..."
                secenekler={(secici?.personeller ?? []).map((p) => ({
                  id: p.id,
                  etiket: `${p.sicilNo ?? '—'} · ${p.adSoyad}`,
                  aramaEk: [p.bolum, p.gorev],
                }))}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Yalnız kendi bölümünüz ve alt bölümlerinizdeki aktif personel listelenir
                {secici?.kapsamBolumler?.length
                  ? ` (${secici.kapsamBolumler.map((b) => b.name).join(', ')})`
                  : ''}
                .
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Mevcut bölüm</label>
              <input
                readOnly
                value={seciliPersonel?.bolum ?? ''}
                placeholder="Personel seçilince dolar"
                className="mt-1 h-10 w-full rounded-xl border bg-slate-50 px-3 text-sm text-slate-600"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Hedef bölüm *</label>
              <AramaliSecim
                deger={form.hedefBolum}
                onChange={(ad) => setForm((f) => ({ ...f, hedefBolum: ad }))}
                placeholder="Hedef bölüm seçin"
                aramaPlaceholder="Bölüm ara..."
                secenekler={(secici?.hedefBolumler ?? []).map((b) => ({ id: b.name, etiket: b.name }))}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Yeni görev</label>
              <select
                value={form.hedefGorev}
                onChange={(e) => setForm((f) => ({ ...f, hedefGorev: e.target.value }))}
                disabled={!form.hedefBolum || gorevSecenekleri.length === 0}
                className="mt-1 h-10 w-full rounded-xl border px-3 text-sm disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">Değişmesin (mevcut görev korunur)</option>
                {gorevSecenekleri.map((x) => (
                  <option key={x.ad} value={x.ad}>
                    {x.ad} ({x.bosKutu} boş kadro)
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                {gorevUyari ||
                  'Hedef bölümdeki boş kadro unvanları. Seçilirse şema koltuğu o kutuya taşınır; boş bırakılırsa görev aynı kalır ve koltuk taşınamayabilir.'}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Transfer tarihi</label>
              <input
                type="date"
                value={form.transferTarihi}
                onChange={(e) => setForm((f) => ({ ...f, transferTarihi: e.target.value }))}
                className="mt-1 h-10 w-full rounded-xl border px-3 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Boş bırakırsanız İnsan Varlıkları onaylarken belirler.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border p-4">
              <p className="text-sm font-medium">Kişiden kaynaklı gerekçeler</p>
              <div className="mt-2 space-y-2">
                {KISI_GEREKCELER.map((g) => (
                  <label key={g.value} className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={form.gerekceler.includes(g.value)}
                      onChange={() => gerekceTogle(g.value)}
                    />
                    {g.label}
                  </label>
                ))}
              </div>
              <input
                value={form.gerekceDigerKisi}
                onChange={(e) => setForm((f) => ({ ...f, gerekceDigerKisi: e.target.value }))}
                placeholder="Diğer (kişiden kaynaklı)"
                className="mt-3 h-9 w-full rounded-lg border px-3 text-sm"
              />
            </div>

            <div className="rounded-xl border p-4">
              <p className="text-sm font-medium">İşten kaynaklı gerekçeler</p>
              <div className="mt-2 space-y-2">
                {IS_GEREKCELER.map((g) => (
                  <label key={g.value} className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={form.gerekceler.includes(g.value)}
                      onChange={() => gerekceTogle(g.value)}
                    />
                    {g.label}
                  </label>
                ))}
              </div>
              <input
                value={form.gerekceDigerIs}
                onChange={(e) => setForm((f) => ({ ...f, gerekceDigerIs: e.target.value }))}
                placeholder="Diğer (işten kaynaklı)"
                className="mt-3 h-9 w-full rounded-lg border px-3 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Açıklama</label>
            <textarea
              value={form.gerekceAciklamasi}
              onChange={(e) => setForm((f) => ({ ...f, gerekceAciklamasi: e.target.value }))}
              className="mt-1 min-h-20 w-full rounded-xl border p-3 text-sm"
              placeholder="Talebin ayrıntısı (opsiyonel)"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            İSG ve doktor onayı alanlarını İnsan Varlıkları doldurur — bu formda yer almaz.
          </p>

          <SplitBadge
            color="green"
            left="Talep"
            right={kaydediliyor ? 'Gönderiliyor...' : 'Gönder'}
            onClick={() => void gonder()}
            disabled={!gonderilebilir || kaydediliyor}
          />
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
          Taleplerim ({talepler.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left font-semibold uppercase tracking-wide text-slate-500">
              <tr className="[&>th]:whitespace-nowrap [&>th]:px-3 [&>th]:py-2.5">
                <th>Talep No</th>
                <th>Personel</th>
                <th>Bölüm değişikliği</th>
                <th>Yeni görev</th>
                <th>Talep tarihi</th>
                <th>Transfer tarihi</th>
                <th>Durum</th>
                <th>Karar</th>
                <th className="text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {yukleniyor && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              )}
              {!yukleniyor && talepler.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    Henüz talep açmadınız.
                  </td>
                </tr>
              )}
              {!yukleniyor &&
                talepler.map((t) => (
                  <tr key={t.id} className="[&>td]:px-3 [&>td]:py-2.5 hover:bg-slate-50">
                    <td className="font-medium text-slate-700">{t.talepNo}</td>
                    <td>
                      <div className="font-medium">{t.personnel.adSoyad}</div>
                      <div className="text-xs text-muted-foreground">{t.personnel.sicilNo ?? '—'}</div>
                    </td>
                    <td className="whitespace-nowrap">
                      {t.mevcutBolum} → <span className="font-medium">{t.hedefBolum}</span>
                    </td>
                    <td className="whitespace-nowrap text-muted-foreground">{t.hedefGorev ?? '—'}</td>
                    <td className="whitespace-nowrap tabular-nums">
                      {new Date(t.talepTarihi).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="whitespace-nowrap tabular-nums">
                      {t.transferTarihi ? new Date(t.transferTarihi).toLocaleDateString('tr-TR') : '—'}
                    </td>
                    <td>
                      <TalepDurumRozet durum={t.durum} />
                    </td>
                    <td className="max-w-[240px]">
                      {t.kararTarihi ? (
                        <>
                          <div className="text-xs text-muted-foreground">
                            {new Date(t.kararTarihi).toLocaleDateString('tr-TR')} ·{' '}
                            {t.kararVeren?.name ?? t.kararVeren?.email ?? '—'}
                          </div>
                          {t.redGerekcesi && <div className="text-xs text-rose-700">{t.redGerekcesi}</div>}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="text-right">
                      {t.durum === 'BEKLIYOR' && (
                        <SplitBadge
                          color="red"
                          left={t.talepNo}
                          right="Geri Çek"
                          onClick={() => setIptalEdilen(t)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {talepler.some((t) => t.gerekceler.length > 0) && (
        <p className="text-xs text-muted-foreground">
          Gerekçe etiketleri: {[...new Set(talepler.flatMap((t) => t.gerekceler))].map(gerekceLabel).join(' · ')}
        </p>
      )}

      {iptalEdilen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Talebi geri çek</h2>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-medium">{iptalEdilen.talepNo}</span> · {iptalEdilen.personnel.adSoyad} ·{' '}
              {iptalEdilen.mevcutBolum} → {iptalEdilen.hedefBolum}
              <br />
              Talep İnsan Varlıkları kuyruğundan çıkar. Kayıt silinmez, "geri çekildi" olarak kalır.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIptalEdilen(null)}
                className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Vazgeç
              </button>
              <SplitBadge
                color="red"
                left="Talep"
                right="Geri Çek"
                onClick={() => void geriCek(iptalEdilen)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

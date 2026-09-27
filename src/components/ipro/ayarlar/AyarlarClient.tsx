'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'

type Genel = { carpan: number; taban: number; tavan: number }
type Istisna = { tezgahId: string; kod: string; olculenCevrimSn: number | null; hesaplananEsikSn: number; tabanSn: number | null; tavanSn: number | null }
type Mola = { id: string; vardiyaId: string; bolum: string | null; baslangic: string; sureDk: number; aktif: boolean; sebep: string; gunler: { ad: string; on: boolean }[] }
type Vardiya = { id: string; kod: string; ad: string; baslangicSaat: string; bitisSaat: string; ertesiGuneTasar: boolean; aktif: boolean }
type Tatil = { id: string; tarih: string; tip: string; aciklama: string }
type Gecmis = { zaman: string; kullaniciId: string | null; alan: string; kayitRef: string | null; eski: string | null; yeni: string | null }
type Data = {
  canEdit: boolean; genel: Genel; istisnalar: Istisna[]; molalar: Mola[]; vardiyalar: Vardiya[]; tatiller: Tatil[]; gecmis: Gecmis[]
  sebepler: { id: string; ad: string }[]; bolumler: string[]; tumTezgahlar: { id: string; kod: string }[]
}
const GUN = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz']
const TIP_STIL: Record<string, { z: string; c: string; ad: string }> = {
  TATIL: { z: '#fee2e2', c: '#991b1b', ad: 'Tatil' }, YARIM: { z: '#fef3c7', c: '#92400e', ad: 'Yarım gün' }, MESAI: { z: '#dbeafe', c: '#1e3a8a', ad: 'Mesai' },
}

export function AyarlarClient() {
  const [d, setD] = useState<Data | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [mesaj, setMesaj] = useState<string | null>(null)
  const [bekle, setBekle] = useState(false)

  const yukle = useCallback(async () => {
    const r = await fetch('/api/ipro/ayarlar').then((x) => x.json())
    if (r.ok) setD(r); else setHata(r.error || 'Yüklenemedi')
  }, [])
  useEffect(() => { yukle() }, [yukle])

  const gonder = useCallback(async (body: Record<string, unknown>) => {
    setBekle(true); setHata(null); setMesaj(null)
    try {
      const r = await fetch('/api/ipro/ayarlar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((x) => x.json())
      if (r.ok) { setMesaj('Kaydedildi'); await yukle() } else setHata(r.error || 'İşlem başarısız')
      return r.ok
    } finally { setBekle(false) }
  }, [yukle])

  if (!d) return <div className="text-sm text-slate-400">{hata ?? 'Yükleniyor…'}</div>
  const ro = !d.canEdit

  return (
    <div className="flex gap-5">
      <nav className="sticky top-4 flex h-fit w-52 shrink-0 flex-col gap-1 rounded-xl border border-[#dde1e7] bg-white p-2.5">
        {[['esik', 'Duruş eşikleri'], ['mola', 'Mola takvimi'], ['vardiya', 'Vardiya ve tatil'], ['gecmis', 'Değişiklik geçmişi']].map(([id, ad]) => (
          <a key={id} href={`#${id}`} className="rounded-lg px-3 py-2.5 text-sm text-[#14171c] hover:bg-[#eef2ff]">{ad}</a>
        ))}
        {ro ? <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Salt görüntüleme — düzenleme izni yok</div> : null}
      </nav>

      <div className="flex min-w-0 grow flex-col gap-5">
        {hata ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{hata}</div> : null}
        {mesaj ? <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{mesaj}</div> : null}

        <EsikBolum d={d} ro={ro} bekle={bekle} gonder={gonder} />
        <MolaBolum d={d} ro={ro} bekle={bekle} gonder={gonder} />
        <VardiyaTatilBolum d={d} ro={ro} bekle={bekle} gonder={gonder} />
        <GecmisBolum gecmis={d.gecmis} />
      </div>
    </div>
  )
}

type Gonder = (b: Record<string, unknown>) => Promise<boolean>

function Kart({ id, baslik, aciklama, sag, children }: { id?: string; baslik: string; aciklama?: string; sag?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-4 rounded-xl border border-[#dde1e7] bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{baslik}</h2>
          {aciklama ? <div className="mt-1 text-[13px] text-slate-500">{aciklama}</div> : null}
        </div>
        {sag}
      </div>
      {children}
    </section>
  )
}

function EsikBolum({ d, ro, bekle, gonder }: { d: Data; ro: boolean; bekle: boolean; gonder: Gonder }) {
  const [carpan, setCarpan] = useState(String(d.genel.carpan))
  const [taban, setTaban] = useState(String(d.genel.taban))
  const [tavan, setTavan] = useState(String(d.genel.tavan))
  const [ekle, setEkle] = useState(false)
  const [duzenle, setDuzenle] = useState<string | null>(null)
  return (
    <Kart id="esik" baslik="Duruş eşikleri" aciklama="Sayaç bu süre boyunca artmazsa otomatik duruş açılır. Eşik = çevrim × çarpan, taban ve tavan arasında kırpılır."
      sag={!ro ? <button type="button" disabled={bekle} onClick={() => gonder({ action: 'esik', carpan: Number(carpan.replace(',', '.')), taban: Number(taban), tavan: Number(tavan) })} className="h-10 rounded-lg bg-[#1d4ed8] px-4 text-sm font-semibold text-white disabled:opacity-50">Kaydet</button> : null}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-[13px] text-slate-600">Çevrim çarpanı
          <input value={carpan} readOnly={ro} onChange={(e) => setCarpan(e.target.value)} className="h-10 rounded-lg border border-[#cfd5dd] px-3 font-mono text-[15px]" />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] text-slate-600">Taban (en kısa eşik, sn)
          <input value={taban} readOnly={ro} onChange={(e) => setTaban(e.target.value)} className="h-10 rounded-lg border border-[#cfd5dd] px-3 font-mono text-[15px]" />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] text-slate-600">Tavan (en uzun eşik, sn)
          <input value={tavan} readOnly={ro} onChange={(e) => setTavan(e.target.value)} className="h-10 rounded-lg border border-[#cfd5dd] px-3 font-mono text-[15px]" />
        </label>
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="text-[15px] font-semibold">Tezgah istisnaları</div>
        {!ro ? <button type="button" onClick={() => setEkle((v) => !v)} className="h-9 rounded-lg border border-[#cfd5dd] px-3.5 text-[13px] font-semibold">+ Tezgah ekle</button> : null}
      </div>
      {ekle && !ro ? <IstisnaForm d={d} bekle={bekle} gonder={gonder} kapat={() => setEkle(false)} /> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead><tr className="border-b border-[#dde1e7] text-left text-xs text-slate-500">
            <th className="px-2.5 py-2">Tezgah</th><th className="px-2.5 py-2">Ölçülen çevrim</th><th className="px-2.5 py-2">Hesaplanan eşik</th><th className="px-2.5 py-2">Taban</th><th className="px-2.5 py-2">Tavan</th><th className="px-2.5 py-2"></th>
          </tr></thead>
          <tbody>
            {d.istisnalar.length === 0 ? <tr><td colSpan={6} className="px-2.5 py-4 text-slate-400">İstisna yok</td></tr> : null}
            {d.istisnalar.map((i) => duzenle === i.tezgahId && !ro ? (
              <IstisnaDuzenleRow key={i.tezgahId} ist={i} bekle={bekle} gonder={gonder} kapat={() => setDuzenle(null)} />
            ) : (
              <tr key={i.tezgahId} className="border-b border-[#eceef2]">
                <td className="px-2.5 py-2.5 font-mono font-semibold">{i.kod}</td>
                <td className="px-2.5 py-2.5 font-mono">{i.olculenCevrimSn != null ? `${i.olculenCevrimSn} sn` : '—'}</td>
                <td className="px-2.5 py-2.5 font-mono">{i.hesaplananEsikSn} sn</td>
                <td className="px-2.5 py-2.5 font-mono">{i.tabanSn ?? '—'}</td>
                <td className="px-2.5 py-2.5 font-mono font-semibold">{i.tavanSn ?? '—'}</td>
                <td className="px-2.5 py-2.5 text-right">
                  {!ro ? <span className="flex justify-end gap-1.5">
                    <button type="button" onClick={() => setDuzenle(i.tezgahId)} className="h-8 rounded-md border border-[#cfd5dd] px-2.5 text-xs">Düzenle</button>
                    <button type="button" disabled={bekle} onClick={() => gonder({ action: 'tezgah-istisna-sil', tezgahId: i.tezgahId })} className="h-8 rounded-md border border-[#cfd5dd] px-2.5 text-xs text-red-600">Sil</button>
                  </span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-slate-500">Boş bırakılan alan genel değeri kullanır. Ölçülen çevrim ve hesaplanan eşik salt okunur.</div>
    </Kart>
  )
}

function IstisnaForm({ d, bekle, gonder, kapat }: { d: Data; bekle: boolean; gonder: Gonder; kapat: () => void }) {
  const [tezgahId, setTezgahId] = useState(d.tumTezgahlar[0]?.id ?? '')
  const [tabanSn, setTabanSn] = useState(''); const [tavanSn, setTavanSn] = useState(''); const [not, setNot] = useState('')
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg bg-[#f7f8fa] p-3">
      <label className="flex flex-col gap-1 text-xs text-slate-500">Tezgah
        <select value={tezgahId} onChange={(e) => setTezgahId(e.target.value)} className="h-9 rounded-lg border border-[#cfd5dd] px-2 text-sm">{d.tumTezgahlar.map((t) => <option key={t.id} value={t.id}>{t.kod}</option>)}</select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-500">Taban (sn)<input value={tabanSn} onChange={(e) => setTabanSn(e.target.value)} className="h-9 w-24 rounded-lg border border-[#cfd5dd] px-2 font-mono text-sm" /></label>
      <label className="flex flex-col gap-1 text-xs text-slate-500">Tavan (sn)<input value={tavanSn} onChange={(e) => setTavanSn(e.target.value)} className="h-9 w-24 rounded-lg border border-[#cfd5dd] px-2 font-mono text-sm" /></label>
      <label className="flex grow flex-col gap-1 text-xs text-slate-500">Not<input value={not} onChange={(e) => setNot(e.target.value)} className="h-9 rounded-lg border border-[#cfd5dd] px-2 text-sm" /></label>
      <button type="button" disabled={bekle} onClick={async () => { if (await gonder({ action: 'tezgah-istisna', tezgahId, tabanSn, tavanSn, not })) kapat() }} className="h-9 rounded-lg bg-[#1d4ed8] px-4 text-sm font-semibold text-white">Ekle</button>
      <button type="button" onClick={kapat} className="h-9 rounded-lg border border-[#cfd5dd] px-3 text-sm">Vazgeç</button>
    </div>
  )
}

function IstisnaDuzenleRow({ ist, bekle, gonder, kapat }: { ist: Istisna; bekle: boolean; gonder: Gonder; kapat: () => void }) {
  const [tabanSn, setTabanSn] = useState(ist.tabanSn?.toString() ?? ''); const [tavanSn, setTavanSn] = useState(ist.tavanSn?.toString() ?? '')
  return (
    <tr className="border-b border-[#eceef2] bg-[#f7f8fa]">
      <td className="px-2.5 py-2 font-mono font-semibold">{ist.kod}</td>
      <td className="px-2.5 py-2 font-mono text-slate-400">{ist.olculenCevrimSn ?? '—'}</td>
      <td className="px-2.5 py-2 font-mono text-slate-400">—</td>
      <td className="px-2.5 py-2"><input value={tabanSn} onChange={(e) => setTabanSn(e.target.value)} className="h-8 w-20 rounded border border-[#cfd5dd] px-2 font-mono text-xs" /></td>
      <td className="px-2.5 py-2"><input value={tavanSn} onChange={(e) => setTavanSn(e.target.value)} className="h-8 w-20 rounded border border-[#cfd5dd] px-2 font-mono text-xs" /></td>
      <td className="px-2.5 py-2 text-right"><span className="flex justify-end gap-1.5">
        <button type="button" disabled={bekle} onClick={async () => { if (await gonder({ action: 'tezgah-istisna', tezgahId: ist.tezgahId, tabanSn, tavanSn, not: null })) kapat() }} className="h-8 rounded-md bg-[#1d4ed8] px-2.5 text-xs text-white">Kaydet</button>
        <button type="button" onClick={kapat} className="h-8 rounded-md border border-[#cfd5dd] px-2.5 text-xs">Vazgeç</button>
      </span></td>
    </tr>
  )
}

function MolaBolum({ d, ro, bekle, gonder }: { d: Data; ro: boolean; bekle: boolean; gonder: Gonder }) {
  const [vardiyaId, setVardiyaId] = useState(d.vardiyalar[0]?.id ?? '')
  const [bolumFiltre, setBolumFiltre] = useState('')
  const [ekle, setEkle] = useState(false)
  const list = d.molalar.filter((m) => m.vardiyaId === vardiyaId && (!bolumFiltre || m.bolum === bolumFiltre))
  return (
    <Kart id="mola" baslik="Mola takvimi" aciklama="Mola penceresinde otomatik duruş açılmaz; mola süresi planlı süreden düşülür. Bölüm boşsa tüm bölümler için geçerlidir."
      sag={!ro ? <button type="button" onClick={() => setEkle((v) => !v)} className="h-10 rounded-lg bg-[#1d4ed8] px-4 text-sm font-semibold text-white">+ Mola ekle</button> : null}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-0.5 rounded-lg bg-[#f1f3f6] p-0.5">
          {d.vardiyalar.map((v) => (
            <button key={v.id} type="button" onClick={() => setVardiyaId(v.id)} className={`rounded-md px-3.5 py-1.5 text-[13px] ${vardiyaId === v.id ? 'bg-white font-semibold shadow-sm' : 'text-slate-500'}`}>{v.kod} · {v.baslangicSaat}–{v.bitisSaat}</button>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-xs text-slate-500">Bölüm
          <select value={bolumFiltre} onChange={(e) => setBolumFiltre(e.target.value)} className="h-9 w-48 rounded-lg border border-[#cfd5dd] px-2 text-sm"><option value="">Tümü</option>{d.bolumler.map((b) => <option key={b} value={b}>{b}</option>)}</select>
        </label>
      </div>
      {ekle && !ro ? <MolaForm d={d} vardiyaId={vardiyaId} bekle={bekle} gonder={gonder} kapat={() => setEkle(false)} /> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-[13px]">
          <thead><tr className="border-b border-[#dde1e7] text-left text-xs text-slate-500">
            <th className="px-2.5 py-2">Bölüm</th><th className="px-2.5 py-2">Sebep</th><th className="px-2.5 py-2">Başlangıç</th><th className="px-2.5 py-2">Süre</th><th className="px-2.5 py-2">Günler</th><th className="px-2.5 py-2">Aktif</th><th className="px-2.5 py-2"></th>
          </tr></thead>
          <tbody>
            {list.length === 0 ? <tr><td colSpan={7} className="px-2.5 py-4 text-slate-400">Bu vardiya/bölümde mola yok</td></tr> : null}
            {list.map((m) => (
              <tr key={m.id} className={`border-b border-[#eceef2] ${m.aktif ? '' : 'opacity-50'}`}>
                <td className="px-2.5 py-2.5">{m.bolum ?? 'Tümü'}</td>
                <td className="px-2.5 py-2.5">{m.sebep}</td>
                <td className="px-2.5 py-2.5 font-mono">{m.baslangic}</td>
                <td className="px-2.5 py-2.5 font-mono">{m.sureDk} dk</td>
                <td className="px-2.5 py-2.5"><span className="flex gap-1">{m.gunler.map((g, i) => (
                  <span key={i} className="flex h-6 w-6 items-center justify-center rounded text-[11px] font-semibold" style={{ background: g.on ? '#dbeafe' : '#f1f3f6', color: g.on ? '#1e3a8a' : '#8a93a1' }}>{g.ad}</span>
                ))}</span></td>
                <td className="px-2.5 py-2.5 font-semibold" style={{ color: m.aktif ? '#15803d' : '#8a93a1' }}>{m.aktif ? 'Evet' : 'Pasif'}</td>
                <td className="px-2.5 py-2.5 text-right">
                  {!ro ? <button type="button" disabled={bekle} onClick={() => gonder({ action: 'mola-pasif', id: m.id, aktif: !m.aktif })} className="h-8 rounded-md border border-[#cfd5dd] px-2.5 text-xs">{m.aktif ? 'Pasif yap' : 'Aktif yap'}</button> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-slate-500">Silme yok — pasif yapılır. Çakışan mola (aynı vardiya+bölüm+gün) reddedilir.</div>
    </Kart>
  )
}

function MolaForm({ d, vardiyaId, bekle, gonder, kapat }: { d: Data; vardiyaId: string; bekle: boolean; gonder: Gonder; kapat: () => void }) {
  const [bolum, setBolum] = useState(''); const [sebepId, setSebepId] = useState(d.sebepler[0]?.id ?? '')
  const [baslangic, setBaslangic] = useState('12:00'); const [sureDk, setSureDk] = useState('30')
  const [gunler, setGunler] = useState<boolean[]>([true, true, true, true, true, false, false])
  const maske = gunler.reduce((acc, on, i) => acc + (on ? 1 << i : 0), 0)
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg bg-[#f7f8fa] p-3">
      <label className="flex flex-col gap-1 text-xs text-slate-500">Bölüm
        <select value={bolum} onChange={(e) => setBolum(e.target.value)} className="h-9 w-40 rounded-lg border border-[#cfd5dd] px-2 text-sm"><option value="">Tümü</option>{d.bolumler.map((b) => <option key={b} value={b}>{b}</option>)}</select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-500">Sebep
        <select value={sebepId} onChange={(e) => setSebepId(e.target.value)} className="h-9 w-44 rounded-lg border border-[#cfd5dd] px-2 text-sm">{d.sebepler.map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}</select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-500">Başlangıç<input value={baslangic} onChange={(e) => setBaslangic(e.target.value)} placeholder="HH:mm" className="h-9 w-24 rounded-lg border border-[#cfd5dd] px-2 font-mono text-sm" /></label>
      <label className="flex flex-col gap-1 text-xs text-slate-500">Süre (dk)<input value={sureDk} onChange={(e) => setSureDk(e.target.value)} className="h-9 w-20 rounded-lg border border-[#cfd5dd] px-2 font-mono text-sm" /></label>
      <div className="flex flex-col gap-1 text-xs text-slate-500">Günler
        <span className="flex gap-1">{GUN.map((g, i) => (
          <button key={i} type="button" onClick={() => setGunler((p) => p.map((v, j) => j === i ? !v : v))} className="flex h-9 w-8 items-center justify-center rounded text-[11px] font-semibold" style={{ background: gunler[i] ? '#dbeafe' : '#f1f3f6', color: gunler[i] ? '#1e3a8a' : '#8a93a1' }}>{g}</button>
        ))}</span>
      </div>
      <button type="button" disabled={bekle} onClick={async () => { if (await gonder({ action: 'mola', vardiyaId, bolum, sebepId, baslangic, sureDk: Number(sureDk), gunMaskesi: maske })) kapat() }} className="h-9 rounded-lg bg-[#1d4ed8] px-4 text-sm font-semibold text-white">Ekle</button>
      <button type="button" onClick={kapat} className="h-9 rounded-lg border border-[#cfd5dd] px-3 text-sm">Vazgeç</button>
    </div>
  )
}

function VardiyaTatilBolum({ d, ro, bekle, gonder }: { d: Data; ro: boolean; bekle: boolean; gonder: Gonder }) {
  const [duzenle, setDuzenle] = useState<string | null>(null)
  const [tatilEkle, setTatilEkle] = useState(false)
  return (
    <section id="vardiya" className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="flex flex-col gap-3 rounded-xl border border-[#dde1e7] bg-white p-5">
        <h2 className="text-lg font-semibold">Vardiyalar</h2>
        <table className="w-full text-[13px]">
          <thead><tr className="border-b border-[#dde1e7] text-left text-xs text-slate-500"><th className="px-2.5 py-2">Ad</th><th className="px-2.5 py-2">Başlangıç</th><th className="px-2.5 py-2">Bitiş</th><th className="px-2.5 py-2"></th></tr></thead>
          <tbody>
            {d.vardiyalar.map((v) => duzenle === v.id && !ro ? <VardiyaDuzenle key={v.id} v={v} bekle={bekle} gonder={gonder} kapat={() => setDuzenle(null)} /> : (
              <tr key={v.id} className="border-b border-[#eceef2]">
                <td className="px-2.5 py-2.5 font-semibold">{v.kod}</td>
                <td className="px-2.5 py-2.5 font-mono">{v.baslangicSaat}</td>
                <td className="px-2.5 py-2.5 font-mono">{v.bitisSaat}{v.ertesiGuneTasar ? <span className="ml-1 text-xs text-slate-500">+1 gün</span> : null}</td>
                <td className="px-2.5 py-2.5 text-right">{!ro ? <button type="button" onClick={() => setDuzenle(v.id)} className="h-8 rounded-md border border-[#cfd5dd] px-2.5 text-xs">Düzenle</button> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-[#dde1e7] bg-white p-5">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Tatil ve yarım günler</h2>
          {!ro ? <button type="button" onClick={() => setTatilEkle((v) => !v)} className="h-9 rounded-lg border border-[#cfd5dd] px-3.5 text-[13px] font-semibold">+ Gün ekle</button> : null}</div>
        {tatilEkle && !ro ? <TatilForm bekle={bekle} gonder={gonder} kapat={() => setTatilEkle(false)} /> : null}
        <table className="w-full text-[13px]">
          <thead><tr className="border-b border-[#dde1e7] text-left text-xs text-slate-500"><th className="px-2.5 py-2">Tarih</th><th className="px-2.5 py-2">Durum</th><th className="px-2.5 py-2"></th></tr></thead>
          <tbody>
            {d.tatiller.length === 0 ? <tr><td colSpan={3} className="px-2.5 py-4 text-slate-400">Kayıt yok</td></tr> : null}
            {d.tatiller.map((t) => { const st = TIP_STIL[t.tip] ?? { z: '#f1f3f6', c: '#5b6472', ad: t.tip }; return (
              <tr key={t.id} className="border-b border-[#eceef2]">
                <td className="px-2.5 py-2.5 font-mono">{t.tarih}</td>
                <td className="px-2.5 py-2.5"><span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: st.z, color: st.c }}>{st.ad}</span> <span className="text-xs text-slate-400">{t.aciklama}</span></td>
                <td className="px-2.5 py-2.5 text-right">{!ro ? <button type="button" disabled={bekle} onClick={() => gonder({ action: 'tatil-sil', id: t.id })} className="h-8 rounded-md border border-[#cfd5dd] px-2.5 text-xs text-red-600">Sil</button> : null}</td>
              </tr>
            ) })}
          </tbody>
        </table>
        <div className="text-xs text-slate-500">Tatil: planlı süre 0 · Yarım gün: planlı süre yarıya iner.</div>
      </div>
    </section>
  )
}

function VardiyaDuzenle({ v, bekle, gonder, kapat }: { v: Vardiya; bekle: boolean; gonder: Gonder; kapat: () => void }) {
  const [bas, setBas] = useState(v.baslangicSaat); const [bit, setBit] = useState(v.bitisSaat); const [ertesi, setErtesi] = useState(v.ertesiGuneTasar)
  return (
    <tr className="border-b border-[#eceef2] bg-[#f7f8fa]">
      <td className="px-2.5 py-2 font-semibold">{v.kod}</td>
      <td className="px-2.5 py-2"><input value={bas} onChange={(e) => setBas(e.target.value)} className="h-8 w-20 rounded border border-[#cfd5dd] px-2 font-mono text-xs" /></td>
      <td className="px-2.5 py-2"><input value={bit} onChange={(e) => setBit(e.target.value)} className="h-8 w-20 rounded border border-[#cfd5dd] px-2 font-mono text-xs" /> <label className="ml-1 text-[11px]"><input type="checkbox" checked={ertesi} onChange={(e) => setErtesi(e.target.checked)} /> +1</label></td>
      <td className="px-2.5 py-2 text-right"><span className="flex justify-end gap-1.5">
        <button type="button" disabled={bekle} onClick={async () => { if (await gonder({ action: 'vardiya', id: v.id, baslangicSaat: bas, bitisSaat: bit, ertesiGuneTasar: ertesi })) kapat() }} className="h-8 rounded-md bg-[#1d4ed8] px-2.5 text-xs text-white">Kaydet</button>
        <button type="button" onClick={kapat} className="h-8 rounded-md border border-[#cfd5dd] px-2.5 text-xs">Vazgeç</button>
      </span></td>
    </tr>
  )
}

function TatilForm({ bekle, gonder, kapat }: { bekle: boolean; gonder: Gonder; kapat: () => void }) {
  const [tarih, setTarih] = useState(''); const [tip, setTip] = useState('TATIL'); const [aciklama, setAciklama] = useState('')
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg bg-[#f7f8fa] p-3">
      <label className="flex flex-col gap-1 text-xs text-slate-500">Tarih<input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} className="h-9 rounded-lg border border-[#cfd5dd] px-2 text-sm" /></label>
      <label className="flex flex-col gap-1 text-xs text-slate-500">Durum<select value={tip} onChange={(e) => setTip(e.target.value)} className="h-9 rounded-lg border border-[#cfd5dd] px-2 text-sm"><option value="TATIL">Tatil</option><option value="YARIM">Yarım gün</option><option value="MESAI">Mesai</option></select></label>
      <label className="flex grow flex-col gap-1 text-xs text-slate-500">Açıklama<input value={aciklama} onChange={(e) => setAciklama(e.target.value)} className="h-9 rounded-lg border border-[#cfd5dd] px-2 text-sm" /></label>
      <button type="button" disabled={bekle} onClick={async () => { if (await gonder({ action: 'tatil-ekle', tarih, tip, aciklama })) kapat() }} className="h-9 rounded-lg bg-[#1d4ed8] px-4 text-sm font-semibold text-white">Ekle</button>
      <button type="button" onClick={kapat} className="h-9 rounded-lg border border-[#cfd5dd] px-3 text-sm">Vazgeç</button>
    </div>
  )
}

function GecmisBolum({ gecmis }: { gecmis: Gecmis[] }) {
  const trZaman = (iso: string) => { const d = new Date(iso); return d.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) }
  return (
    <Kart id="gecmis" baslik="Değişiklik geçmişi" aciklama="Son 100 kayıt. Değişiklik geriye dönük OEE kayıtlarını etkilemez; kaydedildiği andan itibaren uygulanır.">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead><tr className="border-b border-[#dde1e7] text-left text-xs text-slate-500"><th className="px-2.5 py-2">Zaman</th><th className="px-2.5 py-2">Kullanıcı</th><th className="px-2.5 py-2">Alan</th><th className="px-2.5 py-2">Değişiklik</th></tr></thead>
          <tbody>
            {gecmis.length === 0 ? <tr><td colSpan={4} className="px-2.5 py-4 text-slate-400">Kayıt yok</td></tr> : null}
            {gecmis.map((g, i) => (
              <tr key={i} className="border-b border-[#eceef2]">
                <td className="px-2.5 py-2.5 font-mono text-xs">{trZaman(g.zaman)}</td>
                <td className="px-2.5 py-2.5 text-xs">{g.kullaniciId ?? '—'}</td>
                <td className="px-2.5 py-2.5">{g.alan}{g.kayitRef ? ` · ${g.kayitRef}` : ''}</td>
                <td className="px-2.5 py-2.5 font-mono text-xs">{g.eski ?? '∅'} → {g.yeni ?? '∅'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Kart>
  )
}

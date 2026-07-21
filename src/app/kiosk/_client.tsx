'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { Numpad } from '@/components/ipro/Numpad'

// ── Tipler ──
type Tezgah = { id: string; kod: string; ad: string }
type Operator = { id: string; adSoyad: string; sicilNo: string | null }
type Is = {
  id: string
  isEmriNo: string
  operasyon: string
  operasyonNo: number
  stokKodu: string
  stokAdi: string
  kalanMiktar: number
  durum: string
}
type AcikIs = { id: string; ifsOrderNo: string; ifsOperationNo: number } | null
type Sebep = { kod: string; ad: string }
type DurusSebep = { id: string; kod: string; ad: string; renkKodu: string | null; durusAktifkenIsBitirilemez: boolean }
type AktifDurus = { id: string; sebepAd: string; baslangic: string; durusAktifkenIsBitirilemez: boolean }
type Adim = 'tezgah' | 'operator' | 'is-listesi' | 'is-onay' | 'calisiyor' | 'durus-sebep' | 'durusta' | 'bitir' | 'ozet'

// ── Ortak API yardımcıları ──
async function apiGet<T>(url: string): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(url, { cache: 'no-store' })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}
async function apiPost<T>(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

// ── Büyük buton ──
function BigButton({
  children,
  onClick,
  variant = 'default',
  disabled,
  className = '',
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
  disabled?: boolean
  className?: string
}) {
  const base = 'min-h-16 rounded-xl px-6 text-2xl font-bold transition-colors disabled:opacity-40'
  const styles = {
    default: 'bg-slate-800 text-slate-100 active:bg-slate-700',
    primary: 'bg-[#1B4F72] text-white active:bg-[#163f5c]',
    danger: 'bg-red-700 text-white active:bg-red-800',
    ghost: 'bg-transparent text-slate-400 active:bg-slate-900',
  }[variant]
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  )
}

export function KioskClient() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return <Merkez>Yükleniyor…</Merkez>
  }
  if (status !== 'authenticated') {
    return <KioskLogin />
  }
  // Oturum var ama KIOSK rolü DEĞİL (ör. beyaz yaka kendi hesabıyla girmiş).
  // Rol kontrolü olmadan akış açılıyor, ardından her API çağrısı requireKiosk'ta
  // 403 alıyordu → operatör "ekran geldi ama hiçbir şey yüklenmiyor" görüyordu.
  if (session?.user?.role !== 'KIOSK') {
    return <KioskLogin yabanciOturum={session?.user?.email ?? null} />
  }
  return <KioskAkis />
}

function Merkez({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center text-2xl text-slate-400">{children}</div>
}

// ── Cihaz login ──
// yabanciOturum: KIOSK olmayan bir oturum açıksa o hesabın e-postası; uyarı +
// çıkış butonu gösterilir. null ise sade giriş ekranı.
function KioskLogin({ yabanciOturum = null }: { yabanciOturum?: string | null }) {
  const [kod, setKod] = useState('')
  const [password, setPassword] = useState('')
  const [hata, setHata] = useState<string | null>(null)
  const [bekliyor, setBekliyor] = useState(false)

  async function girisYap() {
    setHata(null)
    setBekliyor(true)
    const r = await signIn('kiosk', { kod, password, redirect: false })
    setBekliyor(false)
    if (r?.error) setHata('Cihaz kodu veya şifre hatalı')
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-full max-w-md space-y-5 rounded-2xl bg-slate-900 p-8">
        <h1 className="text-center text-4xl font-bold text-[#4a90c2]">IPRO Kiosk</h1>
        <p className="text-center text-lg text-slate-400">Üretim Terminali — Cihaz Girişi</p>

        {yabanciOturum && (
          <div className="space-y-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-5">
            <p className="text-center text-xl text-amber-200">
              Bu cihaz için kiosk hesabıyla giriş yapın.
            </p>
            <p className="text-center text-base text-amber-200/70">
              Şu an açık oturum: {yabanciOturum}
            </p>
            <BigButton
              variant="ghost"
              onClick={() => signOut({ callbackUrl: '/kiosk' })}
              className="w-full"
            >
              Oturumu Kapat
            </BigButton>
          </div>
        )}

        <input
          value={kod}
          onChange={(e) => setKod(e.target.value)}
          placeholder="Cihaz Kodu"
          className="h-16 w-full rounded-xl bg-slate-800 px-5 text-2xl text-slate-100 placeholder:text-slate-500"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Şifre"
          type="password"
          className="h-16 w-full rounded-xl bg-slate-800 px-5 text-2xl text-slate-100 placeholder:text-slate-500"
        />
        {hata && <p className="text-center text-xl text-red-400">{hata}</p>}
        <BigButton variant="primary" onClick={girisYap} disabled={bekliyor || !kod || !password} className="w-full">
          {bekliyor ? 'Giriş yapılıyor…' : 'Giriş'}
        </BigButton>
      </div>
    </div>
  )
}

// ── Ana akış ──
function KioskAkis() {
  const [adim, setAdim] = useState<Adim>('tezgah')
  const [tezgahlar, setTezgahlar] = useState<Tezgah[]>([])
  const [tezgah, setTezgah] = useState<Tezgah | null>(null)
  const [operatorler, setOperatorler] = useState<Operator[]>([])
  const [operator, setOperator] = useState<Operator | null>(null)
  const [isler, setIsler] = useState<Is[]>([])
  const [secilenIs, setSecilenIs] = useState<Is | null>(null) // onay ekranındaki iş
  const [aktifIs, setAktifIs] = useState<{ ifsOrderNo: string; ifsOperationNo: number; operasyon?: string } | null>(null)
  const [durusSebepler, setDurusSebepler] = useState<DurusSebep[]>([])
  const [aktifDurus, setAktifDurus] = useState<AktifDurus | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [yukleniyor, setYukleniyor] = useState(false)

  // Tezgahları yükle
  useEffect(() => {
    apiGet<{ tezgahlar: Tezgah[] }>('/api/ipro/kiosk/tezgahlar').then((r) => {
      if (r.ok) setTezgahlar(r.data.tezgahlar)
    })
  }, [])

  const geri = useCallback(() => setHata(null), [])

  // Adım değiştiren HER gezinme hatayı da temizler. Düz setAdim kullanılırsa
  // önceki adımın hata banner'ı yeni ekranda asılı kalıyor (ör. iş listesi 503
  // aldıktan sonra geri dönünce "Tezgah Seç" başlığının üstünde duruyordu).
  // İstisna: hatayı bilerek gösterip adım değiştiren yerler (503 yolu) —
  // orada setHata + setAdim sırası korunur.
  const adimGec = useCallback((a: Adim) => {
    setHata(null)
    setAdim(a)
  }, [])

  // Tezgah seç → operatörleri getir
  async function tezgahSec(t: Tezgah) {
    setTezgah(t)
    setHata(null)
    setYukleniyor(true)
    const r = await apiGet<{ operatorler: Operator[] }>(`/api/ipro/kiosk/operatorler?tezgahId=${t.id}`)
    setYukleniyor(false)
    if (r.ok) {
      setOperatorler(r.data.operatorler)
      setAdim('operator')
    } else setHata('Operatör listesi alınamadı')
  }

  // Operatör seç → oturum aç → açık iş var mı?
  async function operatorSec(o: Operator) {
    if (!tezgah) return
    setOperator(o)
    setHata(null)
    setYukleniyor(true)
    const oturum = await apiPost('/api/ipro/kiosk/oturum', { personnelId: o.id, tezgahId: tezgah.id })
    if (!oturum.ok) {
      setYukleniyor(false)
      setHata('Oturum açılamadı')
      return
    }
    const acik = await apiGet<{ acik: AcikIs }>(`/api/ipro/kiosk/acik-is?tezgahId=${tezgah.id}&personnelId=${o.id}`)
    setYukleniyor(false)
    if (acik.ok && acik.data.acik) {
      setAktifIs({ ifsOrderNo: acik.data.acik.ifsOrderNo, ifsOperationNo: acik.data.acik.ifsOperationNo })
      setAdim('calisiyor') // devam ekranı
    } else {
      isListesiYukle()
    }
  }

  async function isListesiYukle() {
    if (!tezgah) return
    setHata(null)
    setYukleniyor(true)
    const r = await apiGet<{ isler: Is[] }>(`/api/ipro/kiosk/isler?tezgahId=${tezgah.id}`)
    setYukleniyor(false)
    if (r.ok) {
      setIsler(r.data.isler)
      setAdim('is-listesi')
    } else if (r.status === 503) {
      setHata('İş listesi alınamadı, tekrar deneyin')
      setAdim('is-listesi')
    } else setHata('İş listesi alınamadı')
  }

  // İş seç → başla
  async function isBasla(is: Is) {
    if (!tezgah || !operator) return
    setHata(null)
    setYukleniyor(true)
    const r = await apiPost<{ id: string }>('/api/ipro/kiosk/is-basla', {
      tezgahId: tezgah.id,
      personnelId: operator.id,
      ifsOrderNo: is.isEmriNo,
      ifsOperationNo: is.operasyonNo,
    })
    setYukleniyor(false)
    if (r.ok) {
      setAktifIs({ ifsOrderNo: is.isEmriNo, ifsOperationNo: is.operasyonNo, operasyon: is.operasyon })
      setAdim('calisiyor')
    } else if (r.status === 503) {
      setHata('Sayaç okunamıyor, tekniğe haber verin')
    } else if (r.status === 409) {
      setHata('Bu iş zaten açık')
    } else setHata('İş başlatılamadı')
  }

  // Duruş başlat → sebep listesini yükle → sebep gridi
  async function durusAc() {
    setHata(null)
    setYukleniyor(true)
    const r = await apiGet<{ sebepler: DurusSebep[] }>('/api/ipro/kiosk/durus-sebepleri')
    setYukleniyor(false)
    if (r.ok) {
      setDurusSebepler(r.data.sebepler)
      setAdim('durus-sebep')
    } else setHata('Duruş sebepleri alınamadı')
  }

  // Sebep seç → duruş başlat → kırmızı duruş modu
  async function durusSecti(s: DurusSebep) {
    if (!tezgah || !operator) return
    setHata(null)
    setYukleniyor(true)
    const r = await apiPost<{ id: string; baslangic: string }>('/api/ipro/kiosk/durus-basla', {
      tezgahId: tezgah.id,
      personnelId: operator.id,
      durusSebebiId: s.id,
    })
    setYukleniyor(false)
    if (r.ok) {
      setAktifDurus({
        id: r.data.id,
        sebepAd: s.ad,
        baslangic: r.data.baslangic,
        durusAktifkenIsBitirilemez: s.durusAktifkenIsBitirilemez,
      })
      setAdim('durusta')
    } else if (r.status === 409) {
      setHata('Bu tezgahta zaten açık duruş var')
    } else setHata('Duruş başlatılamadı')
  }

  // Duruş bitir → çalışıyor ekranına dön
  async function durusBitir() {
    if (!tezgah) return
    setHata(null)
    setYukleniyor(true)
    const r = await apiPost('/api/ipro/kiosk/durus-bitir', { tezgahId: tezgah.id })
    setYukleniyor(false)
    if (r.ok) {
      setAktifDurus(null)
      setAdim(aktifIs ? 'calisiyor' : 'is-listesi')
    } else setHata('Duruş bitirilemedi')
  }

  // Operatör değiştir (vardiya/kişi değişimi) → operatör seçim ekranına dön.
  // Cihaz (KIOSK) oturumu KORUNUR. AÇIK İŞ varken engelli (sunucu 409); açık duruş
  // tezgah-seviyesi → engellemez, duruş sürer.
  async function operatorDegistir() {
    if (!tezgah || !operator) return
    setHata(null)
    setYukleniyor(true)
    const r = await apiPost('/api/ipro/kiosk/operator-degistir', { tezgahId: tezgah.id, personnelId: operator.id })
    if (!r.ok) {
      setYukleniyor(false)
      if (r.status === 409) setHata('Açık iş var — önce işi bitirin/durdurun, sonra operatör değiştirin')
      else setHata('Operatör değiştirilemedi')
      return
    }
    const ops = await apiGet<{ operatorler: Operator[] }>(`/api/ipro/kiosk/operatorler?tezgahId=${tezgah.id}`)
    setYukleniyor(false)
    setOperator(null)
    setAktifIs(null)
    if (ops.ok) setOperatorler(ops.data.operatorler)
    setAdim('operator')
  }

  // Operatör çıkışı → oturumu kapat, başa dön
  async function operatorCikis() {
    if (operator && tezgah) {
      const oturum = await apiGet<{ acik: AcikIs }>(
        `/api/ipro/kiosk/acik-is?tezgahId=${tezgah.id}&personnelId=${operator.id}`,
      )
      // ACIK iş varken çıkış: iş DB'de kalır, sonra devam eder (uyarı yok — bilinçli).
      void oturum
    }
    setOperator(null)
    setAktifIs(null)
    adimGec('tezgah')
  }

  // Operatör değiştir: operatör seçiliyken + iş/çalışma/bekleme/duruş ekranlarında sabit görünür.
  const operatorDegistirGoster =
    operator && (adim === 'calisiyor' || adim === 'is-listesi' || adim === 'is-onay' || adim === 'durusta')

  const ustBar = (
    <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-6 py-4">
      <div className="flex items-center gap-3 text-xl text-slate-400">
        {tezgah && <span className="font-bold text-slate-100">{tezgah.kod}</span>}
        {operator && <span className="text-slate-200">· {operator.adSoyad}</span>}
      </div>
      <div className="flex items-center gap-3">
        {operatorDegistirGoster && (
          // Belirgin, sabit buton — ikon + metin, amber vurgu (kolay fark edilir dokunma hedefi).
          <button
            type="button"
            onClick={operatorDegistir}
            className="flex min-h-12 items-center gap-2 rounded-xl bg-amber-500 px-5 text-lg font-bold text-slate-900 active:bg-amber-400"
          >
            <span className="text-2xl leading-none">⇄</span> Operatör Değiştir
          </button>
        )}
        <BigButton variant="ghost" onClick={() => signOut({ redirect: false })} className="min-h-12 text-lg">
          Cihaz Çıkışı
        </BigButton>
      </div>
    </div>
  )

  return (
    <div className="flex h-full flex-col">
      {ustBar}
      {hata && (
        <div className="mx-6 mt-4 rounded-xl bg-red-900/60 px-5 py-4 text-center text-red-200" onClick={geri}>
          <p className="text-2xl">{hata}</p>
          <p className="mt-1 text-base text-red-300/60">kapatmak için dokun</p>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-6">
        {yukleniyor && <Merkez>Yükleniyor…</Merkez>}

        {!yukleniyor && adim === 'tezgah' && (
          <Secim baslik="Tezgah Seç">
            {tezgahlar.map((t) => (
              <SecimKart key={t.id} onClick={() => tezgahSec(t)}>
                <div className="text-3xl font-bold">{t.kod}</div>
                <div className="text-lg text-slate-400">{t.ad}</div>
              </SecimKart>
            ))}
          </Secim>
        )}

        {!yukleniyor && adim === 'operator' && (
          <Secim baslik="Operatör Seç" geriye={() => adimGec('tezgah')}>
            {operatorler.length === 0 && <p className="text-2xl text-slate-500">Bu tezgaha bağlı operatör yok.</p>}
            {operatorler.map((o) => (
              <SecimKart key={o.id} onClick={() => operatorSec(o)}>
                <div className="text-2xl font-bold">{o.adSoyad}</div>
                {o.sicilNo && <div className="text-lg text-slate-400">{o.sicilNo}</div>}
              </SecimKart>
            ))}
          </Secim>
        )}

        {!yukleniyor && adim === 'is-listesi' && (
          <Secim baslik="İş Seç" altBaslik="Tüm açık işler listeleniyor" geriye={operatorCikis}>
            {isler.length === 0 && <p className="text-2xl text-slate-500">Açık iş bulunamadı.</p>}
            {isler.map((is) => (
              <SecimKart key={is.id} onClick={() => { setSecilenIs(is); adimGec('is-onay') }}>
                <div className="text-2xl font-bold">
                  {is.isEmriNo} · Op {is.operasyonNo}
                </div>
                <div className="text-lg text-slate-300">{is.operasyon}</div>
                <div className="text-base text-slate-400">
                  {is.stokKodu} — {is.stokAdi} · kalan {is.kalanMiktar}
                </div>
              </SecimKart>
            ))}
          </Secim>
        )}

        {!yukleniyor && adim === 'is-onay' && secilenIs && (
          <IsOnay is={secilenIs} onBasla={() => isBasla(secilenIs)} onGeri={() => adimGec('is-listesi')} />
        )}

        {!yukleniyor && adim === 'calisiyor' && aktifIs && tezgah && operator && (
          <Calisiyor
            aktifIs={aktifIs}
            tezgahId={tezgah.id}
            personnelId={operator.id}
            operatorAd={operator.adSoyad}
            onBitir={() => adimGec('bitir')}
            onYeniIs={isListesiYukle}
            onDurus={durusAc}
          />
        )}

        {!yukleniyor && adim === 'durus-sebep' && (
          <Secim baslik="Duruş Sebebi" altBaslik="Tezgah neden durdu?" geriye={() => adimGec(aktifIs ? 'calisiyor' : 'is-listesi')}>
            {durusSebepler.length === 0 && <p className="text-2xl text-slate-500">Kullanılabilir duruş sebebi yok.</p>}
            {durusSebepler.map((s) => (
              <SecimKart key={s.id} onClick={() => durusSecti(s)}>
                <div className="flex items-center gap-3">
                  {s.renkKodu && <span className="h-5 w-5 rounded-full" style={{ backgroundColor: s.renkKodu }} />}
                  <span className="text-2xl font-bold">{s.ad}</span>
                </div>
                <div className="text-base text-slate-400">{s.kod}</div>
              </SecimKart>
            ))}
          </Secim>
        )}

        {!yukleniyor && adim === 'durusta' && aktifDurus && (
          <DurusModu durus={aktifDurus} onBitir={durusBitir} />
        )}

        {!yukleniyor && adim === 'bitir' && tezgah && operator && aktifIs && (
          <BitirEkran
            tezgahId={tezgah.id}
            personnelId={operator.id}
            aktifIs={aktifIs}
            onIptal={() => adimGec('calisiyor')}
            onTamam={() => adimGec('ozet')}
            onHata={setHata}
          />
        )}

        {!yukleniyor && adim === 'ozet' && (
          <div className="flex h-full flex-col items-center justify-center gap-8">
            <div className="text-5xl font-bold text-green-400">✓ Kaydedildi</div>
            <div className="flex gap-4">
              <BigButton variant="primary" onClick={isListesiYukle}>
                Yeni İş
              </BigButton>
              <BigButton onClick={operatorCikis}>Operatör Çıkışı</BigButton>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Secim({
  baslik,
  altBaslik,
  geriye,
  children,
}: {
  baslik: string
  altBaslik?: string
  geriye?: () => void
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-5 flex items-center gap-4">
        {geriye && (
          <BigButton variant="ghost" onClick={geriye} className="min-h-12 text-lg">
            ← Geri
          </BigButton>
        )}
        <div>
          <h2 className="text-3xl font-bold text-slate-200">{baslik}</h2>
          {altBaslik && <p className="text-lg text-slate-500">{altBaslik}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">{children}</div>
    </div>
  )
}

function SecimKart({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-24 rounded-xl bg-slate-800 p-5 text-left active:bg-slate-700"
    >
      {children}
    </button>
  )
}

/** İş başlatma ONAY ekranı — yanlış işe dokunup yanlış order'a üretim yazmayı önler. */
function IsOnay({ is, onBasla, onGeri }: { is: Is; onBasla: () => void; onGeri: () => void }) {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col justify-center gap-6">
      <div className="rounded-2xl bg-slate-800 p-8">
        <div className="text-lg uppercase tracking-widest text-slate-400">İş Emri</div>
        <div className="mt-1 text-5xl font-bold text-slate-100">
          {is.isEmriNo} · Op {is.operasyonNo}
        </div>
        <div className="mt-2 text-2xl text-slate-300">{is.operasyon}</div>
        <div className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-xl">
          <span className="text-slate-500">Malzeme</span>
          <span className="font-medium text-slate-100">{is.stokKodu} — {is.stokAdi}</span>
          <span className="text-slate-500">Kalan</span>
          <span className="font-medium text-slate-100">{is.kalanMiktar}</span>
        </div>
      </div>
      <div className="flex gap-4">
        <BigButton variant="ghost" onClick={onGeri} className="min-h-16 text-xl">
          ← Geri
        </BigButton>
        <BigButton variant="primary" onClick={onBasla} className="min-h-20 flex-1 text-3xl">
          İŞE BAŞLA
        </BigButton>
      </div>
    </div>
  )
}

type CalisiyorDetay = {
  baslatildiAt: string | null
  ifsPartNo: string | null
  ifsPartDescription: string | null
  ifsQtyDue: number | null
  ifsDueDate: string | null
  ifsNeedDate: string | null
  ifsMachRunFactor: number | null
  ifsLaborRunFactor: number | null
  ifsRunTimeCode: string | null
}

/** ms → "HH:MM:SS" canlı süre. */
function gecenSure(ms: number): string {
  const sn = Math.max(0, Math.floor(ms / 1000))
  const s = Math.floor(sn / 3600)
  const d = Math.floor((sn % 3600) / 60)
  const k = sn % 60
  return `${String(s).padStart(2, '0')}:${String(d).padStart(2, '0')}:${String(k).padStart(2, '0')}`
}
const trTarih = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('tr-TR') : '—')

function Calisiyor({
  aktifIs,
  tezgahId,
  personnelId,
  operatorAd,
  onBitir,
  onYeniIs,
  onDurus,
}: {
  aktifIs: { ifsOrderNo: string; ifsOperationNo: number; operasyon?: string }
  tezgahId: string
  personnelId: string
  operatorAd: string
  onBitir: () => void
  onYeniIs: () => void
  onDurus: () => void
}) {
  const [detay, setDetay] = useState<CalisiyorDetay | null>(null)
  const [sinyalli, setSinyalli] = useState<boolean | null>(null)
  const [, tik] = useState(0)

  useEffect(() => {
    let iptal = false
    apiGet<{ acik: CalisiyorDetay | null; sinyalli: boolean }>(
      `/api/ipro/kiosk/acik-is?tezgahId=${tezgahId}&personnelId=${personnelId}`,
    ).then((r) => {
      if (iptal || !r.ok) return
      setDetay(r.data.acik)
      setSinyalli(r.data.sinyalli)
    })
    return () => {
      iptal = true
    }
  }, [tezgahId, personnelId])

  // Canlı süre için saniyelik tik.
  useEffect(() => {
    const id = setInterval(() => tik((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const sure = detay?.baslatildiAt ? gecenSure(Date.now() - new Date(detay.baslatildiAt).getTime()) : '—'
  const cevrim =
    detay?.ifsMachRunFactor != null && detay.ifsMachRunFactor > 0
      ? `${detay.ifsMachRunFactor} ${detay.ifsRunTimeCode ?? ''}`.trim()
      : '—'

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-4 py-2">
      {/* Başlık */}
      <div className="text-center">
        <div className="text-base uppercase tracking-widest text-emerald-400">● ÇALIŞIYOR</div>
        <div className="mt-1 text-5xl font-bold text-slate-100">
          {aktifIs.ifsOrderNo} · Op {aktifIs.ifsOperationNo}
        </div>
        {aktifIs.operasyon && <div className="mt-1 text-xl text-slate-300">{aktifIs.operasyon}</div>}
        <div className="mt-2 text-2xl font-semibold text-slate-100">👤 {operatorAd}</div>
      </div>

      {/* Eldeki veriler */}
      <div className="grid grid-cols-2 gap-3">
        <Bilgi etiket="Malzeme" deger={detay?.ifsPartDescription ?? detay?.ifsPartNo ?? '—'} alt={detay?.ifsPartNo ?? undefined} />
        <Bilgi etiket="PLC" deger={sinyalli == null ? '—' : sinyalli ? '📶 Sinyalli' : 'Sinyalsiz'} />
        <Bilgi etiket="Planlanan adet" deger={detay?.ifsQtyDue != null ? String(detay.ifsQtyDue) : '—'} />
        <Bilgi etiket="Geçen süre" deger={sure} vurgu />
        <Bilgi etiket="Teslim tarihi" deger={trTarih(detay?.ifsDueDate ?? null)} />
        <Bilgi etiket="İhtiyaç tarihi" deger={trTarih(detay?.ifsNeedDate ?? null)} />
        <Bilgi etiket="Planlı çevrim" deger={cevrim} />
        <Bilgi etiket="Başlangıç" deger={detay?.baslatildiAt ? new Date(detay.baslatildiAt).toLocaleTimeString('tr-TR') : '—'} />
      </div>

      {/* Verisi olmayan (PLC sayacı → poller) — yerleşim hazır, değer "—" */}
      <div className="rounded-xl border border-dashed border-slate-700 p-3">
        <div className="mb-2 text-xs uppercase tracking-wider text-slate-500">
          PLC sayacı (poller gelince dolar; sinyalsizde bitir anında girilir)
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <Placeholder etiket="Baskı sayısı" />
          <Placeholder etiket="Gerçekleşen adet" />
          <Placeholder etiket="Adet/ort. süre" />
          <Placeholder etiket="Ort. çevrim" />
        </div>
      </div>

      {/* Aksiyonlar */}
      <div className="mt-auto flex flex-col gap-3">
        <div className="flex flex-wrap justify-center gap-4">
          <BigButton variant="primary" onClick={onBitir} className="px-12">
            BİTİR / DURDUR
          </BigButton>
          <BigButton variant="danger" onClick={onDurus} className="px-12">
            ⏸ DURUŞ BAŞLAT
          </BigButton>
        </div>
        <BigButton variant="ghost" onClick={onYeniIs} className="mx-auto min-h-12 text-lg">
          Başka işe geç (aynı operatör)
        </BigButton>
      </div>
    </div>
  )
}

function Bilgi({ etiket, deger, alt, vurgu }: { etiket: string; deger: string; alt?: string; vurgu?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-800 px-4 py-3">
      <div className="text-sm text-slate-400">{etiket}</div>
      <div className={`mt-0.5 truncate font-semibold ${vurgu ? 'text-2xl text-emerald-300' : 'text-xl text-slate-100'}`} title={alt}>
        {deger}
      </div>
      {alt && deger !== alt && <div className="truncate text-xs text-slate-500">{alt}</div>}
    </div>
  )
}

function Placeholder({ etiket }: { etiket: string }) {
  return (
    <div>
      <div className="text-2xl font-bold text-slate-600">—</div>
      <div className="text-xs text-slate-500">{etiket}</div>
    </div>
  )
}

/** Kırmızı tam-ekran duruş modu — büyük sebep + canlı süre sayacı + "Duruş Bitir". */
function DurusModu({ durus, onBitir }: { durus: AktifDurus; onBitir: () => void }) {
  const [, tik] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tik((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const gecen = Date.now() - new Date(durus.baslangic).getTime()
  const sn = Math.max(0, Math.floor(gecen / 1000))
  const saat = String(Math.floor(sn / 3600)).padStart(2, '0')
  const dk = String(Math.floor((sn % 3600) / 60)).padStart(2, '0')
  const sns = String(sn % 60).padStart(2, '0')

  return (
    <div className="-m-6 flex h-full flex-col items-center justify-center gap-10 bg-red-950 p-6">
      <div className="text-center">
        <div className="text-2xl font-bold uppercase tracking-widest text-red-300">DURUŞTA</div>
        <div className="mt-3 text-6xl font-bold text-red-100">{durus.sebepAd}</div>
      </div>
      <div className="font-mono text-8xl font-bold tabular-nums text-red-50">
        {saat}:{dk}:{sns}
      </div>
      {durus.durusAktifkenIsBitirilemez && (
        <div className="text-xl text-red-300/80">Bu duruş bitmeden iş bitirilemez.</div>
      )}
      <BigButton variant="default" onClick={onBitir} className="min-h-24 bg-red-100 px-16 text-3xl text-red-900 active:bg-white">
        ▶ DURUŞ BİTİR
      </BigButton>
    </div>
  )
}

function BitirEkran({
  tezgahId,
  personnelId,
  aktifIs,
  onIptal,
  onTamam,
  onHata,
}: {
  tezgahId: string
  personnelId: string
  aktifIs: { ifsOrderNo: string; ifsOperationNo: number }
  onIptal: () => void
  onTamam: () => void
  onHata: (h: string | null) => void
}) {
  const [iyi, setIyi] = useState('0')
  const [hurda, setHurda] = useState('0')
  const [aktif, setAktif] = useState<'iyi' | 'hurda'>('iyi')
  const [sebepler, setSebepler] = useState<Sebep[]>([])
  const [sebep, setSebep] = useState<string | null>(null)
  const [sebepSecimi, setSebepSecimi] = useState(false)
  const [bekliyor, setBekliyor] = useState(false)

  const hurdaVar = Number(hurda) > 0

  async function gonder(tamamlandi: boolean) {
    if (hurdaVar && !sebep) {
      setSebepSecimi(true)
      if (sebepler.length === 0) {
        const r = await apiGet<{ sebepler: Sebep[] }>('/api/ipro/kiosk/hurda-sebepleri')
        if (r.ok) setSebepler(r.data.sebepler)
      }
      return
    }
    setBekliyor(true)
    onHata(null)
    const r = await apiPost('/api/ipro/kiosk/is-bitir', {
      tezgahId,
      personnelId,
      ifsOrderNo: aktifIs.ifsOrderNo,
      ifsOperationNo: aktifIs.ifsOperationNo,
      iyi: Number(iyi),
      hurda: Number(hurda),
      tamamlandi,
      hurdaSebebiKod: hurdaVar ? sebep : null,
    })
    setBekliyor(false)
    if (r.ok) onTamam()
    else onHata('Kaydedilemedi, tekrar deneyin')
  }

  if (sebepSecimi) {
    return (
      <div>
        <div className="mb-5 flex items-center gap-4">
          <BigButton variant="ghost" onClick={() => setSebepSecimi(false)} className="min-h-12 text-lg">
            ← Geri
          </BigButton>
          <h2 className="text-3xl font-bold text-slate-200">Hurda Sebebi ({hurda})</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {sebepler.map((s) => (
            <button
              key={s.kod}
              type="button"
              onClick={() => {
                setSebep(s.kod)
                setSebepSecimi(false)
              }}
              className={`min-h-20 rounded-xl p-4 text-left text-xl font-semibold active:bg-slate-700 ${
                sebep === s.kod ? 'bg-[#1B4F72] text-white' : 'bg-slate-800 text-slate-100'
              }`}
            >
              <span className="text-slate-400">{s.kod}</span> {s.ad}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h2 className="text-center text-3xl font-bold text-slate-200">
        {aktifIs.ifsOrderNo} · Op {aktifIs.ifsOperationNo}
      </h2>
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setAktif('iyi')}
          className={`rounded-xl p-5 text-center ${aktif === 'iyi' ? 'ring-4 ring-[#1B4F72]' : ''} bg-slate-800`}
        >
          <div className="text-lg text-slate-400">İYİ</div>
          <div className="text-5xl font-bold text-green-400">{iyi}</div>
        </button>
        <button
          type="button"
          onClick={() => setAktif('hurda')}
          className={`rounded-xl p-5 text-center ${aktif === 'hurda' ? 'ring-4 ring-[#1B4F72]' : ''} bg-slate-800`}
        >
          <div className="text-lg text-slate-400">HURDA</div>
          <div className="text-5xl font-bold text-red-400">{hurda}</div>
        </button>
      </div>

      <Numpad value={aktif === 'iyi' ? iyi : hurda} onChange={aktif === 'iyi' ? setIyi : setHurda} />

      {sebep && <p className="text-center text-xl text-slate-400">Hurda sebebi: {sebep}</p>}

      <div className="grid grid-cols-3 gap-3">
        <BigButton variant="ghost" onClick={onIptal} disabled={bekliyor}>
          İptal
        </BigButton>
        <BigButton variant="default" onClick={() => gonder(false)} disabled={bekliyor}>
          DURDUR
        </BigButton>
        <BigButton variant="primary" onClick={() => gonder(true)} disabled={bekliyor}>
          BİTİR
        </BigButton>
      </div>
    </div>
  )
}

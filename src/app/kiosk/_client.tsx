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
type Adim = 'tezgah' | 'operator' | 'is-listesi' | 'calisiyor' | 'bitir' | 'ozet'

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
  const [aktifIs, setAktifIs] = useState<{ ifsOrderNo: string; ifsOperationNo: number; operasyon?: string } | null>(null)
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

  const ustBar = (
    <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
      <div className="text-xl text-slate-400">
        {tezgah && <span className="font-bold text-slate-100">{tezgah.kod}</span>}
        {operator && <span className="ml-3">· {operator.adSoyad}</span>}
      </div>
      <BigButton variant="ghost" onClick={() => signOut({ redirect: false })} className="min-h-12 text-lg">
        Cihaz Çıkışı
      </BigButton>
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
              <SecimKart key={is.id} onClick={() => isBasla(is)}>
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

        {!yukleniyor && adim === 'calisiyor' && aktifIs && (
          <Calisiyor
            aktifIs={aktifIs}
            onBitir={() => adimGec('bitir')}
            onYeniIs={isListesiYukle}
          />
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

function Calisiyor({
  aktifIs,
  onBitir,
  onYeniIs,
}: {
  aktifIs: { ifsOrderNo: string; ifsOperationNo: number; operasyon?: string }
  onBitir: () => void
  onYeniIs: () => void
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8">
      <div className="text-center">
        <div className="text-lg text-slate-400">ÇALIŞIYOR</div>
        <div className="mt-2 text-5xl font-bold text-slate-100">
          {aktifIs.ifsOrderNo} · Op {aktifIs.ifsOperationNo}
        </div>
        {aktifIs.operasyon && <div className="mt-2 text-2xl text-slate-300">{aktifIs.operasyon}</div>}
      </div>
      <div className="flex gap-4">
        <BigButton variant="primary" onClick={onBitir} className="px-12">
          BİTİR / DURDUR
        </BigButton>
      </div>
      <BigButton variant="ghost" onClick={onYeniIs} className="min-h-12 text-lg">
        Başka işe geç
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

'use client'

/**
 * EtiketView — Dark theme, sequential alt koli colors.
 *
 * Tasarım onayı (29 Nis 2026 mockup):
 * - Background: slate-900 dark navy, all text white/slate-300
 * - Ana etiket (A5 148×210mm):
 *   - Top: alt koli sayısı kadar sequential renkli stripe (A=Mavi, B=Yeşil, C=Amber, D=Mor, E=Gri…)
 *   - Header: dark, brand + "ANA ARŞİV KOLİSİ" sol, big arşiv no sağ
 *   - İçerik tablosu: her alt satırı kendi sequential renginde harf rozeti
 *   - Footer: QR + url + firma
 * - Alt etiket (A6 105×148mm):
 *   - Header: full alt'ın sequential rengi
 *   - Bolum.ad header'da
 *   - Evrak türü, dönem, gizlilik, saklama, imha, hazırlayan
 *   - Footer: küçük QR + url
 *
 * Print: print-color-adjust:exact tüm zeminleri zorla bastırır.
 */

import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { getEtiketRenk, gizlilikLabel } from '@/lib/arsiv-etiket-renk'
import './etiket.css'

type AltKoli = {
  id: string
  altArsivNo: string
  harf: string
  evrakTuru: { ad: string } | null
  evrakSayisi: number | null
  hazirlayan: string | null
  gizlilikSeviyesi: 'KamuyaAcik' | 'SirketIci' | 'Gizli' | 'CokGizli'
  saklamaSuresiYil: number
  imhaTarihi: string | null
  donemBaslangic: string | null
  donemSonu: string | null
}

type Lokasyon = {
  depoNo: string
  rafKodu: string
  siraNo: number
}

type Koli = {
  id: string
  arsivNo: string
  bolum: { kod: string; ad: string }
  lokasyon: Lokasyon | null
  tarihAraligiBaslangic: string
  tarihAraligiSonu: string
  imhaTarihi: string
  arsivlemeTarihi: string
  sorumlu: { name: string | null } | null
  altKoliler: AltKoli[]
}

type Props = {
  koli: Koli
  anaQrDataUrl: string
  altQrDataUrls: Record<string, string>
}

const fmt = (d: string | null | undefined): string => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('tr-TR')
}

const fmtYil = (d: string | null | undefined): string => {
  if (!d) return '—'
  return new Date(d).getFullYear().toString()
}

const lokasyonStr = (l: Lokasyon | null): string => {
  if (!l) return '—'
  return `Depo ${l.depoNo} · Raf ${l.rafKodu} · Sıra ${l.siraNo}`
}

const lastNumber = (arsivNo: string): string => {
  const parts = arsivNo.split('-')
  return parts[parts.length - 1] || '—'
}

export function EtiketView({ koli, anaQrDataUrl, altQrDataUrls }: Props) {
  const baseUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://hub.ilerigroup.com'
  const anaUrl = `${baseUrl}/arsiv/koli/${koli.arsivNo}`

  // Tek bölüm rengi tüm etiketler için (ana + alt).
  const renk = getEtiketRenk(koli.bolum.kod)

  async function handlePrint() {
    try {
      await fetch(`/api/arsiv/koli/${koli.arsivNo}/etiket-log`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch {}
    window.print()
  }

  // Alt kolileri 4'erli sayfalara böl (A4 başına 2×2 grid)
  const altSayfalar: AltKoli[][] = []
  for (let i = 0; i < koli.altKoliler.length; i += 4) {
    altSayfalar.push(koli.altKoliler.slice(i, i + 4))
  }

  return (
    <div className="etiket-root">
      {/* Toolbar — print'te gizli */}
      <div className="etiket-toolbar print:hidden">
        <Link
          href={`/arsiv/koli/${koli.arsivNo}`}
          className="etiket-back"
        >
          <ArrowLeft size={16} />
          <span>Detaya Dön</span>
        </Link>
        <button
          type="button"
          onClick={handlePrint}
          className="etiket-print-btn"
        >
          <Printer size={16} />
          <span>Yazdır</span>
        </button>
      </div>

      {/* SAYFA 1: Ana koli etiketi (A5 ortalı) */}
      <section className="page page-ana">
        <article className="etiket-ana">
          {/* Top color band — tek bölüm rengi */}
          <div className="ea-stripes" style={{ background: renk.hex }} />

          <div className="ea-header">
            <div className="ea-header-left">
              <div className="ea-brand">İLERİ GROUP · ANA ARŞİV KOLİSİ</div>
              <div className="ea-tip">{koli.bolum.ad}</div>
            </div>
            <div className="ea-no-buyuk">{lastNumber(koli.arsivNo)}</div>
          </div>

          <div className="ea-uyt-meta">
            <div className="ea-meta-block">
              <div className="ea-meta-lbl">ARŞİV NO</div>
              <div className="ea-meta-val ea-mono">{koli.arsivNo}</div>
            </div>
            <div className="ea-meta-block">
              <div className="ea-meta-lbl">LOKASYON</div>
              <div className="ea-meta-val">{lokasyonStr(koli.lokasyon)}</div>
            </div>
          </div>

          <div className="ea-icerik">
            <div className="ea-icerik-baslik">
              İÇERİK — {koli.altKoliler.length} ALT KOLİ
            </div>
            <div className="ea-icerik-liste">
              {koli.altKoliler.map((alt) => {
                return (
                  <div key={alt.id} className="ea-icerik-row">
                    <div
                      className="ea-icerik-harf"
                      style={{ background: renk.hex, color: renk.textHex }}
                    >
                      {alt.harf}
                    </div>
                    <div className="ea-icerik-ad">
                      {alt.evrakTuru?.ad ?? '—'}
                    </div>
                    <div className="ea-icerik-donem">
                      {alt.donemBaslangic && alt.donemSonu
                        ? `${fmtYil(alt.donemBaslangic)}–${fmtYil(alt.donemSonu)}`
                        : '—'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="ea-alt-meta">
            <div className="ea-meta-block">
              <div className="ea-meta-lbl">TARİH ARALIĞI</div>
              <div className="ea-meta-val">
                {fmtYil(koli.tarihAraligiBaslangic)} —{' '}
                {fmtYil(koli.tarihAraligiSonu)}
              </div>
            </div>
            <div className="ea-meta-block">
              <div className="ea-meta-lbl">ARŞİVLEME TARİHİ</div>
              <div className="ea-meta-val">{fmt(koli.arsivlemeTarihi)}</div>
            </div>
            <div className="ea-meta-block">
              <div className="ea-meta-lbl">İMHA TARİHİ</div>
              <div className="ea-meta-val ea-imha">{fmt(koli.imhaTarihi)}</div>
            </div>
            <div className="ea-meta-block">
              <div className="ea-meta-lbl">SORUMLU</div>
              <div className="ea-meta-val">{koli.sorumlu?.name ?? '—'}</div>
            </div>
          </div>

          <div className="ea-footer">
            <div className="ea-qr-block">
              <div className="ea-qr-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={anaQrDataUrl}
                  alt={`QR: ${koli.arsivNo}`}
                  width={88}
                  height={88}
                  style={{ display: 'block' }}
                />
              </div>
              <div className="ea-qr-text">
                <div className="ea-qr-baslik">QR ile arşiv kayıt sistemine ulaşın</div>
                <div className="ea-qr-url">
                  {anaUrl.replace('https://', '')}
                </div>
              </div>
            </div>
            <div className="ea-firma">İLERİ MEKANİK A.Ş — İLERİ ASANSÖR A.Ş</div>
          </div>
        </article>
      </section>

      {/* SAYFA 2+: Alt koli etiketleri (A4'e 2×2 grid 4 A6) */}
      {altSayfalar.map((sayfaAltlari, sayfaIdx) => (
        <section key={sayfaIdx} className="page page-alt">
          <div className="alt-grid">
            {sayfaAltlari.map((alt) => {
              return (
                <article
                  key={alt.id}
                  className="etiket-alt"
                  style={
                    {
                      '--alt-renk': renk.hex,
                      '--alt-text': renk.textHex,
                    } as React.CSSProperties
                  }
                >
                  <div className="ealt-header">
                    <div className="ealt-brand">İLERİ GROUP · ALT KOLİ</div>
                    <div className="ealt-bolum">{koli.bolum.ad}</div>
                  </div>

                  <div className="ealt-row-2">
                    <div className="ealt-meta-block">
                      <div className="ealt-meta-lbl">ALT ARŞİV NO</div>
                      <div className="ealt-meta-val ealt-mono">
                        {alt.altArsivNo}
                      </div>
                    </div>
                    <div className="ealt-meta-block ealt-text-right">
                      <div className="ealt-meta-lbl">BAĞLI ANA KOLİ</div>
                      <div className="ealt-meta-val ealt-mono">
                        {koli.arsivNo}
                      </div>
                    </div>
                  </div>

                  <div className="ealt-meta-block ealt-evrak">
                    <div className="ealt-meta-lbl">EVRAK TÜRÜ</div>
                    <div className="ealt-meta-val ealt-bold">
                      {alt.evrakTuru?.ad ?? '—'}
                    </div>
                  </div>

                  <div className="ealt-grid-2">
                    <div className="ealt-meta-block">
                      <div className="ealt-meta-lbl">DÖNEM</div>
                      <div className="ealt-meta-val">
                        {alt.donemBaslangic && alt.donemSonu
                          ? `${fmtYil(alt.donemBaslangic)}–${fmtYil(alt.donemSonu)}`
                          : '—'}
                      </div>
                    </div>
                    <div className="ealt-meta-block">
                      <div className="ealt-meta-lbl">EVRAK SAYISI</div>
                      <div className="ealt-meta-val">
                        {alt.evrakSayisi ? `~${alt.evrakSayisi} dosya` : '—'}
                      </div>
                    </div>
                    <div className="ealt-meta-block">
                      <div className="ealt-meta-lbl">GİZLİLİK</div>
                      <div className="ealt-meta-val">
                        {gizlilikLabel(alt.gizlilikSeviyesi)}
                      </div>
                    </div>
                    <div className="ealt-meta-block">
                      <div className="ealt-meta-lbl">SAKLAMA SÜRESİ</div>
                      <div className="ealt-meta-val ealt-bold">
                        {alt.saklamaSuresiYil} yıl
                      </div>
                    </div>
                  </div>

                  <div className="ealt-grid-2 ealt-bottom-meta">
                    <div className="ealt-meta-block">
                      <div className="ealt-meta-lbl">İMHA TARİHİ</div>
                      <div className="ealt-meta-val ealt-imha">
                        {fmt(alt.imhaTarihi)}
                      </div>
                    </div>
                    <div className="ealt-meta-block">
                      <div className="ealt-meta-lbl">HAZIRLAYAN</div>
                      <div className="ealt-meta-val ealt-hazirlayan">
                        {alt.hazirlayan || '— — — — — —'}
                      </div>
                    </div>
                  </div>

                  <div className="ealt-footer">
                    <div className="ealt-qr-frame">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={altQrDataUrls[alt.id] ?? ''}
                        alt={`QR: ${alt.altArsivNo}`}
                        width={56}
                        height={56}
                        style={{ display: 'block' }}
                      />
                    </div>
                    <div className="ealt-qr-text">
                      <div className="ealt-qr-url-1">arsiv.ilerigroup.com/</div>
                      <div className="ealt-qr-url-2">
                        {koli.arsivNo}-{alt.harf}
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ))}

    </div>
  )
}

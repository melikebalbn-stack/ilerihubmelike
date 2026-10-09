"use client"

// IV-FR-03 Tutanak listesi — İKİ KİTLE, TEK SAYFA (09.10.2026, Melih):
//
//   İV / platform  → kayıt konsolu: tüm kolonlar, sıralama, bölüm süzgeci, Excel.
//   müdür vb.      → Formlar'daki diğer sayfalarla AYNI ağırlıkta liste: yalnız
//                    kendi kayıtları, 7 kolon, süzgeç yok, Excel yok.
//
// Gerekçe: Formlar > İnsan Varlıkları altından giren müdürün karşısına 12
// kolonlu, bölüm süzgeçli bir İV konsolu çıkıyordu; referans sayfa (Bölüm
// Değişikliği Talebi) o kitleye sade bir "kendi kayıtlarım" listesi gösteriyor.
// GÖRÜNÜRLÜK DEĞİŞMEDİ — hangi kaydın geldiğini sunucu (tutanakListeWhere)
// belirler; burada yalnız KOLON ve SÜZGEÇ farkı var.
//
// İskelet FORM-SAYFA-STANDARDI.md'den: space-y-6 kabuk, text-xl font-semibold
// başlık + lucide ikon, SplitBadge aksiyon, tek içerik kartı, text-xs tablo.

import { useEffect, useMemo, useState } from "react"
import { FileWarning, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { SplitBadge } from "@/components/akademi/SplitBadge"
import { EnvanterArama } from "@/components/envanter/EnvanterArama"
import { TutanakDurumRozet } from "@/components/tutanak/durum-rozet"
import { cn } from "@/lib/utils"
import { DURUM_ETIKETLERI, SEBEP_ETIKETLERI } from "@/lib/tutanak/tutanak-durum"
import {
  sonrakiSiralama,
  tutanakSirala,
  tutanakSuz,
  type TutanakSatiri,
  type TutanakSiralama,
  type TutanakSiralamaAlani,
} from "@/lib/tutanak/tutanak-liste"

const BASLIKLAR: { alan: TutanakSiralamaAlani; etiket: string; sagaYatik?: boolean }[] = [
  { alan: "tutanakNo", etiket: "Tutanak No" },
  { alan: "tutanakTarihi", etiket: "Tarih" },
  { alan: "adSoyadSnapshot", etiket: "Personel" },
  { alan: "sicilSnapshot", etiket: "Sicil" },
  { alan: "bolumSnapshot", etiket: "Bölüm" },
  { alan: "gorevSnapshot", etiket: "Görev" },
  { alan: "sebep", etiket: "Sebep" },
  { alan: "durum", etiket: "Durum" },
  { alan: "sahitSayisi", etiket: "Şahit", sagaYatik: true },
  { alan: "yoneticiAd", etiket: "Yönetici" },
  { alan: "acanAd", etiket: "Tutan" },
]

function tarihTR(d: string | Date): string {
  const t = new Date(d)
  return Number.isNaN(t.getTime()) ? "—" : t.toLocaleDateString("tr-TR")
}

export default function TutanakListePage() {
  const [satirlar, setSatirlar] = useState<TutanakSatiri[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [acabilir, setAcabilir] = useState(false)
  const [iv, setIv] = useState(false)
  const [arama, setArama] = useState("")
  const [sebep, setSebep] = useState<string>("HEPSI")
  const [durum, setDurum] = useState<string>("HEPSI")
  const [bolum, setBolum] = useState<string>("HEPSI")
  const [siralama, setSiralama] = useState<TutanakSiralama>(null)

  useEffect(() => {
    let iptal = false
    ;(async () => {
      try {
        const res = await fetch("/api/tutanak")
        if (!res.ok) {
          const h = await res.json().catch(() => null)
          if (!iptal) toast.error(h?.error || "Tutanaklar yüklenemedi")
          return
        }
        const d = await res.json()
        if (iptal) return
        setSatirlar(d.satirlar ?? [])
        setAcabilir(d.acabilir === true)
        setIv(d.iv === true)
      } catch {
        if (!iptal) toast.error("Tutanaklar yüklenemedi — bağlantı hatası")
      } finally {
        if (!iptal) setYukleniyor(false)
      }
    })()
    return () => {
      iptal = true
    }
  }, [])

  const bolumler = useMemo(
    () => [...new Set(satirlar.map((s) => s.bolumSnapshot))].sort((a, b) => a.localeCompare(b, "tr")),
    [satirlar],
  )
  // Müdür görünümünde süzgeç yok: ham liste zaten kendi kayıtları.
  const suzulmus = useMemo(
    () =>
      iv
        ? tutanakSuz(satirlar, { arama, sebep: sebep as never, durum: durum as never, bolum: bolum as never })
        : satirlar,
    [iv, satirlar, arama, sebep, durum, bolum],
  )
  const gosterilen = useMemo(() => (iv ? tutanakSirala(suzulmus, siralama) : suzulmus), [iv, suzulmus, siralama])
  const sutunSayisi = iv ? BASLIKLAR.length + 1 : 8

  function Baslik({ alan, etiket, sagaYatik }: { alan: TutanakSiralamaAlani; etiket: string; sagaYatik?: boolean }) {
    const aktif = siralama?.alan === alan
    return (
      <th className={sagaYatik ? "text-center" : "text-left"}>
        <button
          type="button"
          onClick={() => setSiralama((m) => sonrakiSiralama(m, alan))}
          className={cn("inline-flex items-center gap-1", aktif ? "font-semibold text-slate-900" : "text-slate-600")}
          title="Sıralamak için tıklayın (artan → azalan → kapalı)"
        >
          {etiket}
          <span aria-hidden className="text-[10px]">
            {aktif ? (siralama!.yon === "asc" ? "▲" : "▼") : "↕"}
          </span>
        </button>
      </th>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <FileWarning className="h-5 w-5" /> Tutanak Formu
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {iv
              ? "IV-FR-03 · şahit onayı → yönetici onayı → İnsan Varlıkları kapanışı · Hakkında tutanak tutulan personel kendi kaydını görmez."
              : "Ekibiniz için tutanak tutun. Şahit ve yönetici onayından sonra İnsan Varlıkları kapatır · Yalnız açtığınız ya da adınızın geçtiği tutanaklar listelenir."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {iv && (
            <SplitBadge
              color="gray"
              left="Liste"
              right="Excel'e Aktar"
              onClick={() => window.open("/api/tutanak/export", "_blank")}
              disabled={satirlar.length === 0}
            />
          )}
          {acabilir && <SplitBadge color="green" left="Tutanak" right="Yeni Tutanak" href="/tutanak/yeni" />}
        </div>
      </div>

      {/* Süzgeçler — YALNIZ İV konsolunda. Ayrı kart değil (FORM-SAYFA-STANDARDI):
          başlık bloğunun altında düz satır. */}
      {iv && (
        <div className="flex flex-wrap items-center gap-3">
          <EnvanterArama
            value={arama}
            onChange={setArama}
            placeholder="Tutanak no, personel, sicil veya bölüm ara..."
            className="max-w-md flex-1"
          />
          <select
            value={sebep}
            onChange={(e) => setSebep(e.target.value)}
            className="h-10 rounded-xl border px-3 text-sm"
          >
            <option value="HEPSI">Sebep (hepsi)</option>
            {Object.entries(SEBEP_ETIKETLERI).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            value={durum}
            onChange={(e) => setDurum(e.target.value)}
            className="h-10 rounded-xl border px-3 text-sm"
          >
            <option value="HEPSI">Durum (hepsi)</option>
            <option value="ACIK">Yalnız açık olanlar</option>
            {Object.entries(DURUM_ETIKETLERI).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            value={bolum}
            onChange={(e) => setBolum(e.target.value)}
            className="h-10 rounded-xl border px-3 text-sm"
          >
            <option value="HEPSI">Bölüm (hepsi)</option>
            {bolumler.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
          {iv ? "Tutanaklar" : "Tutanaklarım"} ({gosterilen.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left font-semibold uppercase tracking-wide text-slate-500">
              <tr className="[&>th]:whitespace-nowrap [&>th]:px-3 [&>th]:py-2.5">
                {iv ? (
                  BASLIKLAR.map((b) => <Baslik key={b.alan} alan={b.alan} etiket={b.etiket} sagaYatik={b.sagaYatik} />)
                ) : (
                  <>
                    <th>Tutanak No</th>
                    <th>Tarih</th>
                    <th>Personel</th>
                    <th>Sebep</th>
                    <th>Durum</th>
                    <th className="text-center">Şahit</th>
                    <th>Yönetici</th>
                  </>
                )}
                <th className="text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {yukleniyor && (
                <tr>
                  <td colSpan={sutunSayisi} className="p-8 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              )}
              {!yukleniyor && gosterilen.length === 0 && (
                <tr>
                  <td colSpan={sutunSayisi} className="p-8 text-center text-muted-foreground">
                    {satirlar.length === 0
                      ? iv
                        ? "Bu kapsamda tutanak yok."
                        : "Henüz tutanak tutmadınız."
                      : "Süzgeçlere uyan tutanak yok."}
                  </td>
                </tr>
              )}
              {!yukleniyor &&
                gosterilen.map((r) => (
                  <tr key={r.id} className="[&>td]:px-3 [&>td]:py-2.5 hover:bg-slate-50">
                    <td className="font-medium text-slate-700">{r.tutanakNo}</td>
                    <td className="whitespace-nowrap tabular-nums">{tarihTR(r.tutanakTarihi)}</td>
                    {iv ? (
                      <>
                        <td className="font-medium">{r.adSoyadSnapshot}</td>
                        <td className="tabular-nums">{r.sicilSnapshot ?? "—"}</td>
                        <td>{r.bolumSnapshot}</td>
                        <td className="max-w-[200px] truncate" title={r.gorevSnapshot ?? ""}>
                          {r.gorevSnapshot ?? "—"}
                        </td>
                      </>
                    ) : (
                      // Ad + sicil tek hücrede — standardın "iki satırlı hücre" deseni.
                      <td>
                        <div className="font-medium">{r.adSoyadSnapshot}</div>
                        <div className="text-xs text-muted-foreground">{r.sicilSnapshot ?? "—"}</div>
                      </td>
                    )}
                    <td className="whitespace-nowrap">{SEBEP_ETIKETLERI[r.sebep]}</td>
                    <td>
                      <TutanakDurumRozet durum={r.durum} />
                    </td>
                    <td className="text-center tabular-nums">
                      {r.onaylayanSahitSayisi}/{r.sahitSayisi}
                    </td>
                    <td className="whitespace-nowrap">{r.yoneticiAd ?? "—"}</td>
                    {iv && <td className="whitespace-nowrap text-muted-foreground">{r.acanAd ?? "—"}</td>}
                    <td className="text-right">
                      <SplitBadge color="blue" left="Tutanak" right="Aç" href={`/tutanak/${r.id}`} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {iv && !yukleniyor && satirlar.length > 0 && gosterilen.length !== satirlar.length && (
        <p className="text-xs text-muted-foreground">
          Süzgeçler {satirlar.length} kaydın {gosterilen.length} tanesini gösteriyor.
        </p>
      )}
    </div>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { FileWarning } from "lucide-react"
import { toast } from "sonner"
import { SplitBadge } from "@/components/akademi/SplitBadge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  DURUM_ETIKETLERI,
  DURUM_RENK,
  SAHIT_DURUM_ETIKETLERI,
  SAHIT_DURUM_RENK,
  SEBEP_ETIKETLERI,
  type AdimSahibi,
} from "@/lib/tutanak/tutanak-durum"

const ADIM_ETIKETLERI: Record<string, string> = {
  OLUSTURULDU: "Tutanak oluşturuldu",
  GONDERILDI: "Şahit onayına gönderildi",
  SAHIT_ONAYLADI: "Şahit onayladı",
  SAHIT_REDDETTI: "Şahit reddetti",
  YONETICI_ONAYLADI: "Yönetici onayladı",
  YONETICI_REDDETTI: "Yönetici reddetti",
  SON_YONETICI_BILGILENDIRILDI: "Son yönetici bilgilendirildi",
  IV_KAPATTI: "İnsan Varlıkları kapattı",
}

type Detay = {
  tutanak: Record<string, any>
  onaylayabilir: boolean
  adimSahibi: AdimSahibi
  iv: boolean
}

function Pill({ renk, children }: { renk: string; children: React.ReactNode }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${renk}`}>{children}</span>
  )
}

function tarihTR(d: string | null | undefined): string {
  if (!d) return "—"
  const t = new Date(d)
  return Number.isNaN(t.getTime()) ? "—" : t.toLocaleDateString("tr-TR")
}
function anTR(d: string | null | undefined): string {
  if (!d) return ""
  const t = new Date(d)
  return Number.isNaN(t.getTime()) ? "" : t.toLocaleString("tr-TR")
}

export default function TutanakDetayPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [d, setD] = useState<Detay | null>(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [not, setNot] = useState("")
  const [islemde, setIslemde] = useState(false)

  const yukle = useCallback(async () => {
    try {
      const res = await fetch(`/api/tutanak/${id}`)
      if (!res.ok) {
        const h = await res.json().catch(() => null)
        toast.error(h?.error || "Tutanak bulunamadı")
        router.push("/tutanak")
        return
      }
      setD(await res.json())
    } catch {
      toast.error("Tutanak yüklenemedi — bağlantı hatası")
    } finally {
      setYukleniyor(false)
    }
  }, [id, router])

  useEffect(() => {
    yukle()
  }, [yukle])

  async function islem(aksiyon: string) {
    setIslemde(true)
    try {
      const res = await fetch(`/api/tutanak/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksiyon, not: not.trim() || null }),
      })
      const h = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(h?.error || "İşlem tamamlanamadı")
        return
      }
      toast.success(`Tutanak durumu: ${DURUM_ETIKETLERI[h.durum as keyof typeof DURUM_ETIKETLERI] ?? h.durum}`)
      setNot("")
      await yukle()
    } catch {
      toast.error("İşlem tamamlanamadı — bağlantı hatası")
    } finally {
      setIslemde(false)
    }
  }

  if (yukleniyor) return <p className="px-6 py-8 text-sm text-slate-400">Yükleniyor…</p>
  if (!d) return null

  const t = d.tutanak
  const sahip = d.adimSahibi

  // Onay kutusundaki aksiyonlar adım türüne göre; yetki SUNUCUDA zorlanır.
  const aksiyonlar: { kod: string; etiket: string; tur: "onay" | "ret"; retNotuZorunlu: boolean }[] =
    sahip.tur === "ACAN"
      ? [{ kod: "gonder", etiket: "Şahit Onayına Gönder", tur: "onay", retNotuZorunlu: false }]
      : sahip.tur === "SAHIT"
        ? [
            { kod: "sahit-onay", etiket: "Şahit Olarak Onayla", tur: "onay", retNotuZorunlu: false },
            { kod: "sahit-ret", etiket: "Reddet", tur: "ret", retNotuZorunlu: true },
          ]
        : sahip.tur === "YONETICI"
          ? [
              { kod: "yonetici-onay", etiket: "Yönetici Olarak Onayla", tur: "onay", retNotuZorunlu: false },
              { kod: "yonetici-ret", etiket: "Reddet", tur: "ret", retNotuZorunlu: true },
            ]
          : sahip.tur === "IV"
            ? [{ kod: "iv-kapat", etiket: "Tutanağı Kapat (Tamamlandı)", tur: "onay", retNotuZorunlu: false }]
            : []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <FileWarning className="h-5 w-5" /> Tutanak — {t.tutanakNo}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            IV-FR-03 · {tarihTR(t.tutanakTarihi)} · Hakkında tutanak tutulan personel bu tutanağı
            göremez.
          </p>
          <div className="mt-2">
            <Pill renk={DURUM_RENK[t.durum as keyof typeof DURUM_RENK]}>
              {DURUM_ETIKETLERI[t.durum as keyof typeof DURUM_ETIKETLERI]}
            </Pill>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SplitBadge color="gray" left="Liste" right="Tutanaklar" href="/tutanak" />
          <SplitBadge color="blue" left="Tutanak" right="PDF İndir" href={`/api/tutanak/${id}/pdf`} download />
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-medium text-slate-600">Tutanak İçeriği</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Bölüm ve görev tutanak anındaki hâliyle saklanır.
          </p>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Personel</span>
              <p className="font-medium">{t.adSoyadSnapshot}</p>
            </div>
            <div>
              <span className="text-slate-500">Sicil</span>
              <p className="font-mono text-xs mt-1">{t.sicilSnapshot ?? "—"}</p>
            </div>
            <div>
              <span className="text-slate-500">Bölüm</span>
              <p className="font-medium">{t.bolumSnapshot}</p>
            </div>
            <div>
              <span className="text-slate-500">Görev</span>
              <p className="font-medium">{t.gorevSnapshot ?? "—"}</p>
            </div>
            <div>
              <span className="text-slate-500">Sebep</span>
              <p className="font-medium">{SEBEP_ETIKETLERI[t.sebep as keyof typeof SEBEP_ETIKETLERI]}</p>
            </div>
            <div>
              <span className="text-slate-500">Tutanağı tutan</span>
              <p className="font-medium">{t.acan?.name ?? t.acan?.email ?? "—"}</p>
            </div>
            <div>
              <span className="text-slate-500">Yönetici</span>
              <p className="font-medium">
                {t.yonetici?.adSoyad ?? "—"}{" "}
                <span className="text-xs text-slate-500">({t.yoneticiKademe}. kademe)</span>
              </p>
            </div>
            <div>
              <span className="text-slate-500">Son yönetici (bilgi)</span>
              <p className="font-medium">{t.bilgilendirilenSonYonetici?.adSoyad ?? "—"}</p>
            </div>
          </div>

          <div>
            <span className="text-sm text-slate-500">Açıklama</span>
            <p className="mt-1 whitespace-pre-wrap rounded-md border bg-slate-50 p-3 text-sm">{t.aciklama}</p>
          </div>

          {t.redSebebi && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm">
              <span className="font-medium text-rose-800">Ret gerekçesi:</span>{" "}
              <span className="text-rose-900">{t.redSebebi}</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-medium text-slate-600">Tutanak Sahipleri</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Şahitler ve onaylayanlar — IV-FR-03 imza tablosunun karşılığı.
          </p>
        </div>
        <div className="space-y-2">
          {(t.sahitler ?? []).map((s: Record<string, any>) => (
            <div key={s.id} className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-slate-50">
              <div>
                <p className="font-medium">
                  {s.personnel?.adSoyad}{" "}
                  <span className="text-xs text-slate-500">({s.personnel?.sicilNo ?? "—"})</span>
                </p>
                <p className="text-xs text-slate-500">
                  Şahit · {s.bolumSnapshot}
                  {s.not ? ` · ${s.not}` : ""}
                </p>
              </div>
              <div className="text-right">
                <Pill renk={SAHIT_DURUM_RENK[s.durum as keyof typeof SAHIT_DURUM_RENK]}>
                  {SAHIT_DURUM_ETIKETLERI[s.durum as keyof typeof SAHIT_DURUM_ETIKETLERI]}
                </Pill>
                <p className="text-xs text-slate-500 mt-1">{anTR(s.kararAt)}</p>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-slate-50">
            <div>
              <p className="font-medium">{t.yonetici?.adSoyad ?? "—"}</p>
              <p className="text-xs text-slate-500">
                Yönetici ({t.yoneticiKademe}. kademe)
                {t.yoneticiNot ? ` · ${t.yoneticiNot}` : ""}
              </p>
            </div>
            <div className="text-right">
              <Pill renk={SAHIT_DURUM_RENK[(t.yoneticiKarar ?? "BEKLIYOR") as keyof typeof SAHIT_DURUM_RENK]}>
                {t.yoneticiKarar ? SAHIT_DURUM_ETIKETLERI[t.yoneticiKarar as "ONAYLADI" | "REDDETTI"] : "Bekliyor"}
              </Pill>
              <p className="text-xs text-slate-500 mt-1">{anTR(t.yoneticiKararAt)}</p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-slate-50">
            <div>
              <p className="font-medium">İnsan Varlıkları</p>
              <p className="text-xs text-slate-500">Kapanış{t.ivNot ? ` · ${t.ivNot}` : ""}</p>
            </div>
            <div className="text-right">
              <Pill renk={t.ivKapanisAt ? SAHIT_DURUM_RENK.ONAYLADI : SAHIT_DURUM_RENK.BEKLIYOR}>
                {t.ivKapanisAt ? "Kapattı" : "Bekliyor"}
              </Pill>
              <p className="text-xs text-slate-500 mt-1">{anTR(t.ivKapanisAt)}</p>
            </div>
          </div>
        </div>
      </div>

      {aksiyonlar.length > 0 && d.onaylayabilir && (
        <div className="space-y-4 rounded-2xl border border-emerald-300 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium text-slate-600">Bu adım sizde</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Ret için gerekçe zorunludur.</p>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-slate-600">Not {aksiyonlar.some((a) => a.tur === "ret") ? "(ret için zorunlu)" : "(isteğe bağlı)"}</Label>
              <Textarea rows={3} value={not} onChange={(e) => setNot(e.target.value)} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {aksiyonlar.map((a) => (
                <SplitBadge
                  key={a.kod}
                  color={a.tur === "ret" ? "red" : "green"}
                  left="Tutanak"
                  right={islemde ? "İşleniyor..." : a.etiket}
                  onClick={() => void islem(a.kod)}
                  disabled={islemde || (a.retNotuZorunlu && !not.trim())}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-medium text-slate-600">Onay Akışı</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Kim, ne zaman, hangi notla.</p>
        </div>
        <div>
          <ol className="space-y-3">
            {(t.gecmis ?? []).map((g: Record<string, any>) => (
              <li key={g.id} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#1B4F72]" />
                <div className="text-sm">
                  <p className="font-medium">{ADIM_ETIKETLERI[g.adim] ?? g.adim}</p>
                  <p className="text-xs text-slate-500">
                    {g.aktorAd} · {anTR(g.createdAt)}
                    {g.oncekiDurum && g.yeniDurum && g.oncekiDurum !== g.yeniDurum
                      ? ` · ${DURUM_ETIKETLERI[g.oncekiDurum as keyof typeof DURUM_ETIKETLERI]} → ${DURUM_ETIKETLERI[g.yeniDurum as keyof typeof DURUM_ETIKETLERI]}`
                      : ""}
                  </p>
                  {g.not && <p className="mt-0.5 text-xs">{g.not}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}

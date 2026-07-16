"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ClipboardList, Plus, Trash2, Send, ChevronLeft, Copy } from "lucide-react"

// ---- Tipler (API yanıtlarıyla uyumlu) ----
type Assessment = {
  id: string
  name: string
  type: "YETKINLIK" | "YABANCI_DIL" | "GENEL"
  durationMin: number
  passingScore: number
  isActive: boolean
  _count?: { questions: number; sessions: number }
}
type Option = { id: string; text: string; isCorrect: boolean; order: number }
type Question = {
  id: string
  type: "TEK_SECIM" | "COKLU_SECIM" | "DOGRU_YANLIS"
  text: string
  points: number
  order: number
  options: Option[]
}
type AssessmentDetail = Assessment & { questions: Question[] }
type Application = {
  id: string
  fullName: string
  applicationNumber: string
  requestedPosition: string | null
  status: string
}
type Session = {
  id: string
  publicJobApplicationId: string
  status: string
  assignedAt: string
  expiresAt: string
  score: number | null
  result: "GECTI" | "KALDI" | null
  sinavLink: string | null // yalnız aktif oturumda dolu (ATANDI/BASLADI); terminalde null
  assessment: { name: string }
}

const TYPE_ETIKET: Record<string, string> = {
  YETKINLIK: "Yetkinlik",
  YABANCI_DIL: "Yabancı Dil",
  GENEL: "Genel",
}
const QTYPE_ETIKET: Record<string, string> = {
  TEK_SECIM: "Tek Seçim",
  COKLU_SECIM: "Çoklu Seçim",
  DOGRU_YANLIS: "Doğru/Yanlış",
}
const STATUS_ETIKET: Record<string, string> = {
  ATANDI: "Atandı",
  BASLADI: "Başladı",
  TAMAMLANDI: "Tamamlandı",
  SURESI_DOLDU: "Süresi Doldu",
  IPTAL: "İptal",
}

// Sınav atanabilir başvuru statüleri (aktif pipeline). API ile aynı kural.
const ATANABILIR_STATUS = new Set(["PENDING", "REVIEWING", "SHORTLISTED", "INTERVIEW"])

const API = "/api/strategic-hr/recruitment/assessments"

export default function AssessmentPanel() {
  const [sinavlar, setSinavlar] = useState<Assessment[] | null>(null)
  const [hata, setHata] = useState<string | null>(null)
  const [seciliId, setSeciliId] = useState<string | null>(null)

  const yukle = useCallback(() => {
    fetch(API)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Sınavlar alınamadı")
        return r.json()
      })
      .then(setSinavlar)
      .catch((e) => setHata(e.message))
  }, [])

  useEffect(() => { yukle() }, [yukle])

  if (seciliId) {
    return <AssessmentDetailView id={seciliId} onBack={() => { setSeciliId(null); yukle() }} />
  }

  return (
    <div className="space-y-4">
      <YeniSinavForm onCreated={yukle} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[#1B4F72]" />
            Sınav Tanımları
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hata ? (
            <p className="text-sm text-red-600">{hata}</p>
          ) : !sinavlar ? (
            <div className="flex items-center justify-center h-20">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1B4F72]" />
            </div>
          ) : sinavlar.length === 0 ? (
            <p className="text-sm text-slate-500">Henüz sınav tanımı yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="px-3 py-2">Sınav</th>
                    <th className="px-3 py-2">Tür</th>
                    <th className="px-3 py-2">Süre</th>
                    <th className="px-3 py-2">Geçme</th>
                    <th className="px-3 py-2">Soru</th>
                    <th className="px-3 py-2">Atama</th>
                    <th className="px-3 py-2">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {sinavlar.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b last:border-0 cursor-pointer hover:bg-slate-50"
                      onClick={() => setSeciliId(s.id)}
                    >
                      <td className="px-3 py-2 font-medium text-[#1B4F72]">{s.name}</td>
                      <td className="px-3 py-2">{TYPE_ETIKET[s.type] ?? s.type}</td>
                      <td className="px-3 py-2">{s.durationMin} dk</td>
                      <td className="px-3 py-2">%{s.passingScore}</td>
                      <td className="px-3 py-2">{s._count?.questions ?? 0}</td>
                      <td className="px-3 py-2">{s._count?.sessions ?? 0}</td>
                      <td className="px-3 py-2">
                        {s.isActive ? (
                          <Badge className="bg-green-100 text-green-700">Aktif</Badge>
                        ) : (
                          <Badge variant="secondary">Pasif</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---- Yeni sınav oluşturma ----
function YeniSinavForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("")
  const [type, setType] = useState<Assessment["type"]>("GENEL")
  const [durationMin, setDurationMin] = useState("30")
  const [passingScore, setPassingScore] = useState("60")
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  const kaydet = async () => {
    setHata(null)
    setGonderiliyor(true)
    try {
      const r = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, durationMin: Number(durationMin), passingScore: Number(passingScore) }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Kaydedilemedi")
      setName("")
      onCreated()
    } catch (e) {
      setHata((e as Error).message)
    } finally {
      setGonderiliyor(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Plus className="h-4 w-4 text-[#1B4F72]" />
          Yeni Sınav
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-2">
            <Label className="text-xs">Sınav Adı</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn: Genel Yetenek" />
          </div>
          <div>
            <Label className="text-xs">Tür</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as Assessment["type"])}
            >
              <option value="GENEL">Genel</option>
              <option value="YETKINLIK">Yetkinlik</option>
              <option value="YABANCI_DIL">Yabancı Dil</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Süre (dk)</Label>
            <Input type="number" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Geçme (%)</Label>
            <Input type="number" value={passingScore} onChange={(e) => setPassingScore(e.target.value)} />
          </div>
        </div>
        {hata && <p className="text-sm text-red-600 mt-2">{hata}</p>}
        <div className="mt-3">
          <Button onClick={kaydet} disabled={!name || gonderiliyor} className="bg-[#1B4F72]">
            {gonderiliyor ? "Kaydediliyor…" : "Sınav Oluştur"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ---- Sınav detay: soru yönetimi + atama + sonuçlar ----
function AssessmentDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const [detay, setDetay] = useState<AssessmentDetail | null>(null)
  const [hata, setHata] = useState<string | null>(null)

  const yukle = useCallback(() => {
    fetch(`${API}/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Detay alınamadı")
        return r.json()
      })
      .then(setDetay)
      .catch((e) => setHata(e.message))
  }, [id])

  useEffect(() => { yukle() }, [yukle])

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="text-[#1B4F72]">
        <ChevronLeft className="h-4 w-4 mr-1" /> Sınav Listesine Dön
      </Button>

      {hata ? (
        <p className="text-sm text-red-600">{hata}</p>
      ) : !detay ? (
        <div className="flex items-center justify-center h-20">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1B4F72]" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{detay.name}</CardTitle>
              <p className="text-sm text-slate-500">
                {TYPE_ETIKET[detay.type]} · {detay.durationMin} dk · Geçme %{detay.passingScore}
              </p>
            </CardHeader>
            <CardContent>
              <SoruListesi detay={detay} onChange={yukle} />
            </CardContent>
          </Card>

          <YeniSoruForm assessmentId={id} onAdded={yukle} />
          <AtamaVeSonuc assessmentId={id} />
        </>
      )}
    </div>
  )
}

function SoruListesi({ detay, onChange }: { detay: AssessmentDetail; onChange: () => void }) {
  const sil = async (questionId: string) => {
    const r = await fetch(`${API}/${detay.id}/questions/${questionId}`, { method: "DELETE" })
    if (!r.ok) {
      alert((await r.json().catch(() => ({}))).error || "Silinemedi")
      return
    }
    onChange()
  }

  if (detay.questions.length === 0) {
    return <p className="text-sm text-slate-500">Henüz soru eklenmemiş.</p>
  }
  return (
    <div className="space-y-3">
      {detay.questions.map((q, i) => (
        <div key={q.id} className="border rounded-md p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-medium">
              {i + 1}. {q.text}{" "}
              <span className="text-xs text-slate-400">
                ({QTYPE_ETIKET[q.type]} · {q.points} puan)
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => sil(q.id)} className="text-red-600">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <ul className="mt-2 space-y-1">
            {q.options.map((o) => (
              <li key={o.id} className={`text-sm ${o.isCorrect ? "text-green-700 font-medium" : "text-slate-600"}`}>
                {o.isCorrect ? "✓ " : "• "}{o.text}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function YeniSoruForm({ assessmentId, onAdded }: { assessmentId: string; onAdded: () => void }) {
  const [text, setText] = useState("")
  const [type, setType] = useState<Question["type"]>("TEK_SECIM")
  const [points, setPoints] = useState("1")
  const [options, setOptions] = useState<{ text: string; isCorrect: boolean }[]>([
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
  ])
  const [hata, setHata] = useState<string | null>(null)
  const [gonderiliyor, setGonderiliyor] = useState(false)

  const setOpt = (i: number, patch: Partial<{ text: string; isCorrect: boolean }>) => {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)))
  }
  const dogruSec = (i: number) => {
    // Tek/Doğru-Yanlış: tek doğru; Çoklu: birden çok
    if (type === "COKLU_SECIM") {
      setOpt(i, { isCorrect: !options[i].isCorrect })
    } else {
      setOptions((prev) => prev.map((o, idx) => ({ ...o, isCorrect: idx === i })))
    }
  }

  const kaydet = async () => {
    setHata(null)
    setGonderiliyor(true)
    try {
      const r = await fetch(`${API}/${assessmentId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, type, points: Number(points), options }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Eklenemedi")
      setText("")
      setOptions([{ text: "", isCorrect: true }, { text: "", isCorrect: false }])
      setType("TEK_SECIM")
      setPoints("1")
      onAdded()
    } catch (e) {
      setHata((e as Error).message)
    } finally {
      setGonderiliyor(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Plus className="h-4 w-4 text-[#1B4F72]" /> Soru Ekle
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">Soru Metni</Label>
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Soruyu yazın" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Soru Tipi</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={type}
              onChange={(e) => {
                const t = e.target.value as Question["type"]
                setType(t)
                if (t === "DOGRU_YANLIS") {
                  setOptions([{ text: "Doğru", isCorrect: true }, { text: "Yanlış", isCorrect: false }])
                }
              }}
            >
              <option value="TEK_SECIM">Tek Seçim</option>
              <option value="COKLU_SECIM">Çoklu Seçim</option>
              <option value="DOGRU_YANLIS">Doğru/Yanlış</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Puan</Label>
            <Input type="number" value={points} onChange={(e) => setPoints(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Şıklar (doğru olanı işaretleyin)</Label>
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type={type === "COKLU_SECIM" ? "checkbox" : "radio"}
                checked={o.isCorrect}
                onChange={() => dogruSec(i)}
                name="dogru-sik"
              />
              <Input
                value={o.text}
                onChange={(e) => setOpt(i, { text: e.target.value })}
                placeholder={`Şık ${i + 1}`}
                disabled={type === "DOGRU_YANLIS"}
              />
              {type !== "DOGRU_YANLIS" && options.length > 2 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {type !== "DOGRU_YANLIS" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOptions((prev) => [...prev, { text: "", isCorrect: false }])}
            >
              <Plus className="h-3 w-3 mr-1" /> Şık Ekle
            </Button>
          )}
        </div>

        {hata && <p className="text-sm text-red-600">{hata}</p>}
        <Button
          onClick={kaydet}
          disabled={!text || options.some((o) => !o.text) || gonderiliyor}
          className="bg-[#1B4F72]"
        >
          {gonderiliyor ? "Ekleniyor…" : "Soruyu Ekle"}
        </Button>
      </CardContent>
    </Card>
  )
}

function AtamaVeSonuc({ assessmentId }: { assessmentId: string }) {
  const [basvurular, setBasvurular] = useState<Application[]>([])
  const [seciliBasvuru, setSeciliBasvuru] = useState("")
  const [oturumlar, setOturumlar] = useState<Session[]>([])
  const [mesaj, setMesaj] = useState<string | null>(null)

  const oturumlariYukle = useCallback(() => {
    fetch(`${API}/sessions`)
      .then((r) => (r.ok ? r.json() : []))
      .then((all: Session[]) => setOturumlar(all.filter((o) => o.assessment)))
      .catch(() => setOturumlar([]))
  }, [])

  useEffect(() => {
    // Gerçek başvuru kuyruğu (PublicJobApplication). Yalnız atanabilir statüler.
    fetch("/api/strategic-hr/recruitment/job-applications?limit=200")
      .then((r) => (r.ok ? r.json() : { applications: [] }))
      .then((d) => {
        const list: Application[] = Array.isArray(d?.applications) ? d.applications : []
        setBasvurular(list.filter((b) => ATANABILIR_STATUS.has(b.status)))
      })
      .catch(() => setBasvurular([]))
    oturumlariYukle()
  }, [oturumlariYukle])

  const ata = async () => {
    setMesaj(null)
    const r = await fetch(`${API}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicJobApplicationId: seciliBasvuru, assessmentId }),
    })
    if (!r.ok) {
      setMesaj((await r.json().catch(() => ({}))).error || "Atanamadı")
      return
    }
    setMesaj("Sınav atandı.")
    oturumlariYukle()
  }

  // Aday sınav linkini panoya kopyala (yalnız İK görür; link zaten aktif oturumda dolu).
  const linkKopyala = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      setMesaj("Aday sınav linki panoya kopyalandı.")
    } catch {
      setMesaj("Kopyalanamadı — linki elle seçip kopyalayın: " + link)
    }
  }

  const buSinavOturumlari = oturumlar // sessions endpoint tümünü döndürür; İK burada hepsini görebilir

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="h-4 w-4 text-[#1B4F72]" /> Atama ve Sonuçlar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col md:flex-row gap-2 md:items-end">
          <div className="flex-1">
            <Label className="text-xs">Aday Başvurusu</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={seciliBasvuru}
              onChange={(e) => setSeciliBasvuru(e.target.value)}
            >
              <option value="">Başvuru seçin…</option>
              {basvurular.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.fullName} — {b.requestedPosition ?? "Pozisyon belirtilmemiş"}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={ata} disabled={!seciliBasvuru} className="bg-[#1B4F72]">
            Sınavı Ata
          </Button>
        </div>
        {mesaj && <p className="text-sm text-[#1B4F72]">{mesaj}</p>}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="px-3 py-2">Sınav</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Son Geçerlilik</th>
                <th className="px-3 py-2">Aday Linki / Sonuç</th>
              </tr>
            </thead>
            <tbody>
              {buSinavOturumlari.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-slate-500">Henüz atama yok.</td>
                </tr>
              ) : (
                buSinavOturumlari.map((o) => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{o.assessment.name}</td>
                    <td className="px-3 py-2">{STATUS_ETIKET[o.status] ?? o.status}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {new Date(o.expiresAt).toLocaleString("tr-TR", {
                        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2">
                      {o.sinavLink ? (
                        // Aktif oturum: adaya iletilecek link (kopyala). Ekranda tam URL basılmaz (omuz sızıntısı).
                        <Button size="sm" variant="outline" onClick={() => linkKopyala(o.sinavLink!)}>
                          <Copy className="h-3 w-3 mr-1" /> Linki Kopyala
                        </Button>
                      ) : o.result === "GECTI" ? (
                        <Badge className="bg-green-100 text-green-700">Geçti (%{o.score})</Badge>
                      ) : o.result === "KALDI" ? (
                        <Badge className="bg-red-100 text-red-700">Kaldı (%{o.score})</Badge>
                      ) : (
                        <span className="text-slate-400">{STATUS_ETIKET[o.status] ?? "—"}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

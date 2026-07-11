"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, CheckCircle2, AlertTriangle } from "lucide-react"

type Secenek = { id: string; text: string; order: number }
type Soru = { id: string; text: string; order: number; type: string; secenekler: Secenek[] }
type Sinav = {
  assessmentName: string
  durationMin: number
  kalanSaniye: number
  adayAdi: string
  sorular: Soru[]
}

const API = "/api/public/sinav"

function sureFormat(sn: number) {
  const m = Math.floor(sn / 60)
  const s = sn % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

export default function SinavClient({ token }: { token: string }) {
  const [sinav, setSinav] = useState<Sinav | null>(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [gecersiz, setGecersiz] = useState(false)
  const [tamamlandi, setTamamlandi] = useState(false)
  const [kalan, setKalan] = useState(0)
  const [cevaplar, setCevaplar] = useState<Record<string, string[]>>({})
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const gonderildiRef = useRef(false)

  // Cevabı gönder (tek-sefer; sunucu da kilitler)
  const gonder = useCallback(async () => {
    if (gonderildiRef.current) return
    gonderildiRef.current = true
    setGonderiliyor(true)
    const answers = Object.entries(cevaplar).map(([questionId, selectedOptionIds]) => ({
      questionId,
      selectedOptionIds,
    }))
    try {
      const r = await fetch(`${API}/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      })
      if (r.ok) {
        setTamamlandi(true)
      } else {
        // Süre doldu / geçersiz → uniform bilgilendirme
        setGecersiz(true)
      }
    } catch {
      gonderildiRef.current = false // ağ hatası → tekrar denenebilir
      setGecersiz(true)
    } finally {
      setGonderiliyor(false)
    }
  }, [cevaplar, token])

  // Sınavı yükle
  useEffect(() => {
    fetch(`${API}/${token}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("gecersiz")
        return r.json()
      })
      .then((d: Sinav) => {
        setSinav(d)
        setKalan(d.kalanSaniye)
      })
      .catch(() => setGecersiz(true))
      .finally(() => setYukleniyor(false))
  }, [token])

  // Geri sayım (görsel) — 0'a inince sunucu zaten reddeder; yine de otomatik gönder.
  useEffect(() => {
    if (!sinav || tamamlandi || gecersiz) return
    if (kalan <= 0) {
      gonder()
      return
    }
    const t = setTimeout(() => setKalan((k) => k - 1), 1000)
    return () => clearTimeout(t)
  }, [kalan, sinav, tamamlandi, gecersiz, gonder])

  const secim = (soru: Soru, optId: string) => {
    setCevaplar((prev) => {
      const mevcut = prev[soru.id] ?? []
      if (soru.type === "COKLU_SECIM") {
        return { ...prev, [soru.id]: mevcut.includes(optId) ? mevcut.filter((x) => x !== optId) : [...mevcut, optId] }
      }
      return { ...prev, [soru.id]: [optId] }
    })
  }

  // --- Ekranlar ---
  if (yukleniyor) {
    return (
      <Merkez>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B4F72]" />
      </Merkez>
    )
  }
  if (gecersiz) {
    return (
      <Merkez>
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertTriangle className="h-10 w-10 text-slate-400" />
            <p className="text-slate-700 font-medium">Bu sınav bağlantısı geçerli değil.</p>
            <p className="text-sm text-slate-500">
              Bağlantının süresi dolmuş, sınav tamamlanmış veya bağlantı hatalı olabilir.
              İnsan Kaynakları ile iletişime geçebilirsiniz.
            </p>
          </CardContent>
        </Card>
      </Merkez>
    )
  }
  if (tamamlandi) {
    return (
      <Merkez>
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="text-slate-700 font-medium">Sınavınız tamamlandı.</p>
            <p className="text-sm text-slate-500">Katılımınız için teşekkür ederiz.</p>
          </CardContent>
        </Card>
      </Merkez>
    )
  }
  if (!sinav) return null

  const dusukSure = kalan <= 60
  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Başlık + süre */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg text-[#1B4F72]">{sinav.assessmentName}</CardTitle>
              <p className="text-sm text-slate-500">{sinav.adayAdi}</p>
            </div>
            <div className={`flex items-center gap-1 font-mono font-semibold ${dusukSure ? "text-red-600" : "text-slate-700"}`}>
              <Clock className="h-4 w-4" />
              {sureFormat(kalan)}
            </div>
          </CardHeader>
        </Card>

        {/* Sorular */}
        {sinav.sorular.map((soru, i) => (
          <Card key={soru.id}>
            <CardContent className="py-4">
              <p className="font-medium text-sm mb-3">
                {i + 1}. {soru.text}
                {soru.type === "COKLU_SECIM" && (
                  <span className="text-xs text-slate-400"> (birden fazla seçilebilir)</span>
                )}
              </p>
              <div className="space-y-2">
                {soru.secenekler.map((o) => {
                  const secili = (cevaplar[soru.id] ?? []).includes(o.id)
                  return (
                    <label
                      key={o.id}
                      className={`flex items-center gap-2 rounded-md border p-2 cursor-pointer text-sm ${secili ? "border-[#1B4F72] bg-blue-50" : "border-slate-200"}`}
                    >
                      <input
                        type={soru.type === "COKLU_SECIM" ? "checkbox" : "radio"}
                        name={soru.id}
                        checked={secili}
                        onChange={() => secim(soru, o.id)}
                      />
                      {o.text}
                    </label>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))}

        <div className="flex justify-end pb-8">
          <Button onClick={gonder} disabled={gonderiliyor} className="bg-[#1B4F72]">
            {gonderiliyor ? "Gönderiliyor…" : "Sınavı Gönder"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Merkez({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">{children}</div>
}

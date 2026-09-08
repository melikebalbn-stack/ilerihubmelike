"use client"

// IV-FR-27 · Personel kartındaki "Deneme Değerlendirme" bölümü.
//
// GÖRÜNÜRLÜK: kart, sunucudan form DÖNERSE çizilir. GET /api/deneme zaten
// zincir + İV kuralını uyguluyor; yetkisi olmayan kullanıcıya boş liste döner ve
// kart HİÇ render edilmez (boş bölüm de gösterilmez).

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExternalLink } from "lucide-react"
import { apiFetch } from "@/lib/api-fetch"

const DURUM_ETIKET: Record<string, string> = {
  TASLAK: "Taslak",
  DEGERLENDIRICI1_BEKLIYOR: "1. Değerlendirici bekliyor",
  MUDUR_YRD_BEKLIYOR: "Müdür yardımcısı bekliyor",
  MUDUR_BEKLIYOR: "Müdür bekliyor",
  ONAY_BEKLIYOR: "Onay bekliyor",
  IK_BEKLIYOR: "İnsan Varlıkları'nda",
  TAMAMLANDI: "Tamamlandı",
  IPTAL: "İptal",
}
const GECME_PUANI = 60

type Satir = {
  id: string
  tur: "DENEME_2AY" | "ALTI_AY"
  durum: string
  hedefTarih: string
  puan1: number | null
  puan2: number | null
  ortalama: number | null
  basarili: boolean | null
}

export function DenemeFormlariKarti({ personnelId }: { personnelId: string }) {
  const [satirlar, setSatirlar] = useState<Satir[] | null>(null)

  useEffect(() => {
    let iptal = false
    void (async () => {
      try {
        // hepsi=true → kapanmışlar da görünsün (kartın amacı geçmiş).
        const res = await apiFetch(`/api/deneme?personnelId=${encodeURIComponent(personnelId)}&hepsi=true`)
        if (!res.ok) { if (!iptal) setSatirlar([]); return }
        const j = await res.json()
        if (!iptal) setSatirlar(j.formlar ?? [])
      } catch {
        if (!iptal) setSatirlar([])
      }
    })()
    return () => { iptal = true }
  }, [personnelId])

  // Yükleniyor ya da yetki/form yok → kartı HİÇ çizme.
  if (!satirlar || satirlar.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Deneme Değerlendirme</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {satirlar.map((s) => {
          const dusuk = s.ortalama !== null && s.ortalama < GECME_PUANI
          return (
            <div key={s.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border p-3">
              <Badge variant={s.tur === "DENEME_2AY" ? "secondary" : "default"}>
                {s.tur === "DENEME_2AY" ? "2 AY" : "6 AY"}
              </Badge>
              <div className="text-sm">
                <span className="text-muted-foreground">Tarih: </span>
                {new Date(s.hedefTarih).toLocaleDateString("tr-TR")}
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Durum: </span>
                {DURUM_ETIKET[s.durum] ?? s.durum}
              </div>
              <div className="text-sm tabular-nums">
                <span className="text-muted-foreground">Puanlar: </span>
                {s.puan1 ?? "—"} / {s.puan2 ?? "—"}
              </div>
              <div className={`text-sm font-semibold tabular-nums ${dusuk ? "text-destructive" : ""}`}>
                <span className="font-normal text-muted-foreground">Ortalama: </span>
                {s.ortalama?.toFixed(1) ?? "—"}
              </div>
              {s.basarili !== null && (
                <Badge variant={s.basarili ? "default" : "destructive"}>
                  {s.basarili ? "BAŞARILI" : "BAŞARISIZ"}
                </Badge>
              )}
              <Link
                href={`/deneme/${s.id}`}
                className="ml-auto inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Formu aç <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

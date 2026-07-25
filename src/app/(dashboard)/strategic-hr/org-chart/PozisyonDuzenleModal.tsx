"use client"

// POSITION kartına tıklayınca açılan düzenleme modalı. YENİ endpoint AÇMAZ — mevcut uçları
// çağıran üst bileşen (OrgChartTree) callback'lerini tetikler:
//   - Kişi ata/değiştir, Vekil ata  → VekilAtamaModal (personel-listesi + uye-ata/vekil-ata)
//   - Kişiyi çıkar                  → uye-ata {kaldir:true}
//   - Pozisyonu çıkar               → pozisyon-cikar {gerekce}
// İşlem butonları YALNIZ hasFullAccess'te; değilse salt bilgi. Güvenlik yine sunucuda (403).

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// OrgChartTree'nin OrgUnit'iyle yapısal uyumlu — yalnız gerekli alanlar.
interface DuzenleUnit {
  id: string
  name: string
  code?: string
  approvedHeadcount?: number | null
  positionStatus?: "AKTIF" | "DONDURULDU" | "PLANLANAN"
  vekaletDurumu?: boolean
  vekilAdi?: string | null
  employees?: {
    id: string
    displayName: string
    title?: string | null
    positionTitle?: string | null
    employmentStatus: string
  }[]
}

export default function PozisyonDuzenleModal({
  unit,
  hasFullAccess,
  submitting,
  onClose,
  onAtaDegistir,
  onVekilAta,
  onVekilKaldir,
  onKisiCikar,
  onPozisyonCikar,
}: {
  unit: DuzenleUnit | null
  hasFullAccess: boolean
  submitting: boolean
  onClose: () => void
  onAtaDegistir: () => void
  onVekilAta: () => void
  onVekilKaldir: () => void
  onKisiCikar: (orgEmployeeId: string) => void
  onPozisyonCikar: (gerekce: string) => void
}) {
  const [cikarModu, setCikarModu] = useState(false)
  const [gerekce, setGerekce] = useState("")

  const acik = !!unit
  const aktifKisiler = (unit?.employees ?? []).filter((e) => e.employmentStatus !== "VACANT")
  const doluluk = aktifKisiler.length
  const kadro = unit?.approvedHeadcount ?? 0

  const kapat = () => {
    setCikarModu(false)
    setGerekce("")
    onClose()
  }

  return (
    <Dialog open={acik} onOpenChange={(o) => { if (!o) kapat() }}>
      <DialogContent className="max-w-md">
        {unit && (
          <>
            <DialogHeader>
              <DialogTitle>{unit.name}</DialogTitle>
              <DialogDescription>
                {unit.code ? `${unit.code} · ` : ""}Doluluk {doluluk}/{kadro || 1}
                {unit.positionStatus === "DONDURULDU" ? " · (Pasif)" : ""}
              </DialogDescription>
            </DialogHeader>

            {/* Atanan kişi(ler) */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Atanan</Label>
              {aktifKisiler.length === 0 ? (
                <div className="text-sm text-muted-foreground">Boş kadro — atanmış kişi yok.</div>
              ) : (
                <ul className="space-y-1">
                  {aktifKisiler.map((e) => (
                    <li key={e.id} className="flex items-center justify-between rounded border px-2 py-1.5 text-sm">
                      <div>
                        <div className="font-medium">{e.displayName}</div>
                        {(e.title || e.positionTitle) && (
                          <div className="text-xs text-muted-foreground">{e.title || e.positionTitle}</div>
                        )}
                      </div>
                      {hasFullAccess && (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => {
                            if (window.confirm(`${e.displayName} bu pozisyondan çıkarılsın mı?`)) {
                              onKisiCikar(e.id)
                            }
                          }}
                          className="text-xs text-red-600 hover:underline disabled:opacity-50"
                        >
                          Çıkar
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Vekalet bilgisi (varsa) */}
            {unit.vekaletDurumu && (
              <div className="text-sm">
                <span className="text-muted-foreground">Vekaleten: </span>
                <span className="font-medium">{unit.vekilAdi || "(atanmadı)"}</span>
              </div>
            )}

            {/* İşlemler — yalnız yetkilide */}
            {hasFullAccess ? (
              cikarModu ? (
                <div className="space-y-2 border-t pt-3">
                  <Label className="text-xs">Pozisyonu çıkarma gerekçesi *</Label>
                  <Input
                    value={gerekce}
                    onChange={(e) => setGerekce(e.target.value)}
                    placeholder="ör. Bütçe kısıtı, iş hacmi düşüşü..."
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setCikarModu(false); setGerekce("") }}>
                      Vazgeç
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={submitting || !gerekce.trim()}
                      onClick={() => onPozisyonCikar(gerekce.trim())}
                    >
                      {submitting ? "İşleniyor..." : "Pozisyonu Çıkar"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 border-t pt-3">
                  <Button variant="outline" size="sm" disabled={submitting} onClick={onAtaDegistir}>
                    {doluluk > 0 ? "Kişi Değiştir" : "Kişi Ata"}
                  </Button>
                  {unit.vekaletDurumu ? (
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" disabled={submitting} onClick={onVekilKaldir}>
                      Vekil Kaldır
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled={submitting} onClick={onVekilAta}>
                      Vekil Ata
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="col-span-2 text-red-600 hover:text-red-700"
                    disabled={submitting}
                    onClick={() => setCikarModu(true)}
                  >
                    Pozisyonu Çıkar (Dondur)
                  </Button>
                </div>
              )
            ) : (
              <div className="border-t pt-3 text-xs text-muted-foreground">
                Bu pozisyonda düzenleme yetkiniz yok.
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

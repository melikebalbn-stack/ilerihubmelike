"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface Props {
  form: Record<string, any>
  set: (patch: Record<string, any>) => void
}

// IV-FR-24 · Bölüm 1 ek alanları (form tarihleri + kişilik + ayrılan personel).
// Mevcut talep alanları (pozisyon, tip, gerekçe vb.) sayfada inline durur; bunlar
// yalnızca yeni eklenen "Talep Bilgisi" alanlarıdır.
export function TalepBilgisiEkSection({ form, set }: Props) {
  // Yenileme (ayrılan yerine) → ayrılan personelin adı istenir.
  const ayrilanGoster = form.requestType === "REPLACEMENT"
  return (
    <>
      <div>
        <Label>Form Hazırlanma Tarihi</Label>
        <Input
          type="date"
          value={form.formHazirlanmaTarihi || ""}
          onChange={(e) => set({ formHazirlanmaTarihi: e.target.value })}
        />
      </div>
      <div>
        <Label>İK'ya Teslim Tarihi</Label>
        <Input
          type="date"
          value={form.ikTeslimTarihi || ""}
          onChange={(e) => set({ ikTeslimTarihi: e.target.value })}
        />
      </div>
      {ayrilanGoster && (
        <div className="col-span-2">
          <Label>Ayrılan Personel Adı</Label>
          <Input
            placeholder="Yerine alım yapılacak personelin adı"
            value={form.ayrilanPersonelAdi || ""}
            onChange={(e) => set({ ayrilanPersonelAdi: e.target.value })}
          />
        </div>
      )}
      <div className="col-span-2">
        <Label>Aranan Kişilik Özellikleri</Label>
        <Textarea
          rows={2}
          placeholder="örn. takım çalışmasına yatkın, analitik, iletişimi güçlü"
          value={form.kisilikOzellikleri || ""}
          onChange={(e) => set({ kisilikOzellikleri: e.target.value })}
        />
      </div>
    </>
  )
}

"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Props {
  form: Record<string, any>
  set: (patch: Record<string, any>) => void
}

// IV-FR-24 · Bölüm 2: Aranan Yetkinlikler. Talep eden (birim) doldurur.
// "Diğer ___" / "Seviye ___" boşlukları YALNIZ ilgili seçenek işaretlenince açılır.
export function ArananYetkinliklerSection({ form, set }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Eğitim Seviyesi */}
        <div>
          <Label>Eğitim Seviyesi</Label>
          <Select value={form.egitimSeviyesi || ""} onValueChange={(v) => set({ egitimSeviyesi: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Seçiniz" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LISE">Lise</SelectItem>
              <SelectItem value="TEKNIK_LISE">Teknik Lise</SelectItem>
              <SelectItem value="ON_LISANS">Ön Lisans</SelectItem>
              <SelectItem value="LISANS">Lisans</SelectItem>
              <SelectItem value="YUKSEK_LISANS">Yüksek Lisans</SelectItem>
              <SelectItem value="DIGER">Diğer</SelectItem>
            </SelectContent>
          </Select>
          {form.egitimSeviyesi === "DIGER" && (
            <Input
              className="mt-2"
              placeholder="Diğer eğitim ___"
              value={form.egitimDiger || ""}
              onChange={(e) => set({ egitimDiger: e.target.value })}
            />
          )}
        </div>

        {/* Tecrübe Durumu */}
        <div>
          <Label>Tecrübe Durumu</Label>
          <Select value={form.tecrubeDurumu || ""} onValueChange={(v) => set({ tecrubeDurumu: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Seçiniz" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TECRUBELI">Tecrübeli</SelectItem>
              <SelectItem value="YENI_MEZUN">Yeni Mezun</SelectItem>
            </SelectContent>
          </Select>
          {form.tecrubeDurumu === "TECRUBELI" && (
            <Input
              className="mt-2"
              placeholder="Tecrübe süresi (örn. 3 yıl)"
              value={form.tecrubeSuresi || ""}
              onChange={(e) => set({ tecrubeSuresi: e.target.value })}
            />
          )}
        </div>
      </div>

      {/* Yabancı Dil */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-gray-300"
            checked={!!form.yabanciDilGerekli}
            onChange={(e) => set({ yabanciDilGerekli: e.target.checked })}
          />
          <span className="text-sm font-medium">Yabancı dil gerekli</span>
        </label>
        {form.yabanciDilGerekli && (
          <Input
            className="mt-2"
            placeholder="Hangi dil(ler) / seviye — örn. İngilizce (ileri), Almanca (orta)"
            value={form.yabanciDiller || ""}
            onChange={(e) => set({ yabanciDiller: e.target.value })}
          />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Bilgisayar Bilgisi</Label>
          <Input
            placeholder="örn. MS Office, SolidWorks"
            value={form.bilgisayarBilgisi || ""}
            onChange={(e) => set({ bilgisayarBilgisi: e.target.value })}
          />
        </div>
        <div>
          <Label>Kalite Sistem Bilgisi</Label>
          <Input
            placeholder="örn. ISO 9001, IATF 16949"
            value={form.kaliteSistemBilgisi || ""}
            onChange={(e) => set({ kaliteSistemBilgisi: e.target.value })}
          />
        </div>
      </div>

      {/* Ehliyet */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-gray-300"
            checked={!!form.ehliyetGerekli}
            onChange={(e) => set({ ehliyetGerekli: e.target.checked })}
          />
          <span className="text-sm font-medium">Ehliyet gerekli</span>
        </label>
        {form.ehliyetGerekli && (
          <Input
            className="mt-2"
            placeholder="Ehliyet sınıfı — örn. B, C, E"
            value={form.ehliyetSinifi || ""}
            onChange={(e) => set({ ehliyetSinifi: e.target.value })}
          />
        )}
      </div>

      <div>
        <Label>Diğer Belge / Sertifika İhtiyacı</Label>
        <Input
          placeholder="örn. Forklift operatör belgesi"
          value={form.digerBelgeIhtiyaci || ""}
          onChange={(e) => set({ digerBelgeIhtiyaci: e.target.value })}
        />
      </div>

      {/* Cinsiyet / Yaş / Askerlik — İÇ kadro planlaması; yayınlanan iş ilanına ASLA taşınmaz. */}
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-3">
        <p className="text-xs text-amber-700">
          Cinsiyet ve yaş bilgileri yalnız iç kadro planlaması içindir; yayınlanan iş ilanına aktarılmaz.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Cinsiyet Tercihi</Label>
            <Select value={form.cinsiyetTercihi || ""} onValueChange={(v) => set({ cinsiyetTercihi: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Farketmez" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BAY">Bay</SelectItem>
                <SelectItem value="BAYAN">Bayan</SelectItem>
                <SelectItem value="FARKETMEZ">Farketmez</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Yaş Aralığı (Min)</Label>
            <Input
              type="number"
              min={0}
              placeholder="—"
              value={form.yasAraligiMin ?? ""}
              onChange={(e) => set({ yasAraligiMin: e.target.value })}
            />
          </div>
          <div>
            <Label>Yaş Aralığı (Max)</Label>
            <Input
              type="number"
              min={0}
              placeholder="—"
              value={form.yasAraligiMax ?? ""}
              onChange={(e) => set({ yasAraligiMax: e.target.value })}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-gray-300"
            checked={!!form.askerlikGerekli}
            onChange={(e) => set({ askerlikGerekli: e.target.checked })}
          />
          <span className="text-sm font-medium">Askerlik yapmış olması gerekli</span>
        </label>
      </div>
    </div>
  )
}

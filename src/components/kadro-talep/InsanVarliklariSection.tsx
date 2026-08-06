"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const KAYNAK_SECENEKLERI = ["Kariyer.net", "LinkedIn", "İŞKUR", "Referans", "İç İlan", "Sosyal Medya"]

interface Props {
  form: Record<string, any>
  set: (patch: Record<string, any>) => void
  onSave: () => void
}

// IV-FR-24 · Bölüm 3: İnsan Varlıkları kapanış bölümü — YALNIZ İK doldurur.
// (Sayfada bu bileşen `hasFullAccess` guard'ı altında render edilir.)
export function InsanVarliklariSection({ form, set, onSave }: Props) {
  const secili: string[] = Array.isArray(form.adayKaynaklari) ? form.adayKaynaklari : []
  const toggle = (k: string) => {
    set({ adayKaynaklari: secili.includes(k) ? secili.filter((x) => x !== k) : [...secili, k] })
  }
  return (
    <div className="border rounded-md p-3 bg-slate-50 space-y-3">
      <h4 className="font-medium text-sm">İnsan Varlıkları Bölümü (yalnız İK)</h4>

      <div>
        <Label className="text-xs">Aday Kaynakları</Label>
        <div className="flex flex-wrap gap-3 mt-1">
          {KAYNAK_SECENEKLERI.map((k) => (
            <label key={k} className="flex items-center gap-1.5 cursor-pointer text-sm">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={secili.includes(k)}
                onChange={() => toggle(k)}
              />
              {k}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">İlan Portalları</Label>
          <Input
            value={form.ilanPortallari || ""}
            onChange={(e) => set({ ilanPortallari: e.target.value })}
            placeholder="örn. Kariyer.net, LinkedIn"
          />
        </div>
        <div>
          <Label className="text-xs">Diğer Aday Kaynağı</Label>
          <Input
            value={form.adayKaynagiDiger || ""}
            onChange={(e) => set({ adayKaynagiDiger: e.target.value })}
            placeholder="—"
          />
        </div>
        <div>
          <Label className="text-xs">Kadro Doldurulma Tarihi</Label>
          <Input
            type="date"
            value={form.kadroDoldurulmaTarihi || ""}
            onChange={(e) => set({ kadroDoldurulmaTarihi: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">İşe Başlayan Personel Adı</Label>
          <Input
            value={form.iseBaslayanPersonelAdi || ""}
            onChange={(e) => set({ iseBaslayanPersonelAdi: e.target.value })}
            placeholder="—"
          />
        </div>
      </div>

      <Button size="sm" className="bg-[#1B4F72]" onClick={onSave}>
        İnsan Varlıkları Bilgilerini Kaydet
      </Button>
    </div>
  )
}

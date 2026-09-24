"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Building2, Package, Coins, FileText } from "lucide-react";
import { yeniProjeSchema, type YeniProjeFormValues } from "@/app/api/proje-takip/_lib/schema";

const ADIMLAR = [
  { key: "musteri", baslik: "Müşteri Bilgileri", icon: Building2 },
  { key: "urun", baslik: "Proje / Ürün Bilgileri", icon: Package },
  { key: "fiyat", baslik: "Miktar & Fiyat", icon: Coins },
  { key: "not", baslik: "Notlar & Onay", icon: FileText },
] as const;

const ANA_RENK = "#1B4F72";

type FormState = Partial<Record<keyof YeniProjeFormValues, string>>;

const ADIM_ZORUNLU_ALANLAR: Record<number, (keyof YeniProjeFormValues)[]> = {
  0: ["musteriFirma"],
  1: ["ileriTanim"],
  2: [],
  3: [],
};

export function YeniProjeForm() {
  const router = useRouter();
  const [adim, setAdim] = useState(0);
  const [form, setForm] = useState<FormState>({ yil: String(new Date().getFullYear()) });
  const [adimHatalari, setAdimHatalari] = useState<Record<string, string>>({});
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  function setField(key: keyof YeniProjeFormValues, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function ileriGit() {
    const zorunluAlanlar = ADIM_ZORUNLU_ALANLAR[adim];
    const yenihatalar: Record<string, string> = {};
    for (const alan of zorunluAlanlar) {
      if (!form[alan]?.trim()) {
        yenihatalar[alan] = "Bu alan zorunlu";
      }
    }
    setAdimHatalari(yenihatalar);
    if (Object.keys(yenihatalar).length === 0) {
      setAdim((a) => Math.min(a + 1, ADIMLAR.length - 1));
    }
  }

  function geriGit() {
    setAdim((a) => Math.max(a - 1, 0));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (adim < ADIMLAR.length - 1) return;

    const parsed = yeniProjeSchema.safeParse(form);
    if (!parsed.success) {
      setHata(parsed.error.issues[0]?.message ?? "Geçersiz form verisi");
      return;
    }

    setGonderiliyor(true);
    setHata(null);
    try {
      const res = await fetch(
        "/api/proje-takip/create",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Kayıt oluşturulamadı");
      router.push(`/proje-takip/${data.projeNo}`);
    } catch (err) {
      setHata(err instanceof Error ? err.message : "Bilinmeyen hata");
      setGonderiliyor(false);
    }
  }

  const AktifIcon = ADIMLAR[adim].icon;

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="flex items-center gap-2 mb-6">
        {ADIMLAR.map((a, i) => (
          <div
            key={a.key}
            className="flex-1 h-1.5 rounded-full"
            style={{ backgroundColor: i <= adim ? ANA_RENK : "#E5E7EB" }}
          />
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <AktifIcon className="w-5 h-5" style={{ color: ANA_RENK }} />
          <CardTitle style={{ color: ANA_RENK }}>{ADIMLAR[adim].baslik}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {adim === 0 && (
              <>
                <div>
                  <label className="text-sm font-medium">Müşteri Firma *</label>
                  <Input
                    value={form.musteriFirma ?? ""}
                    onChange={(e) => setField("musteriFirma", e.target.value)}
                    placeholder="Örn: TÜRK TRAKTÖR"
                  />
                  {adimHatalari.musteriFirma && (
                    <p className="text-sm text-red-500">{adimHatalari.musteriFirma}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Müşteri Yetkilisi</label>
                  <Input
                    value={form.musteriYetkilisi ?? ""}
                    onChange={(e) => setField("musteriYetkilisi", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Müşteri Kodu</label>
                  <Input
                    value={form.musteriKod ?? ""}
                    onChange={(e) => setField("musteriKod", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Grup Kod</label>
                  <Input
                    value={form.grupKod ?? ""}
                    onChange={(e) => setField("grupKod", e.target.value)}
                    placeholder="Örn: 200-El Kumanda Sistemleri"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Kategori</label>
                  <Input
                    value={form.kategori ?? ""}
                    onChange={(e) => setField("kategori", e.target.value)}
                    placeholder="Proje / Müşteri / İleri / Offtheshelf"
                  />
                </div>
              </>
            )}

            {adim === 1 && (
              <>
                <div>
                  <label className="text-sm font-medium">İleri Tanım (Ürün Adı) *</label>
                  <Input
                    value={form.ileriTanim ?? ""}
                    onChange={(e) => setField("ileriTanim", e.target.value)}
                  />
                  {adimHatalari.ileriTanim && (
                    <p className="text-sm text-red-500">{adimHatalari.ileriTanim}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">İleri Kod</label>
                  <Input
                    value={form.ileriKod ?? ""}
                    onChange={(e) => setField("ileriKod", e.target.value)}
                    placeholder="Mühendislik atayabilir, boş kalabilir"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">RFP No</label>
                  <Input
                    value={form.rfpNo ?? ""}
                    onChange={(e) => setField("rfpNo", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">RFP Tarih</label>
                  <Input
                    type="date"
                    value={form.rfpTarih ?? ""}
                    onChange={(e) => setField("rfpTarih", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    RFP açılış haftası bu tarihten otomatik hesaplanır.
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Yıl</label>
                  <Input
                    type="number"
                    value={form.yil ?? ""}
                    onChange={(e) => setField("yil", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Kalıp/Fikstür</label>
                  <Select onValueChange={(v) => setField("kalipFikstur", v)}>
                    <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KALIP_YOK">KALIP YOK</SelectItem>
                      <SelectItem value="MUSTERI">MÜSTERİ</SelectItem>
                      <SelectItem value="ILERI">İLERİ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Kalıp Kodu</label>
                  <Input
                    value={form.kalipKodu ?? ""}
                    onChange={(e) => setField("kalipKodu", e.target.value)}
                  />
                </div>
              </>
            )}

            {adim === 2 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Yıllık Adet</label>
                    <Input
                      type="number"
                      value={form.yillikAdet ?? ""}
                      onChange={(e) => setField("yillikAdet", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Minimum Sip. Miktarı</label>
                    <Input
                      type="number"
                      value={form.minimumSipMiktari ?? ""}
                      onChange={(e) => setField("minimumSipMiktari", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Numune Adedi</label>
                  <Input
                    value={form.numuneAdedi ?? ""}
                    onChange={(e) => setField("numuneAdedi", e.target.value)}
                    placeholder="Sayı veya TBD"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Prototip Fiyatı</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.prototipFiyati ?? ""}
                      onChange={(e) => setField("prototipFiyati", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Para Birimi</label>
                    <Select onValueChange={(v) => setField("prototipParaBirimi", v)}>
                      <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="TRY">TRY</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">NRE</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.nre ?? ""}
                      onChange={(e) => setField("nre", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">NRE Para Birimi</label>
                    <Select onValueChange={(v) => setField("nreParaBirimi", v)}>
                      <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="TRY">TRY</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {adim === 3 && (
              <>
                <div>
                  <label className="text-sm font-medium">Proje Kalıp-Fikstür Notu</label>
                  <Textarea
                    value={form.projeKalipFikstur ?? ""}
                    onChange={(e) => setField("projeKalipFikstur", e.target.value)}
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Proje Bilgisi</label>
                  <Textarea
                    value={form.projeBilgisi ?? ""}
                    onChange={(e) => setField("projeBilgisi", e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="rounded-md bg-muted p-3 text-sm">
                  <p><strong>Müşteri:</strong> {form.musteriFirma || "-"}</p>
                  <p><strong>Ürün:</strong> {form.ileriTanim || "-"}</p>
                  <p className="text-muted-foreground mt-1">
                    Kaydet'e bastığında mühendisliğe otomatik bildirim ve
                    e-posta gönderilecek.
                  </p>
                </div>
                {hata && <p className="text-sm text-red-500">{hata}</p>}
              </>
            )}

            <div className="flex justify-between pt-4">
              <Button type="button" variant="outline" onClick={geriGit} disabled={adim === 0}>
                Geri
              </Button>
              {adim < ADIMLAR.length - 1 ? (
                <Button type="button" onClick={ileriGit} style={{ backgroundColor: ANA_RENK }}>
                  İleri
                </Button>
              ) : (
                <Button type="submit" disabled={gonderiliyor} style={{ backgroundColor: ANA_RENK }}>
                  {gonderiliyor ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

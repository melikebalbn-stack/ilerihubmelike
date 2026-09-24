"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar, Truck, Coins, Hash } from "lucide-react";
import {
  muhendislikDoldurSchema,
  type MuhendislikDoldurValues,
} from "@/app/api/proje-takip/_lib/muhendislik-schema";

const ANA_RENK = "#1B4F72";

const ADIMLAR = [
  { key: "termin", baslik: "Termin & PO", icon: Calendar },
  { key: "sevkiyat", baslik: "Sevkiyat & Onay", icon: Truck },
  { key: "fiyat", baslik: "Fiyat & Kick-off", icon: Coins },
  { key: "hafta", baslik: "CW / Yıl Bilgileri", icon: Hash },
] as const;

type ProjeOzet = {
  id: string;
  projeNo: string;
  ileriTanim: string;
  musteriFirma: string;
  ileriKod: string | null;
};

type FormState = Partial<Record<keyof MuhendislikDoldurValues, string>>;

export function MuhendislikDoldurForm({ proje }: { proje: ProjeOzet }) {
  const router = useRouter();
  const [adim, setAdim] = useState(0);
  const [values, setValues] = useState<FormState>({
    ileriKod: proje.ileriKod ?? "",
  });
  const [hatalar, setHatalar] = useState<Record<string, string>>({});
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [genelHata, setGenelHata] = useState<string | null>(null);

  function alanGuncelle(key: keyof MuhendislikDoldurValues, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function ileriGit() {
    setAdim((a) => Math.min(a + 1, ADIMLAR.length - 1));
  }
  function geriGit() {
    setAdim((a) => Math.max(a - 1, 0));
  }

  async function kaydet() {
    setGenelHata(null);
    const sonuc = muhendislikDoldurSchema.safeParse(values);
    if (!sonuc.success) {
      const alanHatalari: Record<string, string> = {};
      sonuc.error.issues.forEach((i) => {
        alanHatalari[i.path[0] as string] = i.message;
      });
      setHatalar(alanHatalari);
      return;
    }

    setGonderiliyor(true);
    try {
      const res = await fetch(
        `/api/proje-takip/${proje.id}/muhendislik`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sonuc.data),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Kayıt güncellenemedi");
      router.push("/proje-takip/muhendislik");
    } catch (e) {
      setGenelHata(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setGonderiliyor(false);
    }
  }

  const AktifIcon = ADIMLAR[adim].icon;

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">{proje.projeNo}</p>
        <h1 className="text-lg font-semibold">{proje.ileriTanim} — {proje.musteriFirma}</h1>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {ADIMLAR.map((a, i) => (
          <div key={a.key} className="flex-1 h-1.5 rounded-full"
            style={{ backgroundColor: i <= adim ? ANA_RENK : "#E5E7EB" }} />
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <AktifIcon className="w-5 h-5" style={{ color: ANA_RENK }} />
          <CardTitle style={{ color: ANA_RENK }}>{ADIMLAR[adim].baslik}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {adim === 0 && (
            <>
              <div>
                <label className="text-sm font-medium">İleri Kod</label>
                <Input value={values.ileriKod ?? ""} onChange={(e) => alanGuncelle("ileriKod", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Termin/Proje Tarihi</label>
                  <Input type="date" value={values.terminProjeTrh ?? ""} onChange={(e) => alanGuncelle("terminProjeTrh", e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium">Revize Termin Tarihi</label>
                  <Input type="date" value={values.revizeTerminTrh ?? ""} onChange={(e) => alanGuncelle("revizeTerminTrh", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">PO Numarası</label>
                <Input value={values.poNumarasi ?? ""} onChange={(e) => alanGuncelle("poNumarasi", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Proje Durum Tipi</label>
                <Select onValueChange={(v) => alanGuncelle("projeDurumTipi", v)}>
                  <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NUMUNE">NUMUNE</SelectItem>
                    <SelectItem value="PROTOTYPE">PROTOTYPE</SelectItem>
                    <SelectItem value="SERI">SERİ</SelectItem>
                    <SelectItem value="PPAP">PPAP</SelectItem>
                    <SelectItem value="TASARIM">TASARIM</SelectItem>
                    <SelectItem value="YENIDEN_PPAP">Yeniden PPAP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {adim === 1 && (
            <>
              <div>
                <label className="text-sm font-medium">Sevkiyat Tarihi</label>
                <Input type="date" value={values.sevkiyatTrh ?? ""} onChange={(e) => alanGuncelle("sevkiyatTrh", e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Sevkiyat yılı/haftası bu tarihten otomatik hesaplanır.</p>
              </div>
              <div>
                <label className="text-sm font-medium">Onay Tarihi</label>
                <Input type="date" value={values.onayTrh ?? ""} onChange={(e) => alanGuncelle("onayTrh", e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Onay yılı/haftası bu tarihten otomatik hesaplanır.</p>
              </div>
              <div>
                <label className="text-sm font-medium">Lokasyon</label>
                <Input value={values.lokasyon ?? ""} onChange={(e) => alanGuncelle("lokasyon", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Açıklama</label>
                <Textarea rows={3} value={values.aciklama ?? ""} onChange={(e) => alanGuncelle("aciklama", e.target.value)} />
              </div>
            </>
          )}

          {adim === 2 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Birim Fiyat</label>
                  <Input type="number" step="0.01" value={values.birimFiyat ?? ""} onChange={(e) => alanGuncelle("birimFiyat", e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium">Para Birimi</label>
                  <Select onValueChange={(v) => alanGuncelle("birimFiyatParaBirimi", v)}>
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
                  <label className="text-sm font-medium">Hedef/Yıllık</label>
                  <Input type="number" value={values.hedefYillik ?? ""} onChange={(e) => alanGuncelle("hedefYillik", e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium">Kalıp Tutar</label>
                  <Input type="number" value={values.kalipTutar ?? ""} onChange={(e) => alanGuncelle("kalipTutar", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Kick Off/Statü</label>
                  <Input value={values.kickOffStatu ?? ""} onChange={(e) => alanGuncelle("kickOffStatu", e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium">PO Kalıp</label>
                  <Input value={values.poKalip ?? ""} onChange={(e) => alanGuncelle("poKalip", e.target.value)} />
                </div>
              </div>
            </>
          )}

          {adim === 3 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Kickoff CW / Yıl</label>
                  <div className="flex gap-2">
                    <Input type="number" placeholder="CW" value={values.kickoffCW ?? ""} onChange={(e) => alanGuncelle("kickoffCW", e.target.value)} />
                    <Input type="number" placeholder="Yıl" value={values.kickoffYil ?? ""} onChange={(e) => alanGuncelle("kickoffYil", e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">İsteme Trh CW / Yıl</label>
                  <div className="flex gap-2">
                    <Input type="number" placeholder="CW" value={values.istemeTrhCW ?? ""} onChange={(e) => alanGuncelle("istemeTrhCW", e.target.value)} />
                    <Input type="number" placeholder="Yıl" value={values.istemeTrhYil ?? ""} onChange={(e) => alanGuncelle("istemeTrhYil", e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Sevk Trh CW / Yıl</label>
                  <div className="flex gap-2">
                    <Input type="number" placeholder="CW" value={values.sevkTrhCW ?? ""} onChange={(e) => alanGuncelle("sevkTrhCW", e.target.value)} />
                    <Input type="number" placeholder="Yıl" value={values.sevkYil ?? ""} onChange={(e) => alanGuncelle("sevkYil", e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">PO Trh CW / Yıl</label>
                  <div className="flex gap-2">
                    <Input type="number" placeholder="CW" value={values.poTrhCW ?? ""} onChange={(e) => alanGuncelle("poTrhCW", e.target.value)} />
                    <Input type="number" placeholder="Yıl" value={values.poYil ?? ""} onChange={(e) => alanGuncelle("poYil", e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">PO Öng. CW / Yıl</label>
                  <div className="flex gap-2">
                    <Input type="number" placeholder="CW" value={values.poOngCW ?? ""} onChange={(e) => alanGuncelle("poOngCW", e.target.value)} />
                    <Input type="number" placeholder="Yıl" value={values.poOngYil ?? ""} onChange={(e) => alanGuncelle("poOngYil", e.target.value)} />
                  </div>
                </div>
              </div>
              {genelHata && <p className="text-sm text-red-500">{genelHata}</p>}
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
              <Button type="button" onClick={kaydet} disabled={gonderiliyor} style={{ backgroundColor: ANA_RENK }}>
                {gonderiliyor ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  projeDetaySchema,
  type ProjeDetayValues,
} from "@/app/api/proje-takip/_lib/proje-detay-schema";
import { DURUM_DEGERLERI } from "@/app/api/proje-takip/_lib/sabitler";
import type { MuhendislikKisi } from "@/app/api/proje-takip/_lib/muhendislik-ekibi";
import {
  PROJE_FIYAT_ALANLARI,
  type ProjeFiyatAlani,
} from "@/lib/proje-takip/can-see-fiyat";
import type { ProjeTakip } from "@/generated/prisma";

const ANA_RENK = "#1B4F72";

type FormState = Partial<Record<keyof ProjeDetayValues, string>>;

// /api/proje-takip/musteri-kontrol cevabı (ifs-musteri.ts server-only olduğu için
// tip burada ayrıca tanımlı). KONTROL_EDILEMEDI = IFS'e ulaşılamadı, "yok" DEĞİL.
type IfsMusteri = { customerId: string; name: string };
type MusteriKontrol =
  | { durum: "BOS" }
  | { durum: "KONTROL" }
  | { durum: "VAR"; eslesenler: IfsMusteri[] }
  | { durum: "YOK"; benzerler: IfsMusteri[] }
  | { durum: "KONTROL_EDILEMEDI" };

// canSeeFiyat false ise sayfa fiyat alanlarını objeden çıkarıp gönderiyor.
type ProjeDetayProje = Omit<ProjeTakip, ProjeFiyatAlani> &
  Partial<Pick<ProjeTakip, ProjeFiyatAlani>>;

function tarihStr(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

function sayiStr(n: { toString(): string } | number | null | undefined): string {
  return n === null || n === undefined ? "" : String(n);
}

function baslangicDegerleri(proje: ProjeDetayProje | null): FormState {
  if (!proje) {
    return { yil: String(new Date().getFullYear()) };
  }
  return {
    musteriFirma: proje.musteriFirma,
    musteriYetkilisi: proje.musteriYetkilisi ?? "",
    musteriKod: proje.musteriKod ?? "",
    ileriTanim: proje.ileriTanim,
    ileriKod: proje.ileriKod ?? "",
    grupKod: proje.grupKod ?? "",
    kategori: proje.kategori ?? "",
    kalipFikstur: proje.kalipFikstur ?? "",
    kalipKodu: proje.kalipKodu ?? "",
    yillikAdet: sayiStr(proje.yillikAdet),
    minimumSipMiktari: sayiStr(proje.minimumSipMiktari),
    numuneAdedi: proje.numuneAdedi ?? "",
    rfpNo: proje.rfpNo ?? "",
    rfpTarih: tarihStr(proje.rfpTarih),
    yil: sayiStr(proje.yil),
    projeKalipFikstur: proje.projeKalipFikstur ?? "",
    projeBilgisi: proje.projeBilgisi ?? "",

    revizeTerminTrh: tarihStr(proje.revizeTerminTrh),
    terminProjeTrh: tarihStr(proje.terminProjeTrh),
    poNumarasi: proje.poNumarasi ?? "",
    projeDurumTipi: proje.projeDurumTipi ?? "",
    sevkiyatTrh: tarihStr(proje.sevkiyatTrh),
    onayTrh: tarihStr(proje.onayTrh),
    aciklama: proje.aciklama ?? "",
    lokasyon: proje.lokasyon ?? "",
    birimFiyat: sayiStr(proje.birimFiyat),
    birimFiyatParaBirimi: proje.birimFiyatParaBirimi ?? "",
    hedefYillik: sayiStr(proje.hedefYillik),
    kalipTutar: sayiStr(proje.kalipTutar),
    kickOffStatu: proje.kickOffStatu ?? "",
    poKalip: proje.poKalip ?? "",
    prototipFiyati: sayiStr(proje.prototipFiyati),
    prototipParaBirimi: proje.prototipParaBirimi ?? "",
    nre: sayiStr(proje.nre),
    nreParaBirimi: proje.nreParaBirimi ?? "",

    kickoffCW: sayiStr(proje.kickoffCW),
    kickoffYil: sayiStr(proje.kickoffYil),
    istemeTrhCW: sayiStr(proje.istemeTrhCW),
    istemeTrhYil: sayiStr(proje.istemeTrhYil),
    sevkTrhCW: sayiStr(proje.sevkTrhCW),
    sevkYil: sayiStr(proje.sevkYil),
    poTrhCW: sayiStr(proje.poTrhCW),
    poYil: sayiStr(proje.poYil),
    poOngCW: sayiStr(proje.poOngCW),
    poOngYil: sayiStr(proje.poOngYil),

    muhendislikSorumluId: proje.muhendislikSorumluId ?? "",
    durum: proje.durum,
  };
}

export function ProjeDetayForm({
  proje,
  projeSorumlusuAdi,
  muhendisler,
  canSeeFiyat,
}: {
  proje: ProjeDetayProje | null;
  projeSorumlusuAdi: string;
  muhendisler: MuhendislikKisi[];
  canSeeFiyat: boolean;
}) {
  const router = useRouter();
  const yeniMi = proje === null;
  const [values, setValues] = useState<FormState>(() => baslangicDegerleri(proje));
  const [hatalar, setHatalar] = useState<Record<string, string>>({});
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [genelHata, setGenelHata] = useState<string | null>(null);
  const [kaydedildi, setKaydedildi] = useState(false);
  const [bildirimGonderiliyor, setBildirimGonderiliyor] = useState(false);
  const [bildirimSonuc, setBildirimSonuc] = useState<string | null>(null);
  const [tamamlaniyor, setTamamlaniyor] = useState(false);
  const [muhendislikDurumu, setMuhendislikDurumu] = useState(proje?.muhendislikDoldurmaDurumu ?? "BEKLIYOR");
  const [musteriKontrol, setMusteriKontrol] = useState<MusteriKontrol>({ durum: "BOS" });
  const sonKontrolEdilen = useRef("");
  const [satisaBildiriliyor, setSatisaBildiriliyor] = useState(false);
  const [satisaBildirildi, setSatisaBildirildi] = useState(false);
  const [satisaBildirHata, setSatisaBildirHata] = useState<string | null>(null);

  function alanGuncelle(key: keyof ProjeDetayValues, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setKaydedildi(false);
  }

  function musteriKontrolSifirla() {
    sonKontrolEdilen.current = "";
    setMusteriKontrol({ durum: "BOS" });
    setSatisaBildirildi(false);
    setSatisaBildirHata(null);
  }

  // Yeni Proje: Müşteri Firma alanından çıkılınca IFS'te var mı kontrol edilir.
  // Değer ad ya da CustomerId olabilir (sunucu önce kodda tam eşleşme dener).
  async function musteriKontrolEt() {
    const deger = (values.musteriFirma ?? "").trim();
    if (!deger) {
      musteriKontrolSifirla();
      return;
    }
    if (deger === sonKontrolEdilen.current) return;
    sonKontrolEdilen.current = deger;
    setMusteriKontrol({ durum: "KONTROL" });
    setSatisaBildirildi(false);
    setSatisaBildirHata(null);

    let sonuc: MusteriKontrol;
    try {
      const res = await fetch(`/api/proje-takip/musteri-kontrol?ad=${encodeURIComponent(deger)}`);
      const data = await res.json();
      sonuc = res.ok && (data?.durum === "VAR" || data?.durum === "YOK")
        ? data
        : { durum: "KONTROL_EDILEMEDI" };
    } catch {
      sonuc = { durum: "KONTROL_EDILEMEDI" };
    }
    // Cevap gelene kadar alan değiştiyse eski sonucu gösterme.
    if (sonKontrolEdilen.current === deger) setMusteriKontrol(sonuc);
  }

  async function satisaBildir() {
    const musteriFirma = sonKontrolEdilen.current;
    if (!musteriFirma) return;
    setSatisaBildirHata(null);
    setSatisaBildiriliyor(true);
    try {
      const res = await fetch("/api/proje-takip/musteri-bildir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ musteriFirma }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Bildirim gönderilemedi");
      setSatisaBildirildi(true);
    } catch (e) {
      setSatisaBildirHata(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setSatisaBildiriliyor(false);
    }
  }

  async function kaydet() {
    setGenelHata(null);
    setKaydedildi(false);
    const sonuc = projeDetaySchema.safeParse(values);
    if (!sonuc.success) {
      const alanHatalari: Record<string, string> = {};
      sonuc.error.issues.forEach((i) => {
        alanHatalari[i.path[0] as string] = i.message;
      });
      setHatalar(alanHatalari);
      return;
    }
    setHatalar({});

    // canSeeFiyat=false ise fiyat alanları hiç gönderilmez - form onları zaten
    // göstermiyor, sunucu da yok sayıyor; payload'a da sızmasın.
    const gonderilecek: Partial<ProjeDetayValues> = { ...sonuc.data };
    if (!canSeeFiyat) {
      for (const alan of PROJE_FIYAT_ALANLARI) delete gonderilecek[alan];
    }

    setGonderiliyor(true);
    try {
      if (yeniMi) {
        const res = await fetch("/api/proje-takip/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(gonderilecek),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Kayıt oluşturulamadı");
        router.push(`/proje-takip/${data.projeNo}`);
        return;
      }

      const res = await fetch(`/api/proje-takip/${proje.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gonderilecek),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Kayıt güncellenemedi");
      setKaydedildi(true);
      router.refresh();
    } catch (e) {
      setGenelHata(e instanceof Error ? e.message : "Bilinmeyen hata");
      setGonderiliyor(false);
      return;
    }
    setGonderiliyor(false);
  }

  // Kaydet'ten bağımsız: son kaydedilmiş (DB'deki) proje verisiyle bildirimi
  // yeniden/manuel tetikler. Bu ekrandaki kaydedilmemiş değişiklikleri kullanmaz.
  async function bildirimGonder() {
    if (!proje) return;
    setBildirimSonuc(null);
    setBildirimGonderiliyor(true);
    try {
      const res = await fetch(`/api/proje-takip/${proje.id}/bildirim-gonder`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Bildirim gönderilemedi");
      setBildirimSonuc("Bildirim gönderildi.");
    } catch (e) {
      setBildirimSonuc(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setBildirimGonderiliyor(false);
    }
  }

  async function muhendislikTamamla() {
    if (!proje) return;
    setTamamlaniyor(true);
    try {
      const res = await fetch(`/api/proje-takip/${proje.id}/tamamla`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "İşlem yapılamadı");
      setMuhendislikDurumu("TAMAMLANDI");
      router.refresh();
    } catch (e) {
      setGenelHata(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setTamamlaniyor(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div>
          {yeniMi ? (
            <h1 className="text-xl font-semibold" style={{ color: ANA_RENK }}>Yeni Proje Aç</h1>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{proje.projeNo}</p>
              <h1 className="text-xl font-semibold" style={{ color: ANA_RENK }}>
                {proje.ileriTanim}
              </h1>
            </>
          )}
        </div>
        <div className="flex items-end gap-3">
          {!yeniMi && (
            <Badge variant="outline" className={muhendislikDurumu === "TAMAMLANDI" ? "text-emerald-600" : "text-amber-600"}>
              {muhendislikDurumu === "TAMAMLANDI" ? "✓ Tamamlandı" : "⏳ Mühendisliği Bekliyor"}
            </Badge>
          )}
          {!yeniMi && (
            <div className="w-full md:w-56">
              <label className="text-sm font-medium">Durum</label>
              <Select value={values.durum} onValueChange={(v) => alanGuncelle("durum", v)}>
                <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                <SelectContent>
                  {DURUM_DEGERLERI.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle style={{ color: ANA_RENK }}>Proje Bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Müşteri Firma</label>
              <Input
                value={values.musteriFirma ?? ""}
                onChange={(e) => {
                  alanGuncelle("musteriFirma", e.target.value);
                  if (yeniMi) musteriKontrolSifirla();
                }}
                onBlur={yeniMi ? musteriKontrolEt : undefined}
              />
              {hatalar.musteriFirma && <p className="text-sm text-red-500">{hatalar.musteriFirma}</p>}
              {yeniMi && musteriKontrol.durum === "KONTROL" && (
                <p className="text-xs text-muted-foreground mt-1">IFS'te kontrol ediliyor...</p>
              )}
              {yeniMi && musteriKontrol.durum === "VAR" && (
                <p className="text-xs text-emerald-600 mt-1">
                  ✓ IFS'te kayıtlı: {musteriKontrol.eslesenler.map((m) => `${m.customerId} — ${m.name}`).join(", ")}
                </p>
              )}
              {yeniMi && musteriKontrol.durum === "KONTROL_EDILEMEDI" && (
                <p className="text-xs text-muted-foreground mt-1">IFS müşteri kontrolü şu an yapılamadı.</p>
              )}
              {yeniMi && musteriKontrol.durum === "YOK" && (
                <div className="mt-2 space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs text-amber-700">Bu müşteri IFS'te birebir eşleşmedi.</p>
                  {musteriKontrol.benzerler.length > 0 && (
                    <div>
                      <p className="text-xs font-medium">Benzer IFS kayıtları:</p>
                      <ul className="text-xs text-muted-foreground list-disc pl-4">
                        {musteriKontrol.benzerler.map((m) => (
                          <li key={m.customerId}>{m.customerId} — {m.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={satisaBildir}
                      disabled={satisaBildiriliyor || satisaBildirildi}
                    >
                      {satisaBildiriliyor ? "Gönderiliyor..." : satisaBildirildi ? "Bildirildi" : "Satışa Bildir"}
                    </Button>
                    {satisaBildirildi && (
                      <span className="text-xs text-emerald-600">IFS'te müşteri açılması için bildirim gönderildi.</span>
                    )}
                    {satisaBildirHata && <span className="text-xs text-red-500">{satisaBildirHata}</span>}
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Müşteri Yetkilisi</label>
              <Input value={values.musteriYetkilisi ?? ""} onChange={(e) => alanGuncelle("musteriYetkilisi", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Müşteri Kodu</label>
              <Input value={values.musteriKod ?? ""} onChange={(e) => alanGuncelle("musteriKod", e.target.value)} />
            </div>
            {!yeniMi && (
              <div>
                <label className="text-sm font-medium">Proje Sorumlusu</label>
                <p className="text-sm py-2">{projeSorumlusuAdi}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">İleri Tanım (Ürün Adı)</label>
              <Input value={values.ileriTanim ?? ""} onChange={(e) => alanGuncelle("ileriTanim", e.target.value)} />
              {hatalar.ileriTanim && <p className="text-sm text-red-500">{hatalar.ileriTanim}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">İleri Kod</label>
              <Input value={values.ileriKod ?? ""} onChange={(e) => alanGuncelle("ileriKod", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Grup Kod</label>
              <Input value={values.grupKod ?? ""} onChange={(e) => alanGuncelle("grupKod", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Kategori</label>
              <Input value={values.kategori ?? ""} onChange={(e) => alanGuncelle("kategori", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Kalıp/Fikstür</label>
              <Select value={values.kalipFikstur} onValueChange={(v) => alanGuncelle("kalipFikstur", v)}>
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
              <Input value={values.kalipKodu ?? ""} onChange={(e) => alanGuncelle("kalipKodu", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Yıllık Adet</label>
                <Input type="number" value={values.yillikAdet ?? ""} onChange={(e) => alanGuncelle("yillikAdet", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Min. Sip. Miktarı</label>
                <Input type="number" value={values.minimumSipMiktari ?? ""} onChange={(e) => alanGuncelle("minimumSipMiktari", e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Numune Adedi</label>
              <Input value={values.numuneAdedi ?? ""} onChange={(e) => alanGuncelle("numuneAdedi", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">RFP No</label>
              <Input value={values.rfpNo ?? ""} onChange={(e) => alanGuncelle("rfpNo", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">RFP Tarih</label>
              <Input type="date" value={values.rfpTarih ?? ""} onChange={(e) => alanGuncelle("rfpTarih", e.target.value)} />
              {!yeniMi && (
                <p className="text-xs text-muted-foreground mt-1">
                  RFP Açılış Hafta: {proje.rfpAcilisHafta ?? "—"} (otomatik hesaplanır)
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Yıl</label>
              <Input type="number" value={values.yil ?? ""} onChange={(e) => alanGuncelle("yil", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Proje Kalıp-Fikstür Notu</label>
              <Textarea rows={3} value={values.projeKalipFikstur ?? ""} onChange={(e) => alanGuncelle("projeKalipFikstur", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Proje Bilgisi</label>
              <Textarea rows={3} value={values.projeBilgisi ?? ""} onChange={(e) => alanGuncelle("projeBilgisi", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-6">
            <div>
              <label className="text-sm font-medium">Sorumlu Mühendis</label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Select value={values.muhendislikSorumluId} onValueChange={(v) => alanGuncelle("muhendislikSorumluId", v)}>
                    <SelectTrigger><SelectValue placeholder="— Sorumlu Mühendis —" /></SelectTrigger>
                    <SelectContent>
                      {muhendisler.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name ?? m.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!yeniMi && (
                  <Button type="button" variant="outline" size="sm" onClick={bildirimGonder} disabled={bildirimGonderiliyor}>
                    {bildirimGonderiliyor ? "Gönderiliyor..." : "Bildirim Gönder"}
                  </Button>
                )}
              </div>
              {bildirimSonuc && <p className="text-xs text-muted-foreground mt-1">{bildirimSonuc}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Revize Termin Tarihi</label>
                <Input type="date" value={values.revizeTerminTrh ?? ""} onChange={(e) => alanGuncelle("revizeTerminTrh", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Termin/Proje Tarihi</label>
                <Input type="date" value={values.terminProjeTrh ?? ""} onChange={(e) => alanGuncelle("terminProjeTrh", e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">PO Numarası</label>
              <Input value={values.poNumarasi ?? ""} onChange={(e) => alanGuncelle("poNumarasi", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Proje Durum Tipi</label>
              <Select value={values.projeDurumTipi} onValueChange={(v) => alanGuncelle("projeDurumTipi", v)}>
                <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NUMUNE">NUMUNE</SelectItem>
                  <SelectItem value="PROTOTYPE">PROTOTYPE</SelectItem>
                  <SelectItem value="SERI">SERİ</SelectItem>
                  <SelectItem value="PPAP">PPAP</SelectItem>
                  <SelectItem value="TASARIM">TASARIM</SelectItem>
                  <SelectItem value="REVIZYON">REVİZYON</SelectItem>
                  <SelectItem value="YENIDEN_PPAP">Yeniden PPAP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Sevkiyat Tarihi</label>
              <Input type="date" value={values.sevkiyatTrh ?? ""} onChange={(e) => alanGuncelle("sevkiyatTrh", e.target.value)} />
              {!yeniMi && (
                <p className="text-xs text-muted-foreground mt-1">
                  Yıl/Hafta: {proje.sevkiyatYil ?? "—"} / {proje.sevkiyatHafta ?? "—"} (otomatik hesaplanır)
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Onay Tarihi</label>
              <Input type="date" value={values.onayTrh ?? ""} onChange={(e) => alanGuncelle("onayTrh", e.target.value)} />
              {!yeniMi && (
                <p className="text-xs text-muted-foreground mt-1">
                  Yıl/Hafta: {proje.onayYil ?? "—"} / {proje.onayHafta ?? "—"} (otomatik hesaplanır)
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Açıklama</label>
              <Textarea rows={3} value={values.aciklama ?? ""} onChange={(e) => alanGuncelle("aciklama", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Lokasyon</label>
              <Input value={values.lokasyon ?? ""} onChange={(e) => alanGuncelle("lokasyon", e.target.value)} />
            </div>
            {canSeeFiyat && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Birim Fiyat</label>
                    <Input type="number" step="0.01" value={values.birimFiyat ?? ""} onChange={(e) => alanGuncelle("birimFiyat", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Para Birimi</label>
                    <Select value={values.birimFiyatParaBirimi} onValueChange={(v) => alanGuncelle("birimFiyatParaBirimi", v)}>
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
              </>
            )}
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
            {canSeeFiyat && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Prototip Fiyatı</label>
                    <Input type="number" step="0.01" value={values.prototipFiyati ?? ""} onChange={(e) => alanGuncelle("prototipFiyati", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Para Birimi</label>
                    <Select value={values.prototipParaBirimi} onValueChange={(v) => alanGuncelle("prototipParaBirimi", v)}>
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
                    <Input type="number" step="0.01" value={values.nre ?? ""} onChange={(e) => alanGuncelle("nre", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">NRE Para Birimi</label>
                    <Select value={values.nreParaBirimi} onValueChange={(v) => alanGuncelle("nreParaBirimi", v)}>
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
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-end gap-3 mt-6">
        {!yeniMi && muhendislikDurumu === "BEKLIYOR" && (
          <Button type="button" variant="outline" onClick={muhendislikTamamla} disabled={tamamlaniyor}>
            {tamamlaniyor ? "İşleniyor..." : "Mühendislik Girişini Tamamla"}
          </Button>
        )}
        {kaydedildi && <p className="text-sm text-emerald-600">Kaydedildi.</p>}
        {genelHata && <p className="text-sm text-red-500">{genelHata}</p>}
        <Button type="button" onClick={kaydet} disabled={gonderiliyor} style={{ backgroundColor: ANA_RENK }}>
          {gonderiliyor
            ? "Kaydediliyor..."
            : yeniMi ? "Kaydet ve Mühendisliğe Gönder" : "Kaydet"}
        </Button>
      </div>
    </div>
  );
}

"use client";

/**
 * ════════════════════════════════════════════════════════════════════════
 *  İŞ ANALİZİ FORMU — v6
 *  Konum: (dashboard)/strategic-hr/is-analizi/IsAnaliziWizard.tsx
 *
 *  v6 eklentileri:
 *   - Açılış ekranında "Önceki İş Analizlerim" (loglarim API, güncel haller).
 *   - Revizyon modu: REVIZE_ISTENDI form "Düzelt" → revize-cek API'den dolu gelir.
 *   - gonder(): oncekiVersiyonId taşınır (revizyonsa yeni versiyon oluşur).
 * ════════════════════════════════════════════════════════════════════════
 */

import { useMemo, useState, useEffect } from "react";
import {
  ListChecks, Gauge, GitBranch, Users, Shuffle, Lightbulb, ClipboardCheck,
  Plus, Trash2, Check, ChevronLeft, ChevronRight, Send, AlertTriangle, Download, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const BRAND = "#1B4F72";

const ICON_MAP: Record<string, LucideIcon> = {
  list: ListChecks, gauge: Gauge, branch: GitBranch,
  users: Users, shuffle: Shuffle, bulb: Lightbulb, clipboard: ClipboardCheck,
};
function StepIcon({ name, className }: { name?: string; className?: string }) {
  if (!name) return null;
  const Cmp = ICON_MAP[name];
  return Cmp ? <Cmp className={className} /> : null;
}

const SIKLIK = [
  { value: "GUNLUK", label: "Günlük" }, { value: "HAFTALIK", label: "Haftalık" },
  { value: "AYLIK", label: "Aylık" }, { value: "DONEMSEL", label: "Dönemsel" }, { value: "YILLIK", label: "Yıllık" },
];
const TETIKLEYICILER = ["Müşteri siparişi", "Üretim planı", "Acil/öncelikli iş", "Planlı bakım", "Stok seviyesi", "Talep/ihtiyaç", "Periyodik (rutin)", "Amir talimatı"];
const YETKI_TIPLERI = [
  { value: "TEK_BASINA", label: "Tek başıma" }, { value: "AMIR_ONAYI", label: "Amir onayı" },
  { value: "MUDUR_ONAYI", label: "Müdür onayı" }, { value: "GM_ONAYI", label: "Genel Müdür onayı" },
];
const ILISKI_TIPLERI = [
  { value: "IS_ALIR", label: "İş aldığım" }, { value: "IS_VERIR", label: "İş verdiğim" },
  { value: "RAPORLAR", label: "Raporladığım" }, { value: "KONTROL_EDEN", label: "Beni kontrol eden" },
  { value: "BIRLIKTE", label: "Birlikte çalıştığım" },
];
const ZORLUK_KONULARI = ["Sık iş değişikliği / önceliklendirme", "Makine/ekipman arızaları", "Malzeme/parça bekleme", "Bilgi/talimat eksikliği", "İş yükü dengesizliği", "Yetersiz eğitim", "Diğer"];
const SEVIYELER = [
  { value: "1", label: "1 - Gerekli değil / Bilmiyor" }, { value: "2", label: "2 - Kontrol altında" },
  { value: "3", label: "3 - Kendi başıma" }, { value: "4", label: "4 - Eğitim verebilirim" },
];

const ADIMLAR = [
  { key: "isler",     baslik: "Yaptığım İşler",         ikon: "list",      aciklama: "İşlerini ekle; her birine makine/sistem, sıklık ve zaman payı gir." },
  { key: "yetkinlik", baslik: "Yetkinliklerim",         ikon: "gauge",     aciklama: "Her yetkinlik için mevcut seviyeni seç." },
  { key: "karar",     baslik: "Karar Yetkilerim",       ikon: "branch",    aciklama: "Hangi konuda ne kadar yetkin var?" },
  { key: "iliski",    baslik: "İş İlişkilerim",         ikon: "users",     aciklama: "Doğrudan ve dolaylı ilişkilerini ekle." },
  { key: "esneklik",  baslik: "Esneklik / Yedekleme",   ikon: "shuffle",   aciklama: "Yapabildiğin diğer işler — norm kadro için önemli." },
  { key: "oneri",     baslik: "İyileştirme Önerilerim", ikon: "bulb",      aciklama: "İşini zorlaştıran konu ve önerin." },
  { key: "ozet",      baslik: "Özet ve Onaya Gönder",   ikon: "clipboard", aciklama: "Bilgilerini kontrol et ve amirine gönder." },
];

const DURUM_ETIKET: Record<string, { label: string; renk: string; bg: string }> = {
  TASLAK:            { label: "Taslak",          renk: "#64748b", bg: "#f1f5f9" },
  AMIR_ONAYINDA:     { label: "Amir onayında",   renk: "#1B4F72", bg: "#1B4F7214" },
  IK_INCELEMESINDE:  { label: "İK incelemesinde", renk: "#7c3aed", bg: "#7c3aed14" },
  ONAYLANDI:         { label: "Onaylandı",       renk: "#15803d", bg: "#15803d14" },
  REVIZE_ISTENDI:    { label: "Revize istendi",  renk: "#b45309", bg: "#b4530914" },
};

interface PersonelBilgi { sicilNo: string; adSoyad: string; bolum: string; gorev: string; yaka: string; amir: string; }
interface YetRef { yetkinlikId: string; ad: string; grup: string; tip: string; hedefSeviye: number; }
interface IsSatir { isAdi: string; tetikleyici: string; makineArac: string; siklik: string; zamanYuzde: number; }
interface OncekiForm {
  id: string; durum: string; versiyon: number; amirNotu: string | null;
  createdAt: string; pozisyon: { ad: string } | null;
  _count: { yapilanIsler: number; yetkinlikler: number };
}

export default function IsAnaliziWizard() {
  const [personel, setPersonel] = useState<PersonelBilgi | null>(null);
  const [pozisyonId, setPozisyonId] = useState<string | null>(null);
  const [amirPersonnelId, setAmirPersonnelId] = useState<string | null>(null);
  const [amirGuvenilir, setAmirGuvenilir] = useState(true); // false → form doğrudan İK'ya gider
  const [pozisyonBulundu, setPozisyonBulundu] = useState(true);
  const [makineler, setMakineler] = useState<string[]>([]);
  const [yetRef, setYetRef] = useState<YetRef[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);

  // Önceki formlar (loglarim)
  const [oncekiFormlar, setOncekiFormlar] = useState<OncekiForm[]>([]);

  // Revizyon
  const [oncekiVersiyonId, setOncekiVersiyonId] = useState<string | null>(null);
  const [revizeNotu, setRevizeNotu] = useState<string | null>(null);

  const [basladi, setBasladi] = useState(false);
  const [step, setStep] = useState(0);
  const [gonderildi, setGonderildi] = useState(false);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const [isler, setIsler] = useState<IsSatir[]>([]);
  const [yetSeviye, setYetSeviye] = useState<Record<string, string>>({});
  const [kararlar, setKararlar] = useState<{ konu: string; yetkiTipi: string }[]>([{ konu: "", yetkiTipi: "TEK_BASINA" }]);
  const [iliskiler, setIliskiler] = useState<{ tip: string; taraf: string }[]>([{ tip: "RAPORLAR", taraf: "" }]);
  const [iliskiYok, setIliskiYok] = useState(false);
  const [esneklikler, setEsneklikler] = useState<string[]>([""]);
  const [esneklikYok, setEsneklikYok] = useState(false);
  const [zorluk, setZorluk] = useState("");
  const [oneri, setOneri] = useState("");
  const [oneriYok, setOneriYok] = useState(false);

  // Referans + önceki formlar
  useEffect(() => {
    fetch("/api/strategic-hr/is-analizi/referans")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) { setHata(d.error ?? "Bilgiler yüklenemedi."); setYukleniyor(false); return; }
        setPersonel(d.personel);
        setPozisyonId(d.pozisyonId);
        setAmirPersonnelId(d.amirPersonnelId ?? null);
        setAmirGuvenilir(d.amirGuvenilir ?? true);
        setPozisyonBulundu(d.pozisyonBulundu);
        setMakineler(d.makineler ?? []);
        setYetRef(d.yetkinlikler ?? []);
        setYetSeviye({}); // B: varsayılan boş — kullanıcı her yetkinliğe bilinçli seçim yapmalı
        setIsler([{ isAdi: "", tetikleyici: TETIKLEYICILER[0], makineArac: (d.makineler ?? [])[0] ?? "", siklik: "GUNLUK", zamanYuzde: 0 }]);
        if (d.personel?.amir) {
          setIliskiler([{ tip: "RAPORLAR", taraf: d.personel.amir }]);
        }
        setYukleniyor(false);
      })
      .catch(() => { setHata("Sunucuya ulaşılamadı."); setYukleniyor(false); });

    // Önceki formlar (hata olsa da form açılabilir, sessiz geç)
    fetch("/api/strategic-hr/is-analizi/loglarim")
      .then(async (r) => { if (r.ok) { const d = await r.json(); setOncekiFormlar(d.formlar ?? []); } })
      .catch(() => {});
  }, []);

  // Revizyon başlat: eski formu çek, state'leri doldur
  async function revizyonBaslat(formId: string) {
    try {
      const r = await fetch(`/api/strategic-hr/is-analizi/revize-cek?id=${formId}`);
      const d = await r.json();
      if (!r.ok) { setHata(d.error ?? "Revizyon verisi alınamadı."); return; }
      const v = d.veri;
      setIsler(v.isler.length ? v.isler : [{ isAdi: "", tetikleyici: TETIKLEYICILER[0], makineArac: makineler[0] ?? "", siklik: "GUNLUK", zamanYuzde: 0 }]);
      // yetSeviye: eski form değerleri (eksikler boş kalır — B: bilinçli seçim)
      setYetSeviye(v.yetSeviye ?? {});
      setKararlar(v.kararlar);
      setIliskiler(v.iliskiler);
      setIliskiYok(v.iliskiler.filter((i: any) => i.taraf.trim()).length === 0);
      setEsneklikler(v.esneklikler);
      setEsneklikYok(v.esneklikler.filter((e: string) => e.trim()).length === 0);
      setZorluk(v.zorluk);
      setOneri(v.oneri);
      setOneriYok(!v.zorluk);
      setOncekiVersiyonId(d.oncekiVersiyonId);
      setRevizeNotu(d.amirNotu ?? null);
      setBasladi(true);
      setStep(0);
    } catch {
      setHata("Revizyon başlatılamadı.");
    }
  }

  async function oncekiFormlariAktar() {
    try {
      const r = await fetch("/api/strategic-hr/is-analizi/export?liste=calisan");
      if (!r.ok) { setHata("Excel export başarısız."); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `is-analizlerim-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setHata("Excel export sırasında hata oluştu.");
    }
  }

  const totalSteps = ADIMLAR.length;
  const progress = Math.round((step / totalSteps) * 100);
  const toplamZaman = isler.reduce((s, i) => s + (Number(i.zamanYuzde) || 0), 0);
  const aktifAdim = ADIMLAR[step];

  // Her adım için zorunluluk kontrolü (B: kritik adımlar zorunlu,
  // esneklik/iyileştirme "yok" işaretiyle geçilebilir).
  const ilerleyebilir = useMemo(() => {
    switch (aktifAdim.key) {
      case "isler":
        // En az 1 iş (isAdi dolu) + toplam zaman tam %100
        return isler.some((i) => i.isAdi.trim()) && toplamZaman === 100;
      case "yetkinlik":
        // Liste boşsa otomatik geç; doluysa hepsi seçili (varsayılan 3 zaten dolu)
        if (yetRef.length === 0) return true;
        return yetRef.every((y) => yetSeviye[y.yetkinlikId]);
      case "karar":
        return kararlar.some((k) => k.konu.trim());
      case "iliski":
        return iliskiYok || iliskiler.some((i) => i.taraf.trim());
      case "esneklik":
        return esneklikYok || esneklikler.some((e) => e.trim());
      case "oneri":
        return oneriYok || !!zorluk;
      case "ozet":
        return toplamZaman === 100;
      default:
        return true;
    }
  }, [aktifAdim, isler, toplamZaman, yetRef, yetSeviye, kararlar, iliskiler, iliskiYok, esneklikler, esneklikYok, zorluk, oneriYok]);

  // İleri/adım geçiş uyarı mesajı (zorunluluk karşılanmadıysa)
  const adimUyari = useMemo(() => {
    if (ilerleyebilir) return null;
    switch (aktifAdim.key) {
      case "isler":
        if (!isler.some((i) => i.isAdi.trim())) return "En az bir iş eklemelisin.";
        return `Toplam zaman %${toplamZaman}. Devam etmek için %100 olmalı.`;
      case "yetkinlik": return "Tüm yetkinlikler için bir seviye seç.";
      case "karar": return "En az bir karar yetkisi eklemelisin.";
      case "iliski": return "En az bir ilişki ekle veya \"Başka raporladığım kimse yok\" seçeneğini işaretle.";
      case "esneklik": return "Bir esneklik ekle veya \"Yapabildiğim başka iş yok\" seçeneğini işaretle.";
      case "oneri": return "Zorlaştıran bir konu seç veya \"Önerim yok\" seçeneğini işaretle.";
      default: return null;
    }
  }, [ilerleyebilir, aktifAdim, isler, toplamZaman]);

  async function gonder() {
    setGonderiliyor(true);
    const body = {
      pozisyonId,
      amirPersonnelId,
      oncekiVersiyonId, // revizyonsa dolu → yeni versiyon
      sicilNo: personel?.sicilNo ?? "",
      adSoyad: personel?.adSoyad ?? "",
      amir: personel?.amir ?? iliskiler.find(i => i.tip === "RAPORLAR")?.taraf ?? null,
      gonder: true,
      zorlukKonusu: oneriYok ? null : (zorluk || null),
      iyilestirmeOneri: oneriYok ? null : (oneri || null),
      yapilanIsler: isler.filter(i => i.isAdi.trim()),
      yetkinlikler: yetRef.map(y => ({ yetkinlikId: y.yetkinlikId, mevcutSeviye: Number(yetSeviye[y.yetkinlikId] ?? 3), hedefSeviye: y.hedefSeviye })),
      kararYetkileri: kararlar.filter(k => k.konu.trim()),
      isIliskileri: iliskiler.filter(i => i.taraf.trim()),
      esneklikler: esneklikYok ? [] : esneklikler.filter(e => e.trim()).map(e => ({ tip: "YAPABILDIGIM_IS", kisiPozIs: e })),
    };
    try {
      const res = await fetch("/api/strategic-hr/is-analizi/kaydet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) { setGonderildi(true); }
      else { const d = await res.json(); setHata(d.error ?? "Gönderilemedi."); }
    } catch {
      setHata("Gönderim sırasında hata oluştu.");
    } finally {
      setGonderiliyor(false);
    }
  }

  if (yukleniyor) {
    return <div className="mx-auto max-w-xl px-4 py-16 text-center text-slate-400">Bilgileriniz yükleniyor...</div>;
  }
  if (hata) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h2 className="text-lg font-semibold text-slate-800">Form açılamadı</h2>
        <p className="mt-2 text-slate-500">{hata}</p>
      </div>
    );
  }
  if (gonderildi) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: BRAND }}>
          <Check className="h-7 w-7 text-white" />
        </div>
        <h2 className="text-xl font-semibold text-slate-800">Form gönderildi</h2>
        <p className="mt-2 text-slate-500">
          {amirGuvenilir
            ? "İş analizin amirinin onayına iletildi."
            : "İş analizin doğrudan İnsan Varlıkları'na iletildi."}
        </p>
      </div>
    );
  }

  /* ── Açılış: kişi bilgisi + önceki formlar ── */
  if (!basladi && personel) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">İş Analizi Formu</h1>
        <p className="mt-1 text-slate-500">Bilgilerin sistemden otomatik geldi. Kontrol et ve forma başla.</p>
        <Card className="mt-6 border-slate-200">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-slate-500 block text-xs">Ad Soyad</span><strong>{personel.adSoyad}</strong></div>
              <div><span className="text-slate-500 block text-xs">Sicil No</span><strong>{personel.sicilNo}</strong></div>
              <div><span className="text-slate-500 block text-xs">Bölüm</span><strong>{personel.bolum}</strong></div>
              <div><span className="text-slate-500 block text-xs">Görev</span><strong>{personel.gorev}</strong></div>
              <div><span className="text-slate-500 block text-xs">Amir</span><strong>{personel.amir || "—"}</strong></div>
              <div><span className="text-slate-500 block text-xs">Yaka</span><strong>{personel.yaka === "MAVI" ? "Mavi" : "Beyaz"}</strong></div>
            </div>

            {!pozisyonBulundu && (
              <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
                Görevine tanımlı yetkinlik listesi henüz hazırlanmadı. Forma başlayabilirsin; yetkinlik adımı boş görünebilir. İK bu tanımı sonradan ekleyecek.
              </div>
            )}

            {!amirGuvenilir && (
              <div className="mt-4 rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 text-sm text-sky-800">
                Amiriniz sistemde kesin olarak belirlenemedi, formunuz doğrudan İnsan Varlıkları'na iletilecek.
              </div>
            )}

            <Button onClick={() => setBasladi(true)}
              className="mt-6 w-full text-white hover:opacity-90" style={{ backgroundColor: BRAND }}>
              Yeni İş Analizi Doldur <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Önceki İş Analizlerim */}
        {oncekiFormlar.length > 0 && (
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-800">Önceki İş Analizlerim</h2>
              <Button variant="outline" size="sm" onClick={oncekiFormlariAktar} className="gap-1 shrink-0">
                <Download className="h-4 w-4" /> Excel'e Aktar
              </Button>
            </div>
            <div className="space-y-3">
              {oncekiFormlar.map((f) => {
                const d = DURUM_ETIKET[f.durum] ?? { label: f.durum, renk: "#64748b", bg: "#f1f5f9" };
                const revizeEdilebilir = f.durum === "REVIZE_ISTENDI";
                return (
                  <Card key={f.id} className="border-slate-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-800">{f.pozisyon?.ad ?? "İş Analizi"} <span className="text-xs text-slate-400">v{f.versiyon}</span></p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {new Date(f.createdAt).toLocaleDateString("tr-TR")} · {f._count.yapilanIsler} iş · {f._count.yetkinlikler} yetkinlik
                          </p>
                        </div>
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ color: d.renk, backgroundColor: d.bg }}>
                          {d.label}
                        </span>
                      </div>

                      {revizeEdilebilir && (
                        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm text-amber-800 font-medium">Amir revizyon istedi</p>
                              {f.amirNotu && <p className="text-sm text-amber-700 mt-0.5">{f.amirNotu}</p>}
                            </div>
                          </div>
                          <Button onClick={() => revizyonBaslat(f.id)} size="sm"
                            className="mt-3 w-full text-white hover:opacity-90" style={{ backgroundColor: BRAND }}>
                            Düzelt ve Yeniden Gönder
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Wizard ── */
  const yaka = personel?.yaka ?? "MAVI";
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">İş Analizi Formu</h1>
        <p className="mt-1 text-sm text-slate-500">{personel?.gorev} — {personel?.bolum}</p>
        {oncekiVersiyonId && (
          <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
            <strong>Revizyon:</strong> {revizeNotu || "Amir düzeltme istedi."} Gerekli düzeltmeleri yapıp yeniden gönder.
          </div>
        )}
        <div className="mt-4 flex items-center gap-3">
          <Progress value={progress} className="h-2" />
          <span className="shrink-0 text-sm font-medium text-slate-400">{step + 1} / {totalSteps}</span>
        </div>
      </div>
      <Card className="border-slate-200">
        <CardContent className="p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${BRAND}14` }}>
              <StepIcon name={aktifAdim.ikon} className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{aktifAdim.baslik}</h2>
              <p className="mt-1 text-sm text-slate-500">{aktifAdim.aciklama}</p>
            </div>
          </div>

          {aktifAdim.key === "isler" && (
            <IslerAdim isler={isler} setIsler={setIsler} makineler={makineler} yaka={yaka} toplam={toplamZaman} />
          )}
          {aktifAdim.key === "yetkinlik" && (
            <YetkinlikAdim yetRef={yetRef} yetSeviye={yetSeviye} setYetSeviye={setYetSeviye} />
          )}
          {aktifAdim.key === "karar" && (
            <SatirAdim satirlar={kararlar} setSatirlar={setKararlar} bos={{ konu: "", yetkiTipi: "TEK_BASINA" }}
              render={(k: any, upd: any) => (
                <div className="grid grid-cols-[1fr_170px] gap-2">
                  <Input placeholder="Karar konusu..." value={k.konu} onChange={e => upd("konu", e.target.value)} />
                  <Select value={k.yetkiTipi} onValueChange={v => upd("yetkiTipi", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{YETKI_TIPLERI.map(y => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )} />
          )}
          {aktifAdim.key === "iliski" && (
            <div className="space-y-3">
              <div className={iliskiYok ? "opacity-40 pointer-events-none" : ""}>
                <SatirAdim satirlar={iliskiler} setSatirlar={setIliskiler} bos={{ tip: "IS_ALIR", taraf: "" }}
                  render={(il: any, upd: any) => (
                    <div className="grid grid-cols-[170px_1fr] gap-2">
                      <Select value={il.tip} onValueChange={v => upd("tip", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{ILISKI_TIPLERI.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input placeholder="Kim / hangi pozisyon..." value={il.taraf} onChange={e => upd("taraf", e.target.value)} />
                    </div>
                  )} />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer pt-2 border-t border-slate-100">
                <input type="checkbox" checked={iliskiYok} onChange={(e) => setIliskiYok(e.target.checked)} className="h-4 w-4" />
                Başka raporladığım / ilişkim yok
              </label>
            </div>
          )}
          {aktifAdim.key === "esneklik" && (
            <div className="space-y-3">
              <div className={esneklikYok ? "opacity-40 pointer-events-none" : ""}>
                <BasitListeAdim degerler={esneklikler} setDegerler={setEsneklikler} placeholder="Yapabildiğin başka iş / istasyon..." />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer pt-2 border-t border-slate-100">
                <input type="checkbox" checked={esneklikYok} onChange={(e) => setEsneklikYok(e.target.checked)} className="h-4 w-4" />
                Yapabildiğim başka iş yok
              </label>
            </div>
          )}
          {aktifAdim.key === "oneri" && (
            <div className="space-y-4">
              <div className={oneriYok ? "opacity-40 pointer-events-none" : ""}>
                <Label className="text-sm">İşimi en çok zorlaştıran konu</Label>
                <Select value={zorluk} onValueChange={setZorluk}>
                  <SelectTrigger><SelectValue placeholder="Seçiniz..." /></SelectTrigger>
                  <SelectContent>{ZORLUK_KONULARI.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent>
                </Select>
                <Label className="text-sm mt-3 block">Detay / iyileştirme önerim (opsiyonel)</Label>
                <Textarea rows={4} placeholder="Serbestçe yazabilirsin..." value={oneri} onChange={e => setOneri(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer pt-2 border-t border-slate-100">
                <input type="checkbox" checked={oneriYok} onChange={(e) => setOneriYok(e.target.checked)} className="h-4 w-4" />
                Önerim yok
              </label>
            </div>
          )}
          {aktifAdim.key === "ozet" && (
            <OzetAdim personel={personel} isler={isler} toplam={toplamZaman} yetRef={yetRef} yetSeviye={yetSeviye}
              iliskiler={iliskiler} esneklikler={esneklikler} zorluk={zorluk} amirGuvenilir={amirGuvenilir} />
          )}
        </CardContent>
      </Card>

      {adimUyari && (
        <p className="mt-4 text-sm text-amber-700 text-right">{adimUyari}</p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <Button variant="ghost" onClick={() => setStep(s => Math.max(s - 1, 0))} disabled={step === 0} className="gap-1 text-slate-600">
          <ChevronLeft className="h-4 w-4" /> Geri
        </Button>
        {aktifAdim.key === "ozet" ? (
          <Button onClick={gonder} disabled={!ilerleyebilir || gonderiliyor} className="gap-1 text-white hover:opacity-90" style={{ backgroundColor: BRAND }}>
            {gonderiliyor ? "Gönderiliyor..." : (oncekiVersiyonId ? "Yeniden Gönder" : "Amire Gönder")} <Send className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={() => setStep(s => Math.min(s + 1, totalSteps - 1))} disabled={!ilerleyebilir} className="gap-1 text-white hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: BRAND }}>
            İleri <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 *  ADIM BİLEŞENLERİ (değişmedi)
 * ════════════════════════════════════════════════════════════════════════ */

function IslerAdim({ isler, setIsler, makineler, yaka, toplam }: any) {
  const ekle = () => setIsler([...isler, { isAdi: "", tetikleyici: TETIKLEYICILER[0], makineArac: makineler[0] ?? "", siklik: "GUNLUK", zamanYuzde: 0 }]);
  const sil = (i: number) => setIsler(isler.filter((_: any, idx: number) => idx !== i));
  const upd = (i: number, alan: string, deger: any) => setIsler(isler.map((it: any, idx: number) => idx === i ? { ...it, [alan]: deger } : it));
  return (
    <div className="space-y-3">
      {isler.map((is: IsSatir, i: number) => (
        <div key={i} className="rounded-lg border border-slate-200 p-3 relative">
          <button onClick={() => sil(i)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
          <Input placeholder="İşin adı..." value={is.isAdi} onChange={e => upd(i, "isAdi", e.target.value)} className="mb-2" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Tetikleyici</Label>
              <Select value={is.tetikleyici} onValueChange={v => upd(i, "tetikleyici", v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{TETIKLEYICILER.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{yaka === "MAVI" ? "Makine" : "Sistem"}</Label>
              <Select value={is.makineArac} onValueChange={v => upd(i, "makineArac", v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{makineler.map((m: string) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Sıklık</Label>
              <Select value={is.siklik} onValueChange={v => upd(i, "siklik", v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{SIKLIK.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Zaman %</Label>
              <Input type="number" min={0} max={100} value={is.zamanYuzde} className="h-9" onChange={e => upd(i, "zamanYuzde", parseInt(e.target.value) || 0)} />
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" onClick={ekle} className="w-full border-dashed" style={{ borderColor: BRAND, color: BRAND }}>
        <Plus className="mr-1 h-4 w-4" /> Yeni iş ekle
      </Button>
      <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-sm">
        <span className="text-slate-500">Toplam zaman</span>
        <span className="font-bold" style={{ color: toplam === 100 ? BRAND : toplam > 100 ? "#dc2626" : "#b45309" }}>%{toplam} / 100</span>
      </div>
    </div>
  );
}

function YetkinlikAdim({ yetRef, yetSeviye, setYetSeviye }: any) {
  const mesleki = yetRef.filter((y: YetRef) => y.tip === "MESLEKI");
  const genel = yetRef.filter((y: YetRef) => y.tip === "GENEL");
  const upd = (id: string, sv: string) => setYetSeviye({ ...yetSeviye, [id]: sv });
  const Grup = ({ baslik, liste }: any) => liste.length === 0 ? null : (
    <div className="mb-4">
      <p className="text-xs font-semibold text-slate-500 uppercase mb-2">{baslik}</p>
      {liste.map((y: YetRef) => (
        <div key={y.yetkinlikId} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0 gap-3">
          <span className="text-sm text-slate-700">{y.ad}</span>
          <Select value={yetSeviye[y.yetkinlikId] ?? ""} onValueChange={v => upd(y.yetkinlikId, v)}>
            <SelectTrigger className="w-auto min-w-[180px] h-9"><SelectValue placeholder="Seviye seç..." /></SelectTrigger>
            <SelectContent>{SEVIYELER.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
  if (yetRef.length === 0) {
    return (
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-3 text-sm text-amber-700">
        Pozisyonunuz için yetkinlik tanımları henüz girilmemiş, bu adımı geçebilirsiniz.
      </div>
    );
  }
  return (<div><Grup baslik="Mesleki Beceriler" liste={mesleki} /><Grup baslik="Genel Özellikler" liste={genel} /></div>);
}

function SatirAdim({ satirlar, setSatirlar, bos, render }: any) {
  const ekle = () => setSatirlar([...satirlar, { ...bos }]);
  const sil = (i: number) => setSatirlar(satirlar.filter((_: any, idx: number) => idx !== i));
  const updFn = (i: number) => (alan: string, deger: any) => setSatirlar(satirlar.map((s: any, idx: number) => idx === i ? { ...s, [alan]: deger } : s));
  return (
    <div className="space-y-2">
      {satirlar.map((s: any, i: number) => (
        <div key={i} className="flex gap-2 items-start">
          <div className="flex-1">{render(s, updFn(i))}</div>
          <button onClick={() => sil(i)} className="text-slate-400 hover:text-red-500 mt-2"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <Button variant="outline" onClick={ekle} className="w-full border-dashed" style={{ borderColor: BRAND, color: BRAND }}>
        <Plus className="mr-1 h-4 w-4" /> Ekle
      </Button>
    </div>
  );
}

function BasitListeAdim({ degerler, setDegerler, placeholder }: any) {
  const ekle = () => setDegerler([...degerler, ""]);
  const sil = (i: number) => setDegerler(degerler.filter((_: any, idx: number) => idx !== i));
  const upd = (i: number, v: string) => setDegerler(degerler.map((d: string, idx: number) => idx === i ? v : d));
  return (
    <div className="space-y-2">
      {degerler.map((d: string, i: number) => (
        <div key={i} className="flex gap-2 items-center">
          <Input className="flex-1" placeholder={placeholder} value={d} onChange={e => upd(i, e.target.value)} />
          <button onClick={() => sil(i)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <Button variant="outline" onClick={ekle} className="w-full border-dashed" style={{ borderColor: BRAND, color: BRAND }}>
        <Plus className="mr-1 h-4 w-4" /> Ekle
      </Button>
    </div>
  );
}

function OzetAdim({ personel, isler, toplam, yetRef, yetSeviye, iliskiler, esneklikler, zorluk, amirGuvenilir }: any) {
  const Sat = ({ k, v }: any) => (
    <div className="flex justify-between py-1.5 border-b border-slate-100 text-sm">
      <span className="text-slate-500">{k}</span><span className="text-slate-800 font-medium text-right">{v}</span>
    </div>
  );
  return (
    <div>
      {toplam !== 100 && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
          Toplam zaman %{toplam}. Göndermek için %100 olmalı — "Yaptığım İşler" adımına dönüp düzelt.
        </div>
      )}
      <div className="space-y-1">
        <Sat k="Görev" v={personel?.gorev ?? "—"} />
        <Sat k="Bölüm" v={personel?.bolum ?? "—"} />
        <Sat k="Girilen iş sayısı" v={isler.filter((i: IsSatir) => i.isAdi.trim()).length} />
        <Sat k="Zaman toplamı" v={`%${toplam}`} />
        <Sat k="Yetkinlik sayısı" v={yetRef.length} />
        <Sat k="İş ilişkisi" v={iliskiler.filter((i: any) => i.taraf.trim()).length} />
        <Sat k="Esneklik (diğer işler)" v={esneklikler.filter((e: string) => e.trim()).length} />
        <Sat k="Zorlaştıran konu" v={zorluk || "—"} />
      </div>
      {amirGuvenilir === false && (
        <div className="mt-4 rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 text-sm text-sky-800">
          Amiriniz sistemde kesin olarak belirlenemedi, formunuz doğrudan İnsan Varlıkları'na iletilecek.
        </div>
      )}
      <p className="mt-4 text-sm text-slate-500">
        {amirGuvenilir === false
          ? "Gönderdiğinde form doğrudan İnsan Varlıkları'na iletilir. Sonrasında düzenleme için İK'ya başvurman gerekir."
          : "Gönderdiğinde form amirinin onayına iletilir. Onaydan sonra düzenleme için amirine/İK'ya başvurman gerekir."}
      </p>
    </div>
  );
}

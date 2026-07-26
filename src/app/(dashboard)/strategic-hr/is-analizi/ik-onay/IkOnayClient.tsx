"use client";

/**
 * ════════════════════════════════════════════════════════════════════════
 *  İK İNCELEME EKRANI — İş Analizi Onayları (son halka)
 *  Konum: (dashboard)/strategic-hr/is-analizi/ik-onay
 *
 *  İK, IK_INCELEMESINDE formları görür. Amir notunu da görür.
 *  Aksiyonlar: Onayla (→ONAYLANDI) / Geri Gönder (→REVIZE_ISTENDI, not zorunlu).
 *  Erişim: rol HR_MANAGER / admin (API tarafında da kontrol edilir).
 * ════════════════════════════════════════════════════════════════════════
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Check, Undo2, ChevronLeft, Inbox, ShieldCheck } from "lucide-react";

const BRAND = "#1B4F72";

const SIKLIK_ETIKET: Record<string, string> = {
  GUNLUK: "Günlük", HAFTALIK: "Haftalık", AYLIK: "Aylık", DONEMSEL: "Dönemsel", YILLIK: "Yıllık",
};
const YETKI_ETIKET: Record<string, string> = {
  TEK_BASINA: "Tek başına", AMIR_ONAYI: "Amir onayı", MUDUR_ONAYI: "Müdür onayı", GM_ONAYI: "Genel Müdür onayı",
};
const ILISKI_ETIKET: Record<string, string> = {
  IS_ALIR: "İş aldığı", IS_VERIR: "İş verdiği", RAPORLAR: "Raporladığı", KONTROL_EDEN: "Kontrol eden", BIRLIKTE: "Birlikte çalıştığı",
};
const SEVIYE_ETIKET: Record<number, string> = {
  1: "1 - Gerekli değil", 2: "2 - Kontrol altında", 3: "3 - Kendi başına", 4: "4 - Eğitim verebilir",
};

interface ListeItem {
  id: string; adSoyad: string; sicilNo: string; bolum: string; yaka: string;
  versiyon: number; amir: string | null; amirPersonnelId: string | null; amirNotu: string | null; amirOnayTarihi: string | null;
  pozisyon: { ad: string } | null;
  _count: { yapilanIsler: number; yetkinlikler: number; kararYetkileri: number; isIliskileri: number };
}

export default function IkOnayClient() {
  const [liste, setListe] = useState<ListeItem[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);

  const [seciliId, setSeciliId] = useState<string | null>(null);
  const [detay, setDetay] = useState<any>(null);
  const [detayYukleniyor, setDetayYukleniyor] = useState(false);

  const [not, setNot] = useState("");
  const [islem, setIslem] = useState(false);
  const [islemHata, setIslemHata] = useState<string | null>(null);

  async function listeYukle() {
    setYukleniyor(true);
    setHata(null);
    try {
      const r = await fetch("/api/strategic-hr/is-analizi/ik/liste");
      const d = await r.json();
      if (!r.ok) { setHata(d.error ?? "Liste yüklenemedi."); return; }
      setListe(d.formlar ?? []);
    } catch {
      setHata("Sunucuya ulaşılamadı.");
    } finally {
      setYukleniyor(false);
    }
  }

  useEffect(() => { listeYukle(); }, []);

  async function detayAc(id: string) {
    setSeciliId(id);
    setDetay(null);
    setNot("");
    setIslemHata(null);
    setDetayYukleniyor(true);
    try {
      const r = await fetch(`/api/strategic-hr/is-analizi/ik/detay?id=${id}`);
      const d = await r.json();
      if (!r.ok) { setIslemHata(d.error ?? "Detay yüklenemedi."); return; }
      setDetay(d.form);
    } catch {
      setIslemHata("Detay alınamadı.");
    } finally {
      setDetayYukleniyor(false);
    }
  }

  async function karar(karar: "ONAYLA" | "GERI_GONDER") {
    if (!seciliId) return;
    if (karar === "GERI_GONDER" && !not.trim()) {
      setIslemHata("Geri gönderirken not zorunludur.");
      return;
    }
    setIslem(true);
    setIslemHata(null);
    try {
      const r = await fetch("/api/strategic-hr/is-analizi/ik/karar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: seciliId, karar, ikNotu: not }),
      });
      const d = await r.json();
      if (!r.ok) { setIslemHata(d.error ?? "İşlem başarısız."); return; }
      setListe((l) => l.filter((x) => x.id !== seciliId));
      setSeciliId(null);
      setDetay(null);
      setNot("");
    } catch {
      setIslemHata("İşlem sırasında hata oluştu.");
    } finally {
      setIslem(false);
    }
  }

  /* ── Detay ── */
  if (seciliId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Button variant="ghost" onClick={() => { setSeciliId(null); setDetay(null); }} className="gap-1 text-slate-600 mb-4">
          <ChevronLeft className="h-4 w-4" /> Listeye dön
        </Button>

        {detayYukleniyor && <p className="text-slate-400">Yükleniyor...</p>}
        {islemHata && !detay && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{islemHata}</div>
        )}

        {detay && (
          <>
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-slate-900">{detay.adSoyad} <span className="text-sm text-slate-400">v{detay.versiyon}</span></h1>
              <p className="text-sm text-slate-500">{detay.pozisyon?.ad} — {detay.bolum} · Sicil {detay.sicilNo}</p>
            </div>

            {/* Amir notu (varsa) */}
            {detay.amirNotu && (
              <div className="mb-4 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <p className="text-xs text-slate-500 uppercase font-semibold">Amir notu</p>
                <p className="text-sm text-slate-700 mt-0.5">{detay.amirNotu}</p>
              </div>
            )}

            <Card className="mb-4 border-slate-200">
              <CardContent className="p-5">
                <h2 className="text-sm font-semibold text-slate-700 uppercase mb-3">Yaptığı İşler</h2>
                {detay.yapilanIsler.length === 0 ? <p className="text-sm text-slate-400">—</p> : (
                  <div className="space-y-2">
                    {detay.yapilanIsler.map((is: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm border-b border-slate-100 pb-2 last:border-0">
                        <div>
                          <span className="font-medium text-slate-800">{is.isAdi}</span>
                          <span className="text-slate-400 ml-2">
                            {is.makineArac ? `· ${is.makineArac} ` : ""}{is.tetikleyici ? `· ${is.tetikleyici} ` : ""}· {SIKLIK_ETIKET[is.siklik] ?? is.siklik}
                          </span>
                        </div>
                        <span className="font-semibold" style={{ color: BRAND }}>%{is.zamanYuzde ?? 0}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {detay.yetkinlikler.length > 0 && (
              <Card className="mb-4 border-slate-200">
                <CardContent className="p-5">
                  <h2 className="text-sm font-semibold text-slate-700 uppercase mb-3">Yetkinlik Seviyeleri</h2>
                  <div className="space-y-1">
                    {detay.yetkinlikler.map((y: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm border-b border-slate-100 py-1.5 last:border-0">
                        <span className="text-slate-700">{y.yetkinlik?.ad}</span>
                        <span className="text-slate-500">{SEVIYE_ETIKET[y.mevcutSeviye] ?? y.mevcutSeviye}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="mb-4 border-slate-200">
              <CardContent className="p-5 space-y-4">
                {detay.kararYetkileri.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-slate-700 uppercase mb-2">Karar Yetkileri</h2>
                    {detay.kararYetkileri.map((k: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm py-1">
                        <span className="text-slate-700">{k.konu}</span>
                        <span className="text-slate-500">{YETKI_ETIKET[k.yetkiTipi] ?? k.yetkiTipi}</span>
                      </div>
                    ))}
                  </div>
                )}
                {detay.isIliskileri.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-slate-700 uppercase mb-2">İş İlişkileri</h2>
                    {detay.isIliskileri.map((il: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm py-1">
                        <span className="text-slate-500">{ILISKI_ETIKET[il.tip] ?? il.tip}</span>
                        <span className="text-slate-700">{il.taraf}</span>
                      </div>
                    ))}
                  </div>
                )}
                {detay.esneklikler.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-slate-700 uppercase mb-2">Esneklik / Yedekleme</h2>
                    {detay.esneklikler.map((e: any, i: number) => (
                      <div key={i} className="text-sm text-slate-700 py-1">{e.kisiPozIs}</div>
                    ))}
                  </div>
                )}
                {(detay.zorlukKonusu || detay.iyilestirmeOneri) && (
                  <div>
                    <h2 className="text-sm font-semibold text-slate-700 uppercase mb-2">İyileştirme</h2>
                    {detay.zorlukKonusu && <p className="text-sm text-slate-700">Zorlaştıran: {detay.zorlukKonusu}</p>}
                    {detay.iyilestirmeOneri && <p className="text-sm text-slate-500 mt-1">{detay.iyilestirmeOneri}</p>}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200" style={{ borderColor: `${BRAND}55` }}>
              <CardContent className="p-5">
                <Label className="text-sm font-medium">İK notu (geri gönderirken zorunlu)</Label>
                <Textarea rows={3} className="mt-2" placeholder="Onay notu veya düzeltilmesi gereken konu..." value={not} onChange={(e) => setNot(e.target.value)} />
                {islemHata && <p className="mt-2 text-sm text-red-600">{islemHata}</p>}
                <div className="mt-4 flex items-center justify-end gap-3">
                  <Button variant="outline" disabled={islem} onClick={() => karar("GERI_GONDER")} className="gap-1" style={{ borderColor: "#b45309", color: "#b45309" }}>
                    <Undo2 className="h-4 w-4" /> Çalışana Geri Gönder
                  </Button>
                  <Button disabled={islem} onClick={() => karar("ONAYLA")} className="gap-1 text-white hover:opacity-90" style={{ backgroundColor: BRAND }}>
                    <Check className="h-4 w-4" /> Onayla (Nihai)
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    );
  }

  /* ── Liste ── */
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${BRAND}14` }}>
          <ShieldCheck className="h-5 w-5" style={{ color: BRAND }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">İş Analizi Onayları (İK)</h1>
          <p className="text-sm text-slate-500">Amir onayından geçmiş, İK incelemesini bekleyen formlar.</p>
        </div>
      </div>

      {yukleniyor && <p className="text-slate-400">Yükleniyor...</p>}
      {hata && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{hata}</div>}

      {!yukleniyor && !hata && liste.length === 0 && (
        <Card className="border-slate-200">
          <CardContent className="p-10 text-center">
            <Inbox className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-slate-500">İncelenecek form yok.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {liste.map((f) => (
          <Card key={f.id} className="border-slate-200 hover:shadow-sm transition cursor-pointer" onClick={() => detayAc(f.id)}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800">
                  {f.adSoyad} <span className="text-xs text-slate-400">v{f.versiyon}</span>
                  {!f.amirPersonnelId && (
                    <span className="ml-2 inline-block rounded-full bg-amber-100 text-amber-700 text-[11px] font-medium px-2 py-0.5 align-middle">
                      Amir atanamadı
                    </span>
                  )}
                </p>
                <p className="text-sm text-slate-500">{f.pozisyon?.ad} — {f.bolum} · Sicil {f.sicilNo}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Amir: {f.amir || "—"} · {f._count.yapilanIsler} iş · {f._count.yetkinlikler} yetkinlik
                </p>
              </div>
              <ChevronLeft className="h-5 w-5 rotate-180 text-slate-300" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

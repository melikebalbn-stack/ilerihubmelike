"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// /api/proje-takip/musteri-ara cevabı (ifs-musteri.ts server-only olduğu için tip
// burada ayrıca tanımlı). KONTROL_EDILEMEDI = IFS'e ulaşılamadı, "yok" DEĞİL.
export type IfsMusteriSecimi = { customerId: string; name: string };

type AramaDurumu =
  | { durum: "BOS" }
  | { durum: "ARANIYOR" }
  | { durum: "TAMAM"; metin: string; musteriler: IfsMusteriSecimi[] }
  | { durum: "KONTROL_EDILEMEDI" };

const MIN_KARAKTER = 2;
const DEBOUNCE_MS = 350;

/**
 * Müşteri Firma alanı — IFS'te canlı arama (autocomplete).
 * Dropdown deseni: src/components/ui/personnel-autocomplete.tsx (absolute liste,
 * onMouseDown ile seçim, dışarı tıklayınca kapanır). Debounce: AramaKutusu.tsx (350ms).
 *
 * - Listeden seçim → onSec({ customerId, name }) (form Müşteri Firma + Müşteri Kodu'nu doldurur).
 * - Elle yazım engellenmez → onChange(metin).
 * - ≥2 karakter ve SIFIR sonuç → "IFS'te bulunamadı" + "Satışa Bildir".
 * - KONTROL_EDILEMEDI → nötr mesaj, "Satışa Bildir" YOK.
 */
export function MusteriAramaInput({
  value,
  onChange,
  onSec,
}: {
  value: string;
  onChange: (metin: string) => void;
  onSec: (musteri: IfsMusteriSecimi) => void;
}) {
  const [arama, setArama] = useState<AramaDurumu>({ durum: "BOS" });
  const [acik, setAcik] = useState(false);
  // Kullanıcı yazdığında true; programatik değer değişiminde (seçim, ilk yükleme) arama yapılmaz.
  const [yazildi, setYazildi] = useState(false);
  const istekNo = useRef(0);
  const ref = useRef<HTMLDivElement>(null);

  const [bildiriliyor, setBildiriliyor] = useState(false);
  const [bildirildi, setBildirildi] = useState(false);
  const [bildirHata, setBildirHata] = useState<string | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAcik(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!yazildi) return;
    const metin = value.trim();
    const no = ++istekNo.current;
    if (metin.length < MIN_KARAKTER) {
      setArama({ durum: "BOS" });
      return;
    }
    const zamanlayici = setTimeout(async () => {
      setArama({ durum: "ARANIYOR" });
      let sonuc: AramaDurumu;
      try {
        const res = await fetch(`/api/proje-takip/musteri-ara?q=${encodeURIComponent(metin)}`);
        const data = await res.json();
        sonuc = res.ok && data?.durum === "TAMAM" && Array.isArray(data.musteriler)
          ? { durum: "TAMAM", metin, musteriler: data.musteriler }
          : { durum: "KONTROL_EDILEMEDI" };
      } catch {
        sonuc = { durum: "KONTROL_EDILEMEDI" };
      }
      // Cevap gelene kadar metin değiştiyse eski sonucu gösterme.
      if (no === istekNo.current) {
        setArama(sonuc);
        setAcik(true);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(zamanlayici);
  }, [value, yazildi]);

  async function satisaBildir() {
    if (arama.durum !== "TAMAM") return;
    const musteriFirma = arama.metin;
    setBildirHata(null);
    setBildiriliyor(true);
    try {
      const res = await fetch("/api/proje-takip/musteri-bildir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ musteriFirma }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Bildirim gönderilemedi");
      setBildirildi(true);
    } catch (e) {
      setBildirHata(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setBildiriliyor(false);
    }
  }

  // Sonuç, ŞU AN kutudaki metne ait olmalı (sonuçtan sonra yazmaya devam edildiyse gösterilmez).
  const bulunamadi =
    yazildi &&
    arama.durum === "TAMAM" &&
    arama.metin === value.trim() &&
    arama.musteriler.length === 0 &&
    value.trim().length >= MIN_KARAKTER;

  return (
    <div ref={ref} className="relative">
      <Input
        value={value}
        placeholder="Müşteri adı veya IFS kodu yazın..."
        onChange={(e) => {
          setYazildi(true);
          setBildirildi(false);
          setBildirHata(null);
          onChange(e.target.value);
        }}
        onFocus={() => {
          if (arama.durum === "TAMAM" && arama.musteriler.length > 0) setAcik(true);
        }}
      />

      {acik && arama.durum === "TAMAM" && arama.musteriler.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-64 overflow-y-auto">
          {arama.musteriler.map((m) => (
            <button
              key={m.customerId}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => {
                e.preventDefault();
                istekNo.current++;
                setYazildi(false);
                setAcik(false);
                setArama({ durum: "BOS" });
                onSec(m);
              }}
            >
              {m.name}
              <span className="text-muted-foreground"> · {m.customerId}</span>
            </button>
          ))}
        </div>
      )}

      {yazildi && arama.durum === "ARANIYOR" && (
        <p className="text-xs text-muted-foreground mt-1">IFS'te aranıyor...</p>
      )}
      {yazildi && arama.durum === "KONTROL_EDILEMEDI" && (
        <p className="text-xs text-muted-foreground mt-1">IFS bağlantısı şu an kontrol edilemiyor.</p>
      )}
      {bulunamadi && (
        <div className="mt-2 space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-700">Bu müşteri IFS&apos;te bulunamadı.</p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={satisaBildir}
              disabled={bildiriliyor || bildirildi}
            >
              {bildiriliyor ? "Gönderiliyor..." : bildirildi ? "Bildirildi" : "Satışa Bildir"}
            </Button>
            {bildirildi && (
              <span className="text-xs text-emerald-600">IFS&apos;te müşteri açılması için bildirim gönderildi.</span>
            )}
            {bildirHata && <span className="text-xs text-red-500">{bildirHata}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

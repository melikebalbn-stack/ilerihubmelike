"use client";

// Akış adım 2/3 — Sağlık Beyan Formu (F13.37 26 madde + F13.56 astım anketi).
// POST /api/job-application/health (guard'lı) → başarıda onDone() → başvuru formu.

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { NativeSelect as Select } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { F13_37, F13_56 } from "@/content/f13-37-56";

const NAVY = "#1B4F72";
const todayISO = () => new Date().toISOString().slice(0, 10);

type YesNo = "true" | "false" | "";

export function HealthStep({ onDone }: { onDone: () => void }) {
  const [items, setItems] = useState<Record<number, YesNo>>({});
  const [ameliyatNotu, setAmeliyatNotu] = useState("");
  const [gecmis, setGecmis] = useState("");
  const [beyan, setBeyan] = useState(false);

  const [astim, setAstim] = useState<Record<string, YesNo>>({});
  const [dogumTarihi, setDogumTarihi] = useState("");
  const [cinsiyet, setCinsiyet] = useState("");
  const [telGunduz, setTelGunduz] = useState("");
  const [telGece, setTelGece] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eksik, setEksik] = useState<number[]>([]);
  const itemRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const ameliyatEvet = items[F13_37.AMELIYAT_ITEM_NO] === "true";
  const astim1Evet = astim["astimSoru1"] === "true";

  function setItem(no: number, v: YesNo) {
    setItems((p) => ({ ...p, [no]: v }));
    setEksik((e) => e.filter((n) => n !== no));
  }
  function setAstimQ(key: string, v: YesNo) {
    setAstim((p) => ({ ...p, [key]: v }));
  }

  async function handleSubmit() {
    setError(null);
    // Client: 26 madde tam mı?
    const missing = F13_37.maddeler
      .map((m) => m.itemNo)
      .filter((n) => items[n] !== "true" && items[n] !== "false");
    if (missing.length > 0) {
      setEksik(missing);
      setError(`Lütfen tüm sağlık maddelerini işaretleyin (${missing.length} eksik).`);
      const first = itemRefs.current[missing[0]];
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (ameliyatEvet && !ameliyatNotu.trim()) return setError("Hangi ameliyat olduğunuzu belirtiniz.");
    if (astim["astimSoru1"] !== "true" && astim["astimSoru1"] !== "false")
      return setError("Astım 1. soruyu cevaplayınız.");
    if (astim1Evet && (astim["astimSoru1_1"] === undefined || astim["astimSoru1_2"] === undefined))
      return setError("1.1 ve 1.2 sorularını cevaplayınız.");
    const astim27Eksik = ["astimSoru2", "astimSoru3", "astimSoru4", "astimSoru5", "astimSoru6", "astimSoru7"].some(
      (k) => astim[k] !== "true" && astim[k] !== "false"
    );
    if (astim27Eksik) return setError("Tüm astım sorularını (2-7) cevaplayınız.");
    if (!beyan) return setError("Sağlık beyanını onaylamanız zorunludur.");
    if (cinsiyet !== "BAY" && cinsiyet !== "BAYAN") return setError("Cinsiyet seçiniz.");
    if (!dogumTarihi) return setError("Doğum tarihi zorunludur.");
    if (!telGunduz.trim()) return setError("Gündüz telefonu zorunludur.");

    const yn = (v: YesNo): boolean | null => (v === "true" ? true : v === "false" ? false : null);

    setSubmitting(true);
    try {
      const res = await fetch("/api/job-application/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: F13_37.maddeler.map((m) => ({ itemNo: m.itemNo, deger: items[m.itemNo] === "true" })),
          ameliyatNotu: ameliyatNotu.trim() || null,
          gecmisHastalikNotu: gecmis.trim() || null,
          astimSoru1: yn(astim["astimSoru1"]),
          astimSoru1_1: astim1Evet ? yn(astim["astimSoru1_1"]) : null,
          astimSoru1_2: astim1Evet ? yn(astim["astimSoru1_2"]) : null,
          astimSoru2: yn(astim["astimSoru2"]),
          astimSoru3: yn(astim["astimSoru3"]),
          astimSoru4: yn(astim["astimSoru4"]),
          astimSoru5: yn(astim["astimSoru5"]),
          astimSoru6: yn(astim["astimSoru6"]),
          astimSoru7: yn(astim["astimSoru7"]),
          dogumTarihi: dogumTarihi || null,
          cinsiyet: cinsiyet || null,
          telefonGunduz: telGunduz.trim(),
          telefonGece: telGece.trim() || null,
          beyanAccepted: beyan,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        if (Array.isArray(d?.eksikItemNo)) setEksik(d.eksikItemNo);
        throw new Error(d?.error || "Kaydedilemedi");
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bir hata oluştu");
    } finally {
      setSubmitting(false);
    }
  }

  const YesNoToggle = ({ value, onChange, yesLabel = "VAR", noLabel = "YOK" }: {
    value: YesNo; onChange: (v: YesNo) => void; yesLabel?: string; noLabel?: string;
  }) => (
    <RadioGroup
      className="flex gap-4 shrink-0"
      value={value}
      onValueChange={(v) => onChange(v as YesNo)}
    >
      <label className="flex items-center gap-1.5 cursor-pointer text-sm">
        <RadioGroupItem value="true" /> {yesLabel}
      </label>
      <label className="flex items-center gap-1.5 cursor-pointer text-sm">
        <RadioGroupItem value="false" /> {noLabel}
      </label>
    </RadioGroup>
  );

  return (
    <div className="space-y-6">
      {/* ── Bölüm 1: F13.37 ── */}
      <div>
        <h2 className="text-lg font-semibold" style={{ color: NAVY }}>
          {F13_37.baslik}
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">Belge: {F13_37.documentCode}</p>
      </div>

      <div className="divide-y rounded-md border">
        {F13_37.maddeler.map((m) => {
          const isAmeliyat = m.itemNo === F13_37.AMELIYAT_ITEM_NO;
          const eksikVar = eksik.includes(m.itemNo);
          return (
            <div
              key={m.itemNo}
              ref={(el) => { itemRefs.current[m.itemNo] = el; }}
              className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 ${eksikVar ? "bg-red-50" : ""}`}
            >
              <span className="flex-1 text-sm text-gray-800">
                <b className="text-gray-400 mr-1">{m.itemNo}.</b>
                {m.itemLabel}
              </span>
              <YesNoToggle
                value={items[m.itemNo] ?? ""}
                onChange={(v) => setItem(m.itemNo, v)}
                yesLabel={isAmeliyat ? "EVET" : "VAR"}
                noLabel={isAmeliyat ? "HAYIR" : "YOK"}
              />
            </div>
          );
        })}
      </div>

      {ameliyatEvet && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {F13_37.ameliyatNotuLabel} <span className="text-red-500">*</span>
          </label>
          <Textarea value={ameliyatNotu} onChange={(e) => setAmeliyatNotu(e.target.value)} rows={2} />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {F13_37.gecmisHastalikNotuLabel}
        </label>
        <Textarea value={gecmis} onChange={(e) => setGecmis(e.target.value)} rows={2} />
      </div>

      <label className="flex items-start gap-2 cursor-pointer">
        <Checkbox checked={beyan} onCheckedChange={(v) => setBeyan(v === true)} className="mt-0.5" />
        <span className="text-sm text-gray-700">{F13_37.beyan}</span>
      </label>

      {/* ── Bölüm 2: F13.56 Astım ── */}
      <div className="pt-2 border-t">
        <h2 className="text-lg font-semibold" style={{ color: NAVY }}>
          {F13_56.baslik}
        </h2>
        <p className="text-xs font-medium text-amber-600 mt-1">{F13_56.ustNot}</p>
      </div>

      <div className="space-y-3">
        {F13_56.sorular.map((s) => {
          const isConditional = "parent" in s;
          if (isConditional && !astim1Evet) return null; // soru1 HAYIR → 1.1/1.2 gizli
          return (
            <div
              key={s.key}
              className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 ${isConditional ? "pl-4 sm:pl-8" : ""}`}
            >
              <span className="flex-1 text-sm text-gray-800">
                <b className="text-gray-400 mr-1">{s.no}.</b>
                {s.metin}
              </span>
              <YesNoToggle
                value={astim[s.key] ?? ""}
                onChange={(v) => setAstimQ(s.key, v)}
                yesLabel="EVET"
                noLabel="HAYIR"
              />
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Doğum Tarihi <span className="text-red-500">*</span>
          </label>
          <Input type="date" value={dogumTarihi} onChange={(e) => setDogumTarihi(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Test Tarihi</label>
          <Input type="date" value={todayISO()} readOnly disabled className="bg-gray-100" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cinsiyet <span className="text-red-500">*</span>
          </label>
          <Select value={cinsiyet} onChange={(e) => setCinsiyet(e.target.value)}>
            <option value="">Seçiniz</option>
            <option value="BAY">BAY</option>
            <option value="BAYAN">BAYAN</option>
          </Select>
        </div>
        <div />
      </div>

      {/* Telefon açıklaması (F13.56) */}
      <p className="text-sm text-gray-600">{F13_56.telefonAciklama}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Telefon (Gündüz) <span className="text-red-500">*</span>
          </label>
          <Input value={telGunduz} onChange={(e) => setTelGunduz(e.target.value)} inputMode="tel" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Telefon (Gece)</label>
          <Input value={telGece} onChange={(e) => setTelGece(e.target.value)} inputMode="tel" />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full sm:w-auto text-white"
        style={{ background: NAVY }}
      >
        {submitting ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Kaydediliyor…</>
        ) : (
          "Kaydet ve Başvuru Formuna Geç"
        )}
      </Button>
    </div>
  );
}

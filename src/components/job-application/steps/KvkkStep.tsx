"use client";

// Akış adım 1/3 — KVKK aydınlatma onayı (dijital imzalı).
// Ad-Soyad, TC (11 hane + algoritma), IK-T-866 metni, onay checkbox, canvas imza.
// POST /api/job-application/consent → başarıda onDone() (cookie set edilir).

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { validateTcKimlik } from "@/lib/job-application/tc-kimlik";
import { IK_T_866 } from "@/content/ik-t-866";
import { SignaturePad } from "./SignaturePad";

const NAVY = "#1B4F72";

export function KvkkStep({ onDone }: { onDone: () => void }) {
  const [adSoyad, setAdSoyad] = useState("");
  const [tc, setTc] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tcValid = validateTcKimlik(tc);
  const tcTouched = tc.length > 0;
  const canSubmit =
    adSoyad.trim().length >= 2 && tcValid && accepted && !!signature && !submitting;

  async function handleSubmit() {
    setError(null);
    if (!canSubmit) {
      if (!adSoyad.trim()) return setError("Ad Soyad zorunludur");
      if (!tcValid) return setError("Geçerli bir T.C. Kimlik No giriniz");
      if (!accepted) return setError("KVKK metnini onaylamanız zorunludur");
      if (!signature) return setError("İmza alanı boş bırakılamaz");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/job-application/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adSoyad: adSoyad.trim(),
          tcKimlikNo: tc.trim(),
          consentAccepted: accepted,
          signatureImage: signature,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || "Onay kaydedilemedi");
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bir hata oluştu");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: NAVY }}>
          KVKK Aydınlatma ve Muvafakatname
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Belge: {IK_T_866.documentCode} · Rev. {IK_T_866.documentRev} · İlk Yayın{" "}
          {IK_T_866.ilkYayin}
        </p>
      </div>

      {/* İki bölüm sırayla (kaydırılabilir) */}
      <div className="max-h-80 overflow-y-auto rounded-md border bg-gray-50 p-4 space-y-5">
        <section>
          <h3 className="text-sm font-semibold mb-2" style={{ color: NAVY }}>
            {IK_T_866.aydinlatma.baslik}
          </h3>
          <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
            {IK_T_866.aydinlatma.metin}
          </div>
        </section>
        <section className="border-t pt-4">
          <h3 className="text-sm font-semibold mb-2" style={{ color: NAVY }}>
            {IK_T_866.muvafakatname.baslik}
          </h3>
          <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
            {IK_T_866.muvafakatname.metin}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ad Soyad <span className="text-red-500">*</span>
          </label>
          <Input
            value={adSoyad}
            onChange={(e) => setAdSoyad(e.target.value)}
            placeholder="Ad Soyad"
            autoComplete="name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            T.C. Kimlik No <span className="text-red-500">*</span>
          </label>
          <Input
            value={tc}
            onChange={(e) => setTc(e.target.value.replace(/\D/g, "").slice(0, 11))}
            placeholder="11 haneli"
            inputMode="numeric"
            className={tcTouched && !tcValid ? "border-red-300 focus-visible:ring-red-400" : ""}
          />
          {tcTouched && !tcValid && (
            <p className="text-xs text-red-500 mt-1">Geçersiz T.C. Kimlik No</p>
          )}
        </div>
      </div>

      {/* İmza */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          İmza <span className="text-red-500">*</span>
        </label>
        <SignaturePad onChange={setSignature} disabled={submitting} />
      </div>

      {/* Onay */}
      <label className="flex items-start gap-2 cursor-pointer">
        <Checkbox
          checked={accepted}
          onCheckedChange={(v) => setAccepted(v === true)}
          className="mt-0.5"
        />
        <span className="text-sm text-gray-700">
          Aydınlatma metnini ve muvafakatnameyi{" "}
          <b>okudum, anladım, onaylıyorum</b>.
        </span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full sm:w-auto text-white"
        style={{ background: NAVY }}
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Kaydediliyor…
          </>
        ) : (
          "Onayla ve Devam Et"
        )}
      </Button>
    </div>
  );
}

"use client";

// İş başvuru akışı: 1/3 KVKK → 2/3 Sağlık Beyanı → 3/3 Başvuru Formu.
// Faz 1: KVKK adımı işlevsel; sağlık (Faz 2) placeholder; başvuru = mevcut renderer.
// KVKK onaylanmadan sonraki adımlar açılmaz (frontend akış + backend guard).

import { useState } from "react";
import { KvkkStep } from "./steps/KvkkStep";
import { JobApplicationRenderer } from "./JobApplicationRenderer";
import { Button } from "@/components/ui/button";

const NAVY = "#1B4F72";
type Step = 1 | 2 | 3;

const STEPS: { no: Step; label: string }[] = [
  { no: 1, label: "KVKK Onayı" },
  { no: 2, label: "Sağlık Beyanı" },
  { no: 3, label: "Başvuru Formu" },
];

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4 mb-6">
      {STEPS.map((s, i) => {
        const active = s.no === current;
        const done = s.no < current;
        return (
          <div key={s.no} className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white shrink-0"
                style={{ background: active || done ? NAVY : "#cbd5e1" }}
              >
                {s.no}
              </div>
              <span
                className={`text-xs sm:text-sm ${active ? "font-semibold" : "text-gray-500"} hidden xs:inline sm:inline`}
                style={active ? { color: NAVY } : undefined}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="h-0.5 w-4 sm:w-10"
                style={{ background: s.no < current ? NAVY : "#e2e8f0" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function JobApplicationFlow() {
  const [step, setStep] = useState<Step>(1);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <p className="text-center text-xs text-gray-400 mb-1">Adım {step}/3</p>
      <StepIndicator current={step} />

      <div className="rounded-xl border bg-white shadow-sm p-4 sm:p-6">
        {step === 1 && <KvkkStep onDone={() => setStep(2)} />}

        {step === 2 && (
          <div className="space-y-5 text-center py-6">
            <h2 className="text-lg font-semibold" style={{ color: NAVY }}>
              Sağlık Beyanı
            </h2>
            <p className="text-sm text-gray-600">
              KVKK onayınız alındı. Sağlık beyan formu bir sonraki aşamada
              (Faz 2) eklenecektir.
            </p>
            <Button
              type="button"
              onClick={() => setStep(3)}
              className="text-white"
              style={{ background: NAVY }}
            >
              Başvuru Formuna Geç
            </Button>
          </div>
        )}

        {step === 3 && <JobApplicationRenderer />}
      </div>
    </div>
  );
}

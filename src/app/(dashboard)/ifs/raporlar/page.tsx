"use client";

// IFS Raporlar — beş sekmelik kabuk. Tüm sekme bileşenleri _tabs altında.
//
// "Değerlendirme Raporu" akademi/admin/reports'tan TAŞINDI (ifs-evaluation-report
// + içinden çağırdığı ifs-bolum-report). Akademi kabuğunda artık IFS sekmesi YOK.
//
// Görünürlük hâlâ MEVCUT akademi izinleriyle: izin geçişi (ifs.*) ayrı adım.

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useAkademiAuth } from "@/lib/akademi-auth";
import { IfsRaporuTab } from "./_tabs/ifs-raporu";
import { IfsGorevDetayTab } from "./_tabs/ifs-gorev-detay";
import { IfsEvaluationsTab } from "./_tabs/ifs-evaluations";
import { IfsEvaluationReportTab } from "./_tabs/ifs-evaluation-report";
import { IfsKeyUserAtamaTab } from "./_tabs/ifs-keyuser-atama";

const TABS = [
  { id: "rapor", label: "IFS Raporu" },
  { id: "gorev-bazli", label: "Görev Bazlı" },
  { id: "degerlendirme", label: "Görev Değerlendirme" },
  { id: "degerlendirme-raporu", label: "Değerlendirme Raporu" },
  { id: "keyuser", label: "Key User Atama" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// Sekme → gerekli izinler (OR). Listede olmayan sekme, sayfayı görebilen
// herkese açık. IFS ayrıştırması TAMAM: eski akademi.admin kaldırıldı.
// Dizi biçimi korundu — ileride bir sekmeye ikinci anahtar gerekirse yapı hazır.
const TAB_IZIN: Partial<Record<TabId, string[]>> = {
  keyuser: ["ifs.admin"],
};

export default function IfsRaporlarPage() {
  const { data: session } = useSession();
  useAkademiAuth();
  const [activeTab, setActiveTab] = useState<TabId>("rapor");
  const izinler =
    (session?.user as { permissions?: string[] } | undefined)?.permissions ?? [];

  // Menü görünürlüğü kozmetik; asıl zorlama uçlarda.
  const gorunenTabs = TABS.filter((t) => {
    const gerekli = TAB_IZIN[t.id];
    return !gerekli || gerekli.some((k) => izinler.includes(k));
  });

  return (
    <div className="ak-animate-in space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">IFS Raporları</h1>
        <p className="text-sm" style={{ color: "var(--ak-text-secondary)" }}>
          Departman ve kişi bazında IFS eğitim durumu.
        </p>
      </div>

      <div
        className="flex flex-wrap gap-1 border-b"
        style={{ borderColor: "var(--ak-border-default)" }}
      >
        {gorunenTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === t.id
                ? "border-slate-900 text-slate-900"
                : "border-transparent"
            }`}
            style={
              activeTab === t.id
                ? undefined
                : { color: "var(--ak-text-secondary)" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === "rapor" && <IfsRaporuTab />}
        {activeTab === "gorev-bazli" && <IfsGorevDetayTab />}
        {activeTab === "degerlendirme" && <IfsEvaluationsTab />}
        {activeTab === "degerlendirme-raporu" && <IfsEvaluationReportTab />}
        {activeTab === "keyuser" && <IfsKeyUserAtamaTab />}
      </div>
    </div>
  );
}

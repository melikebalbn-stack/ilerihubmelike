"use client";

// IFS Raporlar — dört sekmelik kabuk.
// Sekme bileşenleri _tabs altında; akademi/admin/reports kabuğu geçiş süresince
// AYNI bileşenleri buradan gösteriyor (kopya yok). /ifs doğrulandıktan sonra
// akademi tarafındaki kayıtlar kaldırılacak.
//
// Görünürlük bu turda MEVCUT akademi izinleriyle: izin geçişi (ifs.*) ayrı adım.

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useAkademiAuth } from "@/lib/akademi-auth";
import { IfsRaporuTab } from "./_tabs/ifs-raporu";
import { IfsGorevDetayTab } from "./_tabs/ifs-gorev-detay";
import { IfsEvaluationsTab } from "./_tabs/ifs-evaluations";
import { IfsKeyUserAtamaTab } from "./_tabs/ifs-keyuser-atama";

const TABS = [
  { id: "rapor", label: "IFS Raporu" },
  { id: "gorev-bazli", label: "Görev Bazlı" },
  { id: "degerlendirme", label: "Görev Değerlendirme" },
  { id: "keyuser", label: "Key User Atama" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// Sekme → gerekli izin. Listede olmayan sekme, sayfayı görebilen herkese açık.
const TAB_IZIN: Partial<Record<TabId, string>> = {
  keyuser: "akademi.admin",
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
    return !gerekli || izinler.includes(gerekli);
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
        {activeTab === "keyuser" && <IfsKeyUserAtamaTab />}
      </div>
    </div>
  );
}

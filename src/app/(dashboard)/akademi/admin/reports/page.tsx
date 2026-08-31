"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { FileSpreadsheet } from "lucide-react";
import { useAkademiAuth } from "@/lib/akademi-auth";
import { UsersReportTab } from "./_tabs/users-report";
import { CoursesReportTab } from "./_tabs/courses-report";
import { ExamsReportTab } from "./_tabs/exams-report";
import { CertificatesReportTab } from "./_tabs/certificates-report";
import { DepartmentsReportTab } from "./_tabs/departments-report";
import { DepartmentBoardTab } from "./_tabs/department-board";
import { IfsEvaluationsTab } from "./_tabs/ifs-evaluations";
import { IfsEvaluationReportTab } from "./_tabs/ifs-evaluation-report";
import { IfsGorevDetayTab } from "./_tabs/ifs-gorev-detay";
import { IfsRaporuTab } from "./_tabs/ifs-raporu";
import { IfsKeyUserAtamaTab } from "./_tabs/ifs-keyuser-atama";

const TABS = [
  { id: "users", label: "Kullanıcılar" },
  { id: "courses", label: "Kurslar" },
  { id: "exams", label: "Sınavlar" },
  { id: "certificates", label: "Sertifikalar" },
  { id: "departments", label: "Bölümler" },
  { id: "department-board", label: "Departman Panosu" },
  { id: "ifs-evaluations", label: "Görev Değerlendirme" },
  { id: "ifs-report", label: "IFS Değerlendirme Raporu" },
  { id: "ifs-gorev-detay", label: "Görev Bazlı" },
  { id: "ifs-raporu", label: "IFS Raporu" },
  // Yalnız akademi.admin görür — aşağıda gorunenTabs ile süzülüyor.
  { id: "ifs-keyuser-atama", label: "Key User Atama" },
] as const;

// Sekme görünürlüğü: id → gerekli izin. Listede olmayan sekme herkese açık
// (mevcut davranış korunuyor); burada yalnız yeni admin-only sekme var.
const TAB_IZIN: Partial<Record<TabIdRaw, string>> = {
  "ifs-keyuser-atama": "akademi.admin",
};
type TabIdRaw = (typeof TABS)[number]["id"];

// Excel export'u olmayan (özel) sekmeler
const NO_EXPORT_TABS = [
  "department-board",
  "ifs-evaluations",
  "ifs-report",
  "ifs-gorev-detay",
  "ifs-raporu",
  "ifs-keyuser-atama",
];

type TabId = (typeof TABS)[number]["id"];

export default function ReportsPage() {
  const { data: session } = useSession();
  useAkademiAuth();
  const [activeTab, setActiveTab] = useState<TabId>("users");
  const izinler = (session?.user as { permissions?: string[] } | undefined)?.permissions ?? [];
  // Menü görünürlüğü kozmetik; asıl zorlama uçlarda (ifs-keyuser → akademi.admin).
  const gorunenTabs = TABS.filter((t) => {
    const gerekli = TAB_IZIN[t.id];
    return !gerekli || izinler.includes(gerekli);
  });

  return (
    <div className="ak-animate-in space-y-4">
      {!NO_EXPORT_TABS.includes(activeTab) && (
        <div className="flex items-center justify-end">
          <a
            href={`/api/akademi/admin/reports/export?type=${activeTab}`}
            className="bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800 inline-flex items-center gap-2 text-sm font-medium"
          >
            <FileSpreadsheet size={14} />
            Bu Sekmeyi Excel İndir
          </a>
        </div>
      )}

      <div
        className="border-b"
        style={{ borderColor: "var(--ak-border-divider)" }}
      >
        <div className="flex gap-1 overflow-x-auto">
          {gorunenTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === t.id
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        {activeTab === "users" && <UsersReportTab />}
        {activeTab === "courses" && <CoursesReportTab />}
        {activeTab === "exams" && <ExamsReportTab />}
        {activeTab === "certificates" && <CertificatesReportTab />}
        {activeTab === "departments" && <DepartmentsReportTab />}
        {activeTab === "department-board" && <DepartmentBoardTab />}
        {activeTab === "ifs-evaluations" && <IfsEvaluationsTab />}
        {activeTab === "ifs-report" && <IfsEvaluationReportTab />}
        {activeTab === "ifs-gorev-detay" && <IfsGorevDetayTab />}
        {activeTab === "ifs-raporu" && <IfsRaporuTab />}
        {activeTab === "ifs-keyuser-atama" && <IfsKeyUserAtamaTab />}
      </div>
    </div>
  );
}

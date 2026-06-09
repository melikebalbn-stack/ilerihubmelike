"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { useAkademiAuth } from "@/lib/akademi-auth";
import { UsersReportTab } from "./_tabs/users-report";
import { CoursesReportTab } from "./_tabs/courses-report";
import { ExamsReportTab } from "./_tabs/exams-report";
import { CertificatesReportTab } from "./_tabs/certificates-report";
import { DepartmentsReportTab } from "./_tabs/departments-report";
import { DepartmentBoardTab } from "./_tabs/department-board";
import { IfsEvaluationsTab } from "./_tabs/ifs-evaluations";

const TABS = [
  { id: "users", label: "Kullanıcılar" },
  { id: "courses", label: "Kurslar" },
  { id: "exams", label: "Sınavlar" },
  { id: "certificates", label: "Sertifikalar" },
  { id: "departments", label: "Bölümler" },
  { id: "department-board", label: "Departman Panosu" },
  { id: "ifs-evaluations", label: "Görev Değerlendirme" },
] as const;

// Excel export'u olmayan (özel) sekmeler
const NO_EXPORT_TABS = ["department-board", "ifs-evaluations"];

type TabId = (typeof TABS)[number]["id"];

export default function ReportsPage() {
  useAkademiAuth();
  const [activeTab, setActiveTab] = useState<TabId>("users");

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
          {TABS.map((t) => (
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
      </div>
    </div>
  );
}

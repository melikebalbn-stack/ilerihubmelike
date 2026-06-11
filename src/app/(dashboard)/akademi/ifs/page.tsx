"use client";

// IFS-6: Kullanıcı tarafı "IFS Eğitimleri" hiyerarşisi (3 seviyeli drill-down).
// Sv1 Departman (isIfs paketler) → Sv2 Alan (paket kursları, CourseCard reuse) →
// Sv3 İçerik (mevcut courses/[id] GOREV görünümü). Ad temizleme yalnız DISPLAY'de.
// IFS-6 SÜSLEME (dev): kapak banner + görsel departman kartları (gradient + ikon).

import { useEffect, useState, useCallback } from "react";
import {
  GraduationCap,
  ChevronRight,
  ArrowLeft,
  Warehouse,
  Factory,
  Share2,
  Wrench,
  Boxes,
  TrendingUp,
  Users,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import { CourseCard } from "@/components/akademi/courses/CourseCard";
import { getGradientForId } from "@/lib/akademi-helpers";
import type { CourseListItem } from "@/types/akademi";

interface Department {
  packageId: string;
  name: string;
  displayName: string;
  courseCount: number;
}

// Departman adına göre tematik ikon (bilinen anahtarlar + deterministik fallback —
// yeni departmanlar da otomatik tutarlı ikon alır).
const DEPT_ICON_SET: LucideIcon[] = [
  Boxes,
  Factory,
  Share2,
  Wrench,
  Warehouse,
  TrendingUp,
  Users,
  Settings2,
];
function deptIcon(name: string): LucideIcon {
  const n = name.toLocaleLowerCase("tr");
  if (n.includes("depo") || n.includes("envanter")) return Warehouse;
  if (n.includes("üretim") || n.includes("uretim")) return Factory;
  if (n.includes("ilişki") || n.includes("ilis") || n.includes("crm")) return Share2;
  if (n.includes("satı") || n.includes("pazar")) return TrendingUp;
  if (n.includes("bakım") || n.includes("bakim") || n.includes("servis")) return Wrench;
  if (n.includes("insan") || n.includes("personel")) return Users;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return DEPT_ICON_SET[h % DEPT_ICON_SET.length];
}

export default function AkademiIfsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [selected, setSelected] = useState<Department | null>(null);
  const [areas, setAreas] = useState<CourseListItem[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);

  useEffect(() => {
    fetch("/api/akademi/ifs/departments")
      .then((r) => (r.ok ? r.json() : { departments: [] }))
      .then((d) => setDepartments(d.departments ?? []))
      .catch(() => setDepartments([]))
      .finally(() => setLoadingDepts(false));
  }, []);

  const loadAreas = useCallback((pkgId: string) => {
    setLoadingAreas(true);
    fetch(`/api/akademi/ifs/areas?packageId=${encodeURIComponent(pkgId)}`)
      .then((r) => (r.ok ? r.json() : { courses: [] }))
      .then((d) => setAreas(d.courses ?? []))
      .catch(() => setAreas([]))
      .finally(() => setLoadingAreas(false));
  }, []);

  const openDept = (d: Department) => {
    setSelected(d);
    setAreas([]);
    loadAreas(d.packageId);
  };

  return (
    <div className="px-8 py-7 max-w-7xl mx-auto">
      {/* ── Kapak banner (ILERI navy → accent gradient) ── */}
      <div
        className="relative overflow-hidden rounded-2xl mb-6 ak-animate-in"
        style={{ background: "linear-gradient(135deg, #1B4F72 0%, #3878ff 100%)" }}
      >
        <GraduationCap
          className="absolute -right-5 -bottom-8 w-48 h-48 text-white opacity-10 pointer-events-none"
          strokeWidth={1.1}
        />
        <div className="relative p-6 sm:p-7 flex items-center gap-5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(255,255,255,0.16)" }}
          >
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white">IFS Eğitimleri</h1>
            <p className="text-sm text-white/85 mt-0.5">
              Departmanına göre IFS geçiş görevleri — referans doküman &amp;
              videolarla
            </p>
          </div>
        </div>
      </div>

      {/* ── Breadcrumb (Sv2'de) ── */}
      {selected && (
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="inline-flex items-center gap-2 text-sm font-medium mb-4"
          style={{ color: "var(--ak-text-secondary)" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Departmanlara Dön
          <ChevronRight className="w-3.5 h-3.5 opacity-50" />
          <span style={{ color: "var(--ak-text-primary)" }}>
            {selected.displayName}
          </span>
        </button>
      )}

      {!selected ? (
        // ── Sv1: Departmanlar (görsel kartlar) ──
        loadingDepts ? (
          <div
            className="text-center py-12 text-sm"
            style={{ color: "var(--ak-text-tertiary)" }}
          >
            Yükleniyor...
          </div>
        ) : departments.length === 0 ? (
          <div
            className="ak-card-static p-8 text-center text-sm"
            style={{ color: "var(--ak-text-tertiary)" }}
          >
            Henüz IFS eğitim departmanı yok.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {departments.map((d) => {
              const Icon = deptIcon(d.displayName);
              return (
                <button
                  key={d.packageId}
                  type="button"
                  onClick={() => openDept(d)}
                  className="ak-card block overflow-hidden h-full flex flex-col text-left transition-transform hover:-translate-y-1"
                >
                  {/* Gradient header + tematik ikon (CourseCard diliyle aynı) */}
                  <div
                    className="relative h-32 flex items-center justify-center"
                    style={{ background: getGradientForId(d.displayName) }}
                  >
                    <Icon className="w-12 h-12 text-white opacity-90" />
                    <div
                      className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{
                        background: "rgba(255,255,255,0.95)",
                        color: "var(--ak-accent)",
                      }}
                    >
                      {d.courseCount} alan
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <div
                      className="text-base font-bold line-clamp-2"
                      style={{ color: "var(--ak-text-primary)" }}
                    >
                      {d.displayName}
                    </div>
                    <div
                      className="text-xs mt-1"
                      style={{ color: "var(--ak-text-secondary)" }}
                    >
                      IFS geçiş eğitim alanları
                    </div>
                    <div
                      className="mt-auto flex items-center justify-end gap-1 text-sm font-semibold pt-3"
                      style={{ color: "var(--ak-accent)" }}
                    >
                      Aç
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )
      ) : (
        // ── Sv2: Alanlar (CourseCard reuse → Sv3 courses/[id]) ──
        <>
          {loadingAreas ? (
            <div
              className="text-center py-12 text-sm"
              style={{ color: "var(--ak-text-tertiary)" }}
            >
              Eğitim alanları yükleniyor...
            </div>
          ) : areas.length === 0 ? (
            <div
              className="ak-card-static p-8 text-center text-sm"
              style={{ color: "var(--ak-text-tertiary)" }}
            >
              Bu departmanda eğitim alanı yok.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {areas.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

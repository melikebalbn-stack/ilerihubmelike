"use client";

// IFS-6: Kullanıcı tarafı "IFS Eğitimleri" hiyerarşisi (3 seviyeli drill-down).
// Sv1 Departman (isIfs paketler) → Sv2 Alan (paket kursları, CourseCard reuse) →
// Sv3 İçerik (mevcut courses/[id] GOREV görünümü). Ad temizleme yalnız DISPLAY'de.

import { useEffect, useState, useCallback } from "react";
import { GraduationCap, ChevronRight, ArrowLeft } from "lucide-react";
import { CourseCard } from "@/components/akademi/courses/CourseCard";
import type { CourseListItem } from "@/types/akademi";

interface Department {
  packageId: string;
  name: string;
  displayName: string;
  courseCount: number;
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
      {/* Başlık / breadcrumb */}
      <div className="mb-6 ak-animate-in">
        <div
          className="flex items-center gap-1.5 text-sm mb-1"
          style={{ color: "var(--ak-text-secondary)" }}
        >
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="font-bold"
            style={{
              color: selected ? "var(--ak-accent)" : "var(--ak-text-primary)",
            }}
          >
            🎓 IFS Eğitimleri
          </button>
          {selected && (
            <>
              <ChevronRight className="w-4 h-4" />
              <span style={{ color: "var(--ak-text-primary)" }}>
                {selected.displayName}
              </span>
            </>
          )}
        </div>
        <p className="text-sm" style={{ color: "var(--ak-text-secondary)" }}>
          {selected
            ? "Eğitim alanını seçip görevlere ve referans dokümanlara ulaşın."
            : "Departmanını seçerek IFS geçiş eğitim alanlarına ulaşın."}
        </p>
      </div>

      {!selected ? (
        // ── Sv1: Departmanlar ──
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
            {departments.map((d) => (
              <button
                key={d.packageId}
                type="button"
                onClick={() => openDept(d)}
                className="ak-card p-5 flex items-center gap-4 text-left hover:translate-y-[-2px] transition-transform"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "var(--ak-accent-glow)" }}
                >
                  <GraduationCap
                    className="w-6 h-6"
                    style={{ color: "var(--ak-accent)" }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-base font-bold truncate"
                    style={{ color: "var(--ak-text-primary)" }}
                  >
                    {d.displayName}
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: "var(--ak-text-tertiary)" }}
                  >
                    {d.courseCount} eğitim alanı
                  </div>
                </div>
                <ChevronRight
                  className="w-5 h-5 shrink-0"
                  style={{ color: "var(--ak-text-tertiary)" }}
                />
              </button>
            ))}
          </div>
        )
      ) : (
        // ── Sv2: Alanlar (CourseCard reuse → Sv3 courses/[id]) ──
        <>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="inline-flex items-center gap-2 text-sm font-medium mb-4"
            style={{ color: "var(--ak-text-secondary)" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Departmanlara Dön
          </button>
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

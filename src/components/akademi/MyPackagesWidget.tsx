"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, ArrowRight, CheckCircle2, Circle } from "lucide-react";

interface PackageCourse {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  difficulty: string;
  duration: number | null;
  order: number;
  isRequired: boolean;
  progress: number;
  completedAt: string | null;
  isAssigned: boolean;
}

interface MyPackage {
  id: string;
  name: string;
  description: string | null;
  iconColor: string | null;
  source: "direct" | "bolum";
  courses: PackageCourse[];
}

export function MyPackagesWidget() {
  const [packages, setPackages] = useState<MyPackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/akademi/my-packages")
      .then((r) => (r.ok ? r.json() : { packages: [] }))
      .then((data) => setPackages(data.packages ?? []))
      .catch(() => setPackages([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return null;
  }

  if (packages.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <h2
        className="text-base font-bold mb-3 flex items-center gap-2"
        style={{ color: "var(--ak-text-primary)" }}
      >
        <Package className="w-4 h-4" />
        Eğitim Paketlerim
      </h2>
      <div className="space-y-3">
        {packages.map((pkg) => {
          const totalCourses = pkg.courses.length;
          const completedCourses = pkg.courses.filter(
            (c) => c.completedAt !== null
          ).length;
          const completionPct =
            totalCourses === 0
              ? 0
              : Math.round((completedCourses / totalCourses) * 100);

          return (
            <div
              key={pkg.id}
              className="ak-card-static p-4"
              style={{
                borderLeft: `3px solid ${pkg.iconColor || "var(--ak-accent)"}`,
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-sm font-semibold"
                      style={{ color: "var(--ak-text-primary)" }}
                    >
                      {pkg.name}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-md"
                      style={{
                        background: "var(--ak-surface-2)",
                        color: "var(--ak-text-tertiary)",
                      }}
                    >
                      {pkg.source === "direct" ? "Bireysel" : "Bölüm"}
                    </span>
                  </div>
                  {pkg.description && (
                    <p
                      className="text-xs mb-2"
                      style={{ color: "var(--ak-text-secondary)" }}
                    >
                      {pkg.description}
                    </p>
                  )}
                  <div
                    className="text-xs"
                    style={{ color: "var(--ak-text-tertiary)" }}
                  >
                    {completedCourses} / {totalCourses} kurs tamamlandı
                    <span className="mx-2">•</span>
                    %{completionPct}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                {pkg.courses.map((c) => (
                  <Link
                    key={c.id}
                    href={`/akademi/courses/${c.id}`}
                    className="flex items-center gap-2.5 p-2 rounded-md hover:bg-[var(--ak-surface-2)] transition-colors"
                  >
                    {c.completedAt ? (
                      <CheckCircle2
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: "var(--ak-accent)" }}
                      />
                    ) : (
                      <Circle
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: "var(--ak-text-tertiary)" }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-sm truncate"
                        style={{ color: "var(--ak-text-primary)" }}
                      >
                        {c.title}
                      </div>
                      {c.progress > 0 && c.progress < 100 && (
                        <div className="flex items-center gap-2 mt-0.5">
                          <div
                            className="flex-1 h-1 rounded-full overflow-hidden"
                            style={{ background: "var(--ak-surface-2)" }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${c.progress}%`,
                                background: "var(--ak-accent)",
                              }}
                            />
                          </div>
                          <span
                            className="text-xs"
                            style={{ color: "var(--ak-text-tertiary)" }}
                          >
                            %{Math.round(c.progress)}
                          </span>
                        </div>
                      )}
                    </div>
                    {!c.isAssigned && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          background: "var(--ak-surface-2)",
                          color: "var(--ak-text-tertiary)",
                        }}
                      >
                        Beklemede
                      </span>
                    )}
                    <ArrowRight
                      className="w-3.5 h-3.5 flex-shrink-0"
                      style={{ color: "var(--ak-text-tertiary)" }}
                    />
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

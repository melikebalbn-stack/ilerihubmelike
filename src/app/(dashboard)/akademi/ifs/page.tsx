"use client";

// IFS-6: Kullanıcı tarafı "IFS Eğitimleri" hiyerarşisi (3 seviyeli drill-down).
// Sv1 Departman (isIfs paketler) → Sv2 Alan (paket kursları, CourseCard reuse) →
// Sv3 İçerik (mevcut courses/[id] GOREV görünümü). Ad temizleme yalnız DISPLAY'de.
// IFS-6 SÜSLEME (dev): kapak banner + görsel departman kartları (gradient + ikon).

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  FileText,
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
  coverImageUrl: string | null;
}

// Paket-seviyesi referans PDF (alan kartlarının üstünde gösterilir).
interface ReferenceDoc {
  id: string;
  title: string;
  fileUrl: string;
  sortOrder: number;
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [selected, setSelected] = useState<Department | null>(null);
  const [areas, setAreas] = useState<CourseListItem[]>([]);
  const [refDocs, setRefDocs] = useState<ReferenceDoc[]>([]);
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
      .then((r) => (r.ok ? r.json() : { courses: [], referenceDocs: [] }))
      .then((d) => {
        setAreas(d.courses ?? []);
        setRefDocs(d.referenceDocs ?? []);
      })
      .catch(() => {
        setAreas([]);
        setRefDocs([]);
      })
      .finally(() => setLoadingAreas(false));
  }, []);

  const openDept = useCallback(
    (d: Department) => {
      setSelected(d);
      setAreas([]);
      setRefDocs([]);
      loadAreas(d.packageId);
      // Seçim URL'e yansısın (deep-link / geri-link hedefi).
      router.replace(`/akademi/ifs?dept=${encodeURIComponent(d.packageId)}`);
    },
    [loadAreas, router]
  );

  // Departman listesi yüklendikten SONRA ?dept=<packageId> varsa ve henüz seçim
  // yoksa eşleşen departmanı otomatik aç (deep-link / geri-link ile Sv2'ye gel).
  useEffect(() => {
    if (loadingDepts || selected || departments.length === 0) return;
    const dept = searchParams.get("dept");
    if (!dept) return;
    const match = departments.find((d) => d.packageId === dept);
    if (match) openDept(match);
  }, [loadingDepts, selected, departments, searchParams, openDept]);

  // Sv2 → Sv1 (tüm departmanlar): seçimi temizle + URL param'ı temizle.
  const backToDepartments = () => {
    setSelected(null);
    router.replace("/akademi/ifs");
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
          onClick={backToDepartments}
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
                  {/* Header: kapak görseli varsa onu, yoksa gradient + tematik ikon.
                      "X alan" badge her iki durumda da overlay kalır. */}
                  <div
                    className="relative h-32 flex items-center justify-center overflow-hidden"
                    style={{ background: getGradientForId(d.displayName) }}
                  >
                    {d.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={d.coverImageUrl}
                        alt={d.displayName}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <Icon className="w-12 h-12 text-white opacity-90" />
                    )}
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
          {/* Referans doküman bloğu — alan kartlarının ÜSTÜNDE (sortOrder asc).
              Doküman yoksa hiç render edilmez (boş kutu çıkmaz). */}
          {refDocs.length > 0 && (
            <div className="mb-6">
              <div
                className="flex items-center gap-2 mb-3 text-sm font-semibold"
                style={{ color: "var(--ak-text-secondary)" }}
              >
                <FileText className="w-4 h-4" style={{ color: "#1B4F72" }} />
                Referans Dokümanlar
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {refDocs.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ak-card flex items-center gap-3 p-4 transition-transform hover:-translate-y-0.5"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "rgba(27,79,114,0.10)" }}
                    >
                      <FileText className="w-5 h-5" style={{ color: "#1B4F72" }} />
                    </div>
                    <div className="min-w-0">
                      <div
                        className="text-sm font-semibold line-clamp-2"
                        style={{ color: "var(--ak-text-primary)" }}
                      >
                        {doc.title}
                      </div>
                      <div
                        className="text-xs mt-0.5"
                        style={{ color: "var(--ak-text-secondary)" }}
                      >
                        PDF · Yeni sekmede aç
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

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
                <CourseCard key={c.id} course={c} ifsDept={selected?.packageId} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

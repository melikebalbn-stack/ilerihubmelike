"use client";

// IFS eğitim dokümanı kataloğu — Ödevler ekranıyla AYNI desen:
// Sv1 departman kartları → Sv2 o departmanın dokümanları, AYNI SAYFADA.
//
// Neden ayrı rota değil: /ifs/egitimler/[packageId] şu an eski yönetim ekranı
// için /ifs/degerlendirme/[packageId]'ye yönlendiriyor; o yolu doküman listesine
// çevirmek eski yer imlerini sessizce başka ekrana düşürürdü. Ödevler de zaten
// Sv2'ye rota değiştirmeden geçiyor — desen birebir kopyalandı: seçim ?dept=
// ile URL'e yansır (deep-link), "Departmanlara Dön" ile temizlenir.
//
// Veri TEK uçtan: /api/akademi/ifs/documents. Dokümanlar paketle birlikte
// geldiği için Sv2 ek istek ATMAZ. Dokümansız paket uçta filtreleniyor, buraya
// hiç gelmiyor — "0 doküman" kartı ya da boş liste durumu yok.
//
// Kapak görselleri Ödevler'dekiyle AYNI CoursePackage kaydından; yeni görsel
// yüklenmedi. Kapağı olmayan paket gradient + tematik ikona düşer (bugün
// dokümanlı 8 paketin hepsinde kapak var, fallback yine de duruyor).

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GraduationCap,
  ChevronRight,
  ArrowLeft,
  FileText,
  ExternalLink,
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
import { getGradientForId } from "@/lib/akademi-helpers";

interface ReferenceDoc {
  id: string;
  title: string;
  fileUrl: string;
  sortOrder: number;
}

interface DocGroup {
  packageId: string;
  name: string;
  displayName: string;
  coverImageUrl: string | null;
  docs: ReferenceDoc[];
}

// Departman adına göre tematik ikon — Ödevler ekranındaki eşlemenin aynısı;
// aynı departman iki ekranda aynı ikonu alsın diye birebir kopyalandı.
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

export function IfsEgitimDokumanlari() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [gruplar, setGruplar] = useState<DocGroup[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [secili, setSecili] = useState<DocGroup | null>(null);
  // Deep-link auto-open YALNIZ ilk yükte bir kez; "Departmanlara Dön" sonrası
  // (URL ?dept henüz temizlenmeden) effect'in yeniden açmasını engeller.
  const didAutoOpenRef = useRef(false);

  useEffect(() => {
    let iptal = false;

    (async () => {
      let liste: DocGroup[] = [];
      try {
        const r = await fetch("/api/akademi/ifs/documents");
        const d = r.ok ? await r.json() : { groups: [] };
        liste = d.groups ?? [];
      } catch {
        liste = [];
      }
      if (iptal) return;
      setGruplar(liste);
      setYukleniyor(false);
    })();

    return () => {
      iptal = true;
    };
  }, []);

  const departmanAc = useCallback(
    (g: DocGroup) => {
      setSecili(g);
      // Seçim URL'e yansısın (deep-link / geri-link hedefi).
      router.replace(`/ifs/egitimler?dept=${encodeURIComponent(g.packageId)}`);
    },
    [router]
  );

  // Liste yüklendikten SONRA ?dept=<packageId> varsa ve henüz seçim yoksa
  // eşleşen departmanı otomatik aç (deep-link ile doğrudan Sv2'ye gel).
  useEffect(() => {
    if (didAutoOpenRef.current || yukleniyor || secili || gruplar.length === 0) return;
    const dept = searchParams.get("dept");
    if (!dept) return;
    const match = gruplar.find((g) => g.packageId === dept);
    if (match) {
      didAutoOpenRef.current = true;
      departmanAc(match);
    }
  }, [yukleniyor, secili, gruplar, searchParams, departmanAc]);

  // Sv2 → Sv1: seçimi temizle + URL param'ı temizle.
  const departmanlaraDon = () => {
    // Auto-open'ı kalıcı kapat: paramsız akışta (ref henüz false) "?dept" bir tık
    // geç temizlendiğinden stale param'la effect'in yeniden açmasını engeller.
    didAutoOpenRef.current = true;
    setSecili(null);
    router.replace("/ifs/egitimler");
  };

  return (
    <div className="px-8 py-7 max-w-7xl mx-auto">
      {/* ── Kapak banner (ILERI navy → accent gradient) — Ödevler ile aynı ── */}
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
              Departmanına tıkla, eğitim dokümanlarını aç. Görev listesi ve
              değerlendirmen için <strong>IFS Ödevleri</strong> ekranını kullan.
            </p>
          </div>
        </div>
      </div>

      {/* ── Breadcrumb (Sv2'de) ── */}
      {secili && (
        <button
          type="button"
          onClick={departmanlaraDon}
          className="inline-flex items-center gap-2 text-sm font-medium mb-4"
          style={{ color: "var(--ak-text-secondary)" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Departmanlara Dön
          <ChevronRight className="w-3.5 h-3.5 opacity-50" />
          <span style={{ color: "var(--ak-text-primary)" }}>{secili.displayName}</span>
        </button>
      )}

      {!secili ? (
        // ── Sv1: Departmanlar (görsel kartlar) ──
        yukleniyor ? (
          <div
            className="text-center py-12 text-sm"
            style={{ color: "var(--ak-text-tertiary)" }}
          >
            Yükleniyor...
          </div>
        ) : gruplar.length === 0 ? (
          <div
            className="rounded-lg border p-8 text-center text-sm"
            style={{ color: "var(--ak-text-secondary)" }}
          >
            Henüz eğitim dokümanı yüklenmemiş.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {gruplar.map((g) => {
              const Icon = deptIcon(g.displayName);
              return (
                <button
                  key={g.packageId}
                  type="button"
                  onClick={() => departmanAc(g)}
                  className="ak-card block overflow-hidden h-full flex flex-col text-left transition-transform hover:-translate-y-1"
                >
                  {/* Header: kapak görseli varsa onu, yoksa gradient + tematik ikon.
                      "X doküman" badge her iki durumda da overlay kalır. */}
                  <div
                    className="relative h-32 flex items-center justify-center overflow-hidden"
                    style={{ background: getGradientForId(g.displayName) }}
                  >
                    {g.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={g.coverImageUrl}
                        alt={g.displayName}
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
                      {g.docs.length} doküman
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <div
                      className="text-base font-bold line-clamp-2"
                      style={{ color: "var(--ak-text-primary)" }}
                    >
                      {g.displayName}
                    </div>
                    <div
                      className="text-xs mt-1"
                      style={{ color: "var(--ak-text-secondary)" }}
                    >
                      IFS Cloud eğitim dokümanları
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
        // ── Sv2: Seçilen departmanın dokümanları (ek istek YOK, veri Sv1'den) ──
        <div className="space-y-2">
          {secili.docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-md px-3 py-2.5"
              style={{ background: "var(--ak-surface-2)" }}
            >
              <FileText className="w-4 h-4 shrink-0" style={{ color: "#1B4F72" }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{doc.title}</div>
                <div className="text-xs" style={{ color: "var(--ak-text-secondary)" }}>
                  PDF · eğitim notları
                </div>
              </div>
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-md whitespace-nowrap shrink-0"
                style={{ background: "#1B4F72" }}
              >
                <ExternalLink className="w-[13px] h-[13px]" />
                Dokümanı aç
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

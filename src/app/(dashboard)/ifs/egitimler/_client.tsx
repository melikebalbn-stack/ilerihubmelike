"use client";

// IFS eğitim dokümanı kataloğu — departman satırı → dokümanlar (akordiyon).
//
// Ödevler ekranının kart deseni BİLEREK kopyalanmadı: ikisi menüde yan yana
// duruyor, aynı görünürlerse hangisinde olduğun anlaşılmıyor. Burada tek
// sütunlu sade liste var, açılınca dokümanlar satırın altında iner.
//
// Uçlar MEVCUT: /api/akademi/ifs/departments (paket listesi) +
// /api/akademi/ifs/areas?packageId= (referenceDocs içinde döner). Doküman
// sayısını tek başına veren uç YOK; yeni uç yazmamak için paket başına bir
// areas çağrısı yapılıyor (10 IFS paketi, sayfa açılışında bir kez) ve sonuç
// saklanıyor — satır açıldığında ikinci istek gitmiyor.

import { useEffect, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, ExternalLink, FileText } from "lucide-react";

interface Department {
  packageId: string;
  name: string;
  displayName: string;
  courseCount: number;
  coverImageUrl: string | null;
}

interface ReferenceDoc {
  id: string;
  title: string;
  fileUrl: string;
  sortOrder: number;
}

export function IfsEgitimDokumanlari() {
  const [departmanlar, setDepartmanlar] = useState<Department[]>([]);
  const [dokumanlar, setDokumanlar] = useState<Record<string, ReferenceDoc[]>>({});
  const [listeYukleniyor, setListeYukleniyor] = useState(true);
  const [sayilarHazir, setSayilarHazir] = useState(false);
  const [acikPaket, setAcikPaket] = useState<string | null>(null);

  useEffect(() => {
    let iptal = false;

    (async () => {
      let liste: Department[] = [];
      try {
        const r = await fetch("/api/akademi/ifs/departments");
        const d = r.ok ? await r.json() : { departments: [] };
        liste = d.departments ?? [];
      } catch {
        liste = [];
      }
      if (iptal) return;
      setDepartmanlar(liste);
      setListeYukleniyor(false);

      const sonuc = await Promise.all(
        liste.map(async (dep) => {
          try {
            const r = await fetch(
              `/api/akademi/ifs/areas?packageId=${encodeURIComponent(dep.packageId)}`
            );
            const j = r.ok ? await r.json() : { referenceDocs: [] };
            return [dep.packageId, (j.referenceDocs ?? []) as ReferenceDoc[]] as const;
          } catch {
            return [dep.packageId, [] as ReferenceDoc[]] as const;
          }
        })
      );
      if (iptal) return;
      setDokumanlar(Object.fromEntries(sonuc));
      setSayilarHazir(true);
    })();

    return () => {
      iptal = true;
    };
  }, []);

  const satirAc = (packageId: string) =>
    setAcikPaket((mevcut) => (mevcut === packageId ? null : packageId));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "#1B4F72" }}
        >
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-2xl font-semibold">IFS Eğitimleri</h1>
      </div>
      <p className="text-sm mb-6" style={{ color: "var(--ak-text-secondary)" }}>
        Departmanına tıkla, eğitim dokümanlarını aç. Görev listesi ve
        değerlendirmen için <strong>Ödevler</strong> ekranını kullan.
      </p>

      {listeYukleniyor ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-lg animate-pulse" style={{ background: "var(--ak-surface-2)" }} />
          ))}
        </div>
      ) : departmanlar.length === 0 ? (
        <div
          className="rounded-lg border p-8 text-center text-sm"
          style={{ color: "var(--ak-text-secondary)" }}
        >
          Görüntülenecek departman yok.
        </div>
      ) : (
        <div className="space-y-2">
          {departmanlar.map((dep) => {
            const acik = acikPaket === dep.packageId;
            const docs = dokumanlar[dep.packageId] ?? [];
            return (
              <div key={dep.packageId} className="rounded-lg border overflow-hidden">
                <button
                  type="button"
                  onClick={() => satirAc(dep.packageId)}
                  aria-expanded={acik}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
                >
                  {acik ? (
                    <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--ak-text-secondary)" }} />
                  ) : (
                    <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--ak-text-secondary)" }} />
                  )}
                  <span className="flex-1 min-w-0 truncate font-medium">{dep.displayName}</span>
                  <span
                    className="text-xs px-2 py-1 rounded-md whitespace-nowrap shrink-0"
                    style={{ background: "var(--ak-surface-2)", color: "var(--ak-text-secondary)" }}
                  >
                    {sayilarHazir ? `${docs.length} doküman` : "…"}
                  </span>
                </button>

                {acik && (
                  <div className="px-4 pb-3 pt-1 border-t">
                    {!sayilarHazir ? (
                      <div className="py-3 text-sm" style={{ color: "var(--ak-text-secondary)" }}>
                        Yükleniyor…
                      </div>
                    ) : docs.length === 0 ? (
                      <div className="py-3 text-sm" style={{ color: "var(--ak-text-secondary)" }}>
                        Bu departman için eğitim dokümanı henüz yüklenmemiş.
                      </div>
                    ) : (
                      <div className="space-y-2 pt-2">
                        {docs.map((doc) => (
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
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

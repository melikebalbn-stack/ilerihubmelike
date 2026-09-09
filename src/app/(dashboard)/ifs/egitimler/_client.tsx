"use client";

// IFS eğitim dokümanı kataloğu — departman satırı → dokümanlar (akordiyon).
//
// Ödevler ekranının kart deseni BİLEREK kopyalanmadı: ikisi menüde yan yana
// duruyor, aynı görünürlerse hangisinde olduğun anlaşılmıyor. Burada tek
// sütunlu sade liste var, açılınca dokümanlar satırın altında iner.
//
// Veri TEK uçtan: /api/akademi/ifs/documents. Eskiden departments + paket
// başına bir areas çağrısı vardı (10 paket = 11 istek); areas ucu bu ekran için
// fazla iş yapıyordu (kurslar, içerik sayımı, kullanıcı ilerlemesi) — oysa
// gereken yalnız referenceDocs.
//
// Dokümansız paket uçta filtreleniyor, buraya HİÇ GELMİYOR: "0 doküman" satırı
// ve "henüz yüklenmemiş" dalı bu yüzden yok. Tek istek olduğu için ayrı bir
// "sayılar hazır" durumu da gerekmiyor.

import { useEffect, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, ExternalLink, FileText } from "lucide-react";

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
  docs: ReferenceDoc[];
}

export function IfsEgitimDokumanlari() {
  const [gruplar, setGruplar] = useState<DocGroup[]>([]);
  const [listeYukleniyor, setListeYukleniyor] = useState(true);
  const [acikPaket, setAcikPaket] = useState<string | null>(null);

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
      setListeYukleniyor(false);
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
      ) : gruplar.length === 0 ? (
        <div
          className="rounded-lg border p-8 text-center text-sm"
          style={{ color: "var(--ak-text-secondary)" }}
        >
          Görüntülenecek departman yok.
        </div>
      ) : (
        <div className="space-y-2">
          {gruplar.map((dep) => {
            const acik = acikPaket === dep.packageId;
            const docs = dep.docs;
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
                    {`${docs.length} doküman`}
                  </span>
                </button>

                {acik && (
                  <div className="px-4 pb-3 pt-1 border-t">
                    {
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
                    }
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

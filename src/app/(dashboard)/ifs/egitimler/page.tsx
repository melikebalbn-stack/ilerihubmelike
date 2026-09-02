"use client";

// IFS EĞİTİMLER — departman → KİŞİ listesi.
//
// Departman satırına tıklanınca ALANLAR değil KİŞİLER açılır. Kişiye
// tıklanınca detay ORTADA AÇILAN MODALDA gelir (_kisi-modal.tsx); satırın
// altında açılan panel kaldırıldı — tablo içinde tablo büyüyordu ve uzun
// görev dökümünde tıklanan satır ekrandan kayıyordu.
//
// Uçlar: ifs-egitim-yapisi (departman listesi)
//        ifs-paket-kisiler?packageId=   (kişi satırları)
//        ifs-kisi-gorevler?userId=&packageId=  (görev dökümü)
//        ifs-keyuser-degerlendirme (PATCH — yalnız keyUserYetkim true iken)

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import {
  AMBER,
  IlerlemeCubuk,
  KanaatHucre,
  KisiDetayModal,
  type GorevlerVeri,
  type KisiSatir,
  type Seviye,
} from "./_kisi-modal";

interface Departman {
  packageId: string;
  ad: string;
  alanSayisi: number;
  gorevSayisi: number;
  atanmisKisi: number;
  ilerlemePct: number;
  egitimTalebi: number;
  degerlendirilmisSatir: number;
  kayitSayisi: number;
  pasif: boolean;
}
interface Yapi {
  /** Sunucuda hesaplanır: "tumu" (yönetici) | "kendi-bolumum" (key user). */
  kapsam?: "tumu" | "kendi-bolumum";
  ozet: { departmanSayisi: number; alanSayisi: number; gorevSayisi: number };
  departmanlar: Departman[];
}
interface KisilerVeri {
  packageId: string;
  ad: string;
  satirlar: KisiSatir[];
}

type Filtre = "tumu" | "atanmamis" | "pasif";

// İndirme deseni ifs-raporu.tsx'teki raporIndir'in aynısı: blob + geçici
// <a download> + revokeObjectURL, dosya adı Content-Disposition'dan.
// Ayrı bir yol icat edilmedi; yalnız uç ve parametreler farklı.
async function egitimIndir(
  kapsam: "ozet" | "departman" | "kisi",
  format: "xlsx" | "pdf",
  ek?: { packageId?: string; userId?: string }
): Promise<void> {
  const qs = new URLSearchParams({ kapsam, format });
  if (ek?.packageId) qs.set("packageId", ek.packageId);
  if (ek?.userId) qs.set("userId", ek.userId);

  const res = await fetch(
    `/api/akademi/admin/reports/ifs-egitim-export?${qs.toString()}`
  );
  if (!res.ok) {
    const msg = await res
      .json()
      .then((j) => j?.error)
      .catch(() => null);
    toast.error(
      msg ??
        (res.status === 401 || res.status === 403
          ? "Bu raporu indirme yetkiniz yok"
          : "Rapor indirilemedi")
    );
    return;
  }
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  const fallback = `IFS-${kapsam}.${format === "pdf" ? "pdf" : "xlsx"}`;
  const filename = match ? decodeURIComponent(match[1]) : fallback;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** İki küçük indirme düğmesi (XLSX / PDF) — üç yerde de aynı görünüm. */
function IndirDugmeleri({
  onIndir,
  etiket,
}: {
  onIndir: (f: "xlsx" | "pdf") => void;
  etiket: string;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      {(["xlsx", "pdf"] as const).map((f) => (
        <button
          key={f}
          type="button"
          title={`${etiket} — ${f.toUpperCase()}`}
          onClick={(e) => {
            e.stopPropagation();
            onIndir(f);
          }}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border"
          style={{
            borderColor: "var(--ak-border-default)",
            color: "var(--ak-text-secondary)",
          }}
        >
          <Download size={12} />
          {f.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export default function IfsEgitimlerPage() {
  const router = useRouter();
  const [veri, setVeri] = useState<Yapi | null>(null);
  const [loading, setLoading] = useState(true);
  const [acikDept, setAcikDept] = useState<string | null>(null);
  const [kisiler, setKisiler] = useState<Record<string, KisilerVeri | "yukleniyor">>({});
  // Modalda açık kişi: "packageId|userId". null ise modal kapalı.
  const [acikKisi, setAcikKisi] = useState<string | null>(null);
  const [gorevler, setGorevler] = useState<Record<string, GorevlerVeri | "yukleniyor">>({});
  const [kaydediliyor, setKaydediliyor] = useState<string | null>(null);
  const [arama, setArama] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tumu");

  useEffect(() => {
    fetch("/api/akademi/admin/reports/ifs-egitim-yapisi")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Yapi | null) => setVeri(d))
      .catch(() => setVeri(null))
      .finally(() => setLoading(false));
  }, []);

  const deptAc = useCallback(
    (packageId: string) => {
      if (acikDept === packageId) {
        setAcikDept(null);
        return;
      }
      setAcikDept(packageId);
      setAcikKisi(null);
      if (kisiler[packageId]) return;
      setKisiler((p) => ({ ...p, [packageId]: "yukleniyor" }));
      fetch(
        `/api/akademi/admin/reports/ifs-paket-kisiler?packageId=${encodeURIComponent(packageId)}`
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((d: KisilerVeri | null) =>
          setKisiler((p) => ({
            ...p,
            [packageId]: d ?? { packageId, ad: "", satirlar: [] },
          }))
        )
        .catch(() =>
          setKisiler((p) => ({
            ...p,
            [packageId]: { packageId, ad: "", satirlar: [] },
          }))
        );
    },
    [acikDept, kisiler]
  );

  // Modalı açar. Eskiden aynı satıra ikinci tık paneli kapatıyordu; modalda
  // kapatma yolu ayrı (Esc / arka plan / X), satır tıklaması hep açar.
  const kisiAc = useCallback(
    (packageId: string, userId: string) => {
      const k = `${packageId}|${userId}`;
      setAcikKisi(k);
      if (gorevler[k]) return;
      setGorevler((p) => ({ ...p, [k]: "yukleniyor" }));
      fetch(
        `/api/akademi/admin/reports/ifs-kisi-gorevler?userId=${encodeURIComponent(
          userId
        )}&packageId=${encodeURIComponent(packageId)}`
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((d: GorevlerVeri | null) =>
          setGorevler((p) => ({ ...p, [k]: d ?? { ad: "", gorevler: [] } }))
        )
        .catch(() =>
          setGorevler((p) => ({ ...p, [k]: { ad: "", gorevler: [] } }))
        );
    },
    [gorevler]
  );

  // Kaydetme modalın alt şeridinden gelir. Eskiden kayıttan sonra panel VE
  // departman kapanıyordu; modalda öyle yapmıyoruz — kişi listesi tazelenir,
  // modal açık kalır ki oklarla sıradakine geçilebilsin.
  const kaydet = useCallback(
    async (
      packageId: string,
      userId: string,
      courseId: string,
      seviye: Seviye | "",
      not: string
    ) => {
      setKaydediliyor(courseId);
      try {
        const res = await fetch(
          "/api/akademi/admin/reports/ifs-keyuser-degerlendirme",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              courseId,
              keyUserSeviye: seviye === "" ? null : seviye,
              keyUserNot: not.trim() || null,
            }),
          }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          toast.error(err?.error || "Kaydedilemedi");
          return;
        }
        toast.success("Key user değerlendirmesi kaydedildi");
        // Sunucudan taze oku — keyUserAt/giren ad sunucuda doluyor.
        const taze = await fetch(
          `/api/akademi/admin/reports/ifs-paket-kisiler?packageId=${encodeURIComponent(packageId)}`
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        if (taze) setKisiler((p) => ({ ...p, [packageId]: taze }));
      } finally {
        setKaydediliyor(null);
      }
    },
    []
  );

  const gorunen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr-TR");
    return (veri?.departmanlar ?? []).filter((d) => {
      if (filtre === "atanmamis" && d.atanmisKisi > 0) return false;
      if (filtre === "pasif" && !d.pasif) return false;
      if (!q) return true;
      return d.ad.toLocaleLowerCase("tr-TR").includes(q);
    });
  }, [veri, arama, filtre]);

  // ── Modal bagi ──
  // acikKisi "packageId|userId". Kisi listesi zaten kisiler[packageId] icinde;
  // onceki/sonraki icin o dizideki INDEKS yeterli, ayri state tutmuyoruz —
  // liste tazelendiginde (kayittan sonra) indeks kendiliginden dogru kalir.
  const modal = useMemo(() => {
    if (!acikKisi) return null;
    const [packageId, userId] = acikKisi.split("|");
    const kv = kisiler[packageId];
    if (!kv || kv === "yukleniyor") return null;
    const idx = kv.satirlar.findIndex((x) => x.userId === userId);
    if (idx < 0) return null;
    return { packageId, userId, kv, idx, satir: kv.satirlar[idx] };
  }, [acikKisi, kisiler]);

  // Modal kapanmadan komsu kisiye gecer; kisiAc yeni kisinin gorevlerini ceker.
  const kisiKaydir = useCallback(
    (yon: -1 | 1) => {
      if (!modal) return;
      const hedef = modal.kv.satirlar[modal.idx + yon];
      if (!hedef) return;
      kisiAc(modal.packageId, hedef.userId);
    },
    [modal, kisiAc]
  );

  const inputCls = "px-3 py-2 text-sm rounded-md border bg-white";

  return (
    <div className="ak-animate-in space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">IFS Eğitimleri</h1>
          <p className="text-sm" style={{ color: "var(--ak-text-secondary)" }}>
            {veri
              ? `${veri.ozet.departmanSayisi} departman · ${veri.ozet.alanSayisi} alan · ${veri.ozet.gorevSayisi} görev`
              : "—"}
            {/* Key user'da sayılar kendi bölümüne göre hesaplanır; aynı ekranı
                yönetici farklı sayılarla görür. Kapsam "tumu" ise hiçbir şey
                yazılmaz. */}
            {veri?.kapsam === "kendi-bolumum" && (
              <span style={{ color: "var(--ak-text-tertiary)" }}>
                {" · "}Yalnız kendi bölümünüz
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <IndirDugmeleri
            etiket="Özet dışa aktar"
            onIndir={(f) => egitimIndir("ozet", f)}
          />
          <button
            type="button"
            onClick={() => router.push("/akademi/admin/packages")}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md font-medium text-white"
            style={{ background: "#1B4F72" }}
          >
            <Plus size={14} />
            Yeni departman
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--ak-text-tertiary)" }}
          />
          <input
            className={`${inputCls} pl-9 min-w-[240px]`}
            style={{ borderColor: "var(--ak-border-default)" }}
            placeholder="Departman ara"
            value={arama}
            onChange={(e) => setArama(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {(
            [
              ["tumu", "Tümü"],
              ["atanmamis", "Atanmamış"],
              ["pasif", "Pasif"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFiltre(id)}
              className="px-3 py-1.5 text-xs rounded-md border"
              style={
                filtre === id
                  ? { background: "var(--ak-surface-secondary)", borderColor: "var(--ak-border-default)" }
                  : { borderColor: "transparent", color: "var(--ak-text-secondary)" }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="text-sm" style={{ color: "var(--ak-text-secondary)" }}>
          Yükleniyor…
        </div>
      )}

      {!loading && (
        <div
          className="rounded-lg border overflow-hidden"
          style={{ borderColor: "var(--ak-border-default)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--ak-surface-secondary)" }}>
                  <th className="px-2 py-2 w-8" />
                  <th className="px-3 py-2 text-left font-medium">Departman</th>
                  <th className="px-3 py-2 text-right font-medium">Alan</th>
                  <th className="px-3 py-2 text-right font-medium">Görev</th>
                  <th className="px-3 py-2 text-left font-medium">İlerleme</th>
                  <th className="px-3 py-2 w-12" />
                </tr>
              </thead>
              <tbody>
                {gorunen.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-8 text-center text-sm"
                      style={{ color: "var(--ak-text-tertiary)" }}
                    >
                      {arama || filtre !== "tumu"
                        ? "Eşleşen departman yok."
                        : "Henüz IFS departmanı yok."}
                    </td>
                  </tr>
                )}
                {gorunen.map((d) => {
                  const open = acikDept === d.packageId;
                  const kv = kisiler[d.packageId];
                  return (
                    <Fragment key={d.packageId}>
                      <tr
                        className="border-t cursor-pointer"
                        style={{ borderColor: "var(--ak-border-default)" }}
                        onClick={() => deptAc(d.packageId)}
                      >
                        <td className="px-2 py-2 align-top">
                          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="font-medium flex items-center gap-2">
                            {d.ad}
                            {d.pasif && (
                              <span
                                className="text-[11px] px-1.5 py-0.5 rounded"
                                style={{
                                  background: "var(--ak-surface-secondary)",
                                  color: "var(--ak-text-tertiary)",
                                }}
                              >
                                Pasif
                              </span>
                            )}
                          </div>
                          <div
                            className="text-xs"
                            style={{
                              color: d.atanmisKisi === 0 ? AMBER : "var(--ak-text-tertiary)",
                            }}
                          >
                            {d.atanmisKisi === 0
                              ? "Kimse atanmamış"
                              : `${d.atanmisKisi} kişi atanmış`}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right align-top">{d.alanSayisi}</td>
                        <td className="px-3 py-2 text-right align-top">{d.gorevSayisi}</td>
                        <td className="px-3 py-2 align-top">
                          {d.kayitSayisi === 0 ? (
                            <span className="text-xs" style={{ color: "var(--ak-text-tertiary)" }}>
                              —
                            </span>
                          ) : d.degerlendirilmisSatir === 0 ? (
                            <span className="text-xs" style={{ color: "var(--ak-text-tertiary)" }}>
                              Değerlendirilmedi
                            </span>
                          ) : (
                            <div className="space-y-1">
                              <IlerlemeCubuk pct={d.ilerlemePct} />
                              {d.egitimTalebi > 0 && (
                                <div className="text-[11px]" style={{ color: AMBER }}>
                                  {d.egitimTalebi} eğitim talebi
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right align-top">
                          <button
                            type="button"
                            title="Departmanı düzenle"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              router.push(`/ifs/egitimler/${d.packageId}`);
                            }}
                            className="p-1 rounded"
                            style={{ color: "var(--ak-text-secondary)" }}
                          >
                            <Pencil size={14} />
                          </button>
                        </td>
                      </tr>

                      {open && (
                        <tr style={{ background: "var(--ak-surface-secondary)" }}>
                          <td />
                          <td colSpan={5} className="px-3 py-3">
                            {kv === "yukleniyor" && (
                              <div className="text-xs" style={{ color: "var(--ak-text-secondary)" }}>
                                Yükleniyor…
                              </div>
                            )}
                            {kv && kv !== "yukleniyor" && (
                              <div className="flex justify-end pb-2">
                                <IndirDugmeleri
                                  etiket={`${d.ad} dışa aktar`}
                                  onIndir={(f) =>
                                    egitimIndir("departman", f, {
                                      packageId: d.packageId,
                                    })
                                  }
                                />
                              </div>
                            )}
                            {kv && kv !== "yukleniyor" && (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr style={{ color: "var(--ak-text-secondary)" }}>
                                    <th className="px-2 py-1 text-left font-medium">Kişi</th>
                                    <th className="px-2 py-1 text-right font-medium">Görev</th>
                                    <th className="px-2 py-1 text-left font-medium">İlerleme</th>
                                    <th className="px-2 py-1 text-left font-medium">Eğitmen</th>
                                    <th className="px-2 py-1 text-left font-medium">Key user</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {kv.satirlar.length === 0 && (
                                    <tr>
                                      <td colSpan={5} className="px-2 py-3 text-center"
                                          style={{ color: "var(--ak-text-tertiary)" }}>
                                        Bu departmanda kişi kaydı yok.
                                      </td>
                                    </tr>
                                  )}
                                  {kv.satirlar.map((s) => {
                                    const kk = `${d.packageId}|${s.userId}`;
                                    // Modal aÃ§Ä±kken bu satÄ±r arkada iÅaretli kalÄ±r.
                                    const secili = acikKisi === kk;
                                    return (
                                      <tr
                                        key={s.userId}
                                        className="border-t cursor-pointer"
                                        style={{
                                          borderColor: "var(--ak-border-default)",
                                          borderLeft: s.ayrisiyor
                                            ? `3px solid ${AMBER}`
                                            : "3px solid transparent",
                                          background: secili
                                            ? "var(--ak-accent-glow)"
                                            : undefined,
                                        }}
                                        onClick={() => kisiAc(d.packageId, s.userId)}
                                      >
                                        <td className="px-2 py-1.5 align-top">
                                          <div className="font-medium">{s.ad}</div>
                                          <div style={{ color: "var(--ak-text-tertiary)" }}>
                                            {s.bolum ?? "—"}
                                          </div>
                                          {!s.atamaVar && (
                                            <div style={{ color: AMBER }}>Atama kaydı yok</div>
                                          )}
                                          {s.ayrisiyor && (
                                            <div style={{ color: AMBER }}>
                                              Değerlendirmeler ayrışıyor
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-2 py-1.5 text-right align-top">
                                          {s.tamamlananGorev}/{s.toplamGorev}
                                        </td>
                                        <td className="px-2 py-1.5 align-top">
                                          <IlerlemeCubuk pct={s.ilerlemePct} />
                                        </td>
                                        <td className="px-2 py-1.5 align-top">
                                          <KanaatHucre k={s.egitmen} />
                                        </td>
                                        <td className="px-2 py-1.5 align-top">
                                          <KanaatHucre
                                            k={s.keyUser}
                                            onDegerlendir={
                                              s.keyUserYetkim
                                                ? () => kisiAc(d.packageId, s.userId)
                                                : undefined
                                            }
                                          />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <KisiDetayModal
          satir={modal.satir}
          paketAdi={modal.kv.ad}
          gorevler={gorevler[acikKisi!]}
          oncekiVar={modal.idx > 0}
          sonrakiVar={modal.idx < modal.kv.satirlar.length - 1}
          onOnceki={() => kisiKaydir(-1)}
          onSonraki={() => kisiKaydir(1)}
          onKapat={() => setAcikKisi(null)}
          kaydediliyorCourseId={kaydediliyor}
          onIndir={(f) =>
            egitimIndir("kisi", f, {
              packageId: modal.packageId,
              userId: modal.userId,
            })
          }
          onKaydet={(courseId, seviye, not) =>
            kaydet(modal.packageId, modal.userId, courseId, seviye, not)
          }
        />
      )}
    </div>
  );
}

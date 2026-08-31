"use client";

// IFS EĞİTİMLER — departman → alan yapısı, tek tablo.
//
// Veri: /api/akademi/admin/reports/ifs-egitim-yapisi (tek çağrı, paket bazlı).
// Bu ekran AdminPackagesTable / AdminCoursesTable KULLANMIYOR (o bileşenler
// akademi tarafında duruyor, silinmedi). Düzenleme akışları değişmedi —
// kalem ikonu mevcut paket/kurs detay yollarına gider.
//
// "IFS · " öneki hiçbir yerde görünmez (uç stripDeptPrefix ile kırpar).

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Pencil, Plus, Search } from "lucide-react";

interface Alan {
  courseId: string;
  ad: string;
  gorevSayisi: number;
  ilerlemePct: number;
  degerlendirilmisSatir: number;
  kayitSayisi: number;
  pasif: boolean;
}
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
  alanlar: Alan[];
}
interface Yapi {
  ozet: { departmanSayisi: number; alanSayisi: number; gorevSayisi: number };
  departmanlar: Departman[];
}

type Filtre = "tumu" | "atanmamis" | "pasif";

/** İlerleme hücresi — üç durum. Yüzde tek başına yanıltıcı olabiliyor. */
function IlerlemeHucre({
  pct,
  degerlendirilmis,
  kayit,
  egitimTalebi,
  ince = false,
}: {
  pct: number;
  degerlendirilmis: number;
  kayit: number;
  egitimTalebi?: number;
  ince?: boolean;
}) {
  if (kayit === 0) {
    return (
      <span className="text-xs" style={{ color: "var(--ak-text-tertiary)" }}>
        —
      </span>
    );
  }
  if (degerlendirilmis === 0) {
    return (
      <span
        className="text-xs"
        style={{ color: "var(--ak-text-tertiary)" }}
        title="Kursiyer kayıtları var ama eğitmen değerlendirmesi girilmemiş"
      >
        Değerlendirilmedi
      </span>
    );
  }
  return (
    <div className="space-y-1 min-w-[130px]">
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--ak-surface-secondary)" }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: "#1B4F72" }}
        />
      </div>
      <div className="text-xs" style={{ color: "var(--ak-text-secondary)" }}>
        %{pct}
        {!ince && egitimTalebi ? (
          <span style={{ color: "rgb(180,120,10)" }}>
            {" · "}
            {egitimTalebi} eğitim talebi
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function IfsEgitimlerPage() {
  const router = useRouter();
  const [veri, setVeri] = useState<Yapi | null>(null);
  const [loading, setLoading] = useState(true);
  const [acik, setAcik] = useState<Set<string>>(new Set());
  const [arama, setArama] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tumu");

  const yukle = useCallback(() => {
    setLoading(true);
    fetch("/api/akademi/admin/reports/ifs-egitim-yapisi")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Yapi | null) => setVeri(d))
      .catch(() => setVeri(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    yukle();
  }, [yukle]);

  const gorunen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr-TR");
    return (veri?.departmanlar ?? []).filter((d) => {
      if (filtre === "atanmamis" && d.atanmisKisi > 0) return false;
      if (filtre === "pasif" && !d.pasif) return false;
      if (!q) return true;
      // Alan adı da aransın — kullanıcı "Bordro" yazıp departmanı bulabilsin.
      return (
        d.ad.toLocaleLowerCase("tr-TR").includes(q) ||
        d.alanlar.some((a) => a.ad.toLocaleLowerCase("tr-TR").includes(q))
      );
    });
  }, [veri, arama, filtre]);

  const toggle = (id: string) =>
    setAcik((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const inputCls = "px-3 py-2 text-sm rounded-md border bg-white";

  return (
    <div className="ak-animate-in space-y-4">
      {/* ── Başlık + özet ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">IFS Eğitimleri</h1>
          <p className="text-sm" style={{ color: "var(--ak-text-secondary)" }}>
            {veri
              ? `${veri.ozet.departmanSayisi} departman · ${veri.ozet.alanSayisi} alan · ${veri.ozet.gorevSayisi} görev`
              : "—"}
          </p>
        </div>
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

      {/* ── Arama + filtre ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--ak-text-tertiary)" }}
          />
          <input
            className={`${inputCls} pl-9 min-w-[260px]`}
            style={{ borderColor: "var(--ak-border-default)" }}
            placeholder="Departman veya alan ara"
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
                  const open = acik.has(d.packageId);
                  return (
                    <Fragment key={d.packageId}>
                      <tr
                        className="border-t cursor-pointer"
                        style={{ borderColor: "var(--ak-border-default)" }}
                        onClick={() => toggle(d.packageId)}
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
                              color:
                                d.atanmisKisi === 0
                                  ? "rgb(180,120,10)"
                                  : "var(--ak-text-tertiary)",
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
                          <IlerlemeHucre
                            pct={d.ilerlemePct}
                            degerlendirilmis={d.degerlendirilmisSatir}
                            kayit={d.kayitSayisi}
                            egitimTalebi={d.egitimTalebi}
                          />
                        </td>
                        <td className="px-3 py-2 text-right align-top">
                          <button
                            type="button"
                            title="Departmanı düzenle"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              router.push(`/akademi/admin/packages/${d.packageId}`);
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
                          <td colSpan={5} className="px-3 py-2">
                            {d.alanlar.length === 0 && (
                              <div
                                className="text-xs py-2"
                                style={{ color: "var(--ak-text-tertiary)" }}
                              >
                                Bu departmanda alan yok.
                              </div>
                            )}
                            {d.alanlar.map((a) => (
                              <div
                                key={a.courseId}
                                className="flex items-center gap-3 py-1.5 border-b last:border-b-0"
                                style={{ borderColor: "var(--ak-border-default)" }}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium flex items-center gap-2">
                                    {a.ad}
                                    {a.pasif && (
                                      <span
                                        className="text-[11px] px-1 rounded"
                                        style={{ color: "var(--ak-text-tertiary)" }}
                                      >
                                        Pasif
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div
                                  className="text-xs w-16 text-right"
                                  style={{ color: "var(--ak-text-secondary)" }}
                                >
                                  {a.gorevSayisi} görev
                                </div>
                                <div className="w-[140px]">
                                  <IlerlemeHucre
                                    pct={a.ilerlemePct}
                                    degerlendirilmis={a.degerlendirilmisSatir}
                                    kayit={a.kayitSayisi}
                                    ince
                                  />
                                </div>
                                <button
                                  type="button"
                                  title="Alanı düzenle"
                                  onClick={() =>
                                    router.push(`/akademi/admin/courses/${a.courseId}`)
                                  }
                                  className="p-1 rounded"
                                  style={{ color: "var(--ak-text-secondary)" }}
                                >
                                  <Pencil size={14} />
                                </button>
                              </div>
                            ))}
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
    </div>
  );
}

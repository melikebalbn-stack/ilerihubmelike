"use client";

// IFS GÖREV BAZLI rapor — READ-ONLY.
// Mevcut "Görev Değerlendirme" sekmesi kişi→görev yönünde çalışıyor (önce çalışan
// seç, sonra görevlerini gör). Bu sekme aynı veriyi TERS eksende gösterir: her
// görev bir satır, satır açılınca o görevde kimin ne işaretlediği listelenir.
// Ana kullanım: "Eğitim Gerekli" filtresi — kursiyerlerin eğitim taleplerinin
// toplu görünümü (tek tıkla, kişi kişi gezmeden).

import { Fragment, useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type KursiyerDurum =
  | "ORNEK_YAPILDI"
  | "FARKLI_DEPARTMAN"
  | "EGITIM_GEREKLI"
  | "BEKLIYOR";
type OrnekStatus = "BASARILI" | "TEKRAR_GEREKLI" | "PENDING";

const DURUM_LABEL: Record<KursiyerDurum, string> = {
  ORNEK_YAPILDI: "Denedi",
  FARKLI_DEPARTMAN: "Farklı Dept.",
  EGITIM_GEREKLI: "Eğitim Gerekli",
  BEKLIYOR: "Bekliyor",
};
// Rozet renkleri ifs-evaluations sekmesindekiyle aynı (aynı kavram, aynı görsel dil).
const DURUM_STYLE: Record<KursiyerDurum, React.CSSProperties> = {
  ORNEK_YAPILDI: {
    background: "var(--ak-surface-secondary)",
    color: "var(--ak-text-primary)",
  },
  FARKLI_DEPARTMAN: {
    background: "var(--ak-surface-secondary)",
    color: "var(--ak-text-secondary)",
  },
  EGITIM_GEREKLI: {
    background: "rgba(245,158,11,0.15)",
    color: "rgb(180,120,10)",
  },
  BEKLIYOR: {
    background: "transparent",
    color: "var(--ak-text-tertiary)",
  },
};
const ORNEK_STATUS_LABEL: Record<OrnekStatus, string> = {
  BASARILI: "Başarılı",
  TEKRAR_GEREKLI: "Tekrar Gerekli",
  PENDING: "Bekliyor",
};

interface BoardMeta {
  scope: "full" | "own";
  bolums: string[];
}
interface CourseOpt {
  id: string;
  title: string;
  isIfs: boolean;
}
interface KisiRow {
  userId: string;
  ad: string;
  bolum: string | null;
  kursiyerDurum: KursiyerDurum;
  ornekYapildi: boolean;
  ornekStatus: OrnekStatus;
  ornekAciklama: string | null;
  degerlendirildiAt: string | null;
  degerlendirenAd: string | null;
}
interface GorevRow {
  contentId: string;
  konu: string;
  modul: string | null;
  altModul: string | null;
  ifsEkran: string | null;
  order: number;
  toplamKisi: number;
  dagilim: Record<KursiyerDurum, number>;
  ornekStatusDagilim: Record<OrnekStatus, number>;
  kisiler: KisiRow[];
}
interface GorevDetayData {
  courseId: string;
  courseTitle: string;
  scope: "full" | "own";
  bolums: string[];
  durum: KursiyerDurum | null;
  tasks: GorevRow[];
}

const fmtTarih = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("tr-TR") : "—";

export function IfsGorevDetayTab() {
  const [meta, setMeta] = useState<BoardMeta | null>(null);
  const [courses, setCourses] = useState<CourseOpt[]>([]);
  const [courseId, setCourseId] = useState("");
  const [bolum, setBolum] = useState(""); // "" = tüm kapsam
  const [durum, setDurum] = useState<KursiyerDurum | "">("");
  const [data, setData] = useState<GorevDetayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [acik, setAcik] = useState<Set<string>>(new Set());

  // Scope + bölümler + IFS kursları — ifs-evaluations sekmesiyle aynı kaynaklar.
  useEffect(() => {
    fetch("/api/akademi/admin/reports/department-board")
      .then((r) => (r.ok ? r.json() : null))
      .then((m: BoardMeta | null) => setMeta(m))
      .catch(() => setMeta(null));
    fetch("/api/akademi/admin/courses?includeInactive=true")
      .then((r) => (r.ok ? r.json() : { courses: [] }))
      .then((d) => {
        const ifs: CourseOpt[] = (d.courses ?? []).filter(
          (c: CourseOpt) => c.isIfs
        );
        setCourses(ifs);
        if (ifs.length) setCourseId(ifs[0].id);
      })
      .catch(() => setCourses([]));
  }, []);

  const load = useCallback(() => {
    if (!courseId) return;
    setLoading(true);
    const qs = new URLSearchParams({ courseId });
    if (bolum) qs.set("bolum", bolum);
    if (durum) qs.set("durum", durum);
    fetch(`/api/akademi/admin/reports/ifs-gorev-detay?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: GorevDetayData | null) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [courseId, bolum, durum]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id: string) =>
    setAcik((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const selectCls = "px-3 py-2 text-sm rounded-md border bg-white min-w-[200px]";
  const labelCls = "text-xs font-medium block";

  // Filtre uygulanmışken satırı gizlemek yerine "0 kişi" göstermek gürültü
  // yaratıyor; eşleşen kimse yoksa görev listeden düşer.
  const gorunenTasks = (data?.tasks ?? []).filter(
    (t) => !durum || t.kisiler.length > 0
  );

  return (
    <div className="space-y-4">
      {/* ── Filtreler ── */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className={labelCls} style={{ color: "var(--ak-text-secondary)" }}>
            IFS Eğitim Alanı
          </label>
          <select
            className={selectCls}
            style={{ borderColor: "var(--ak-border-default)" }}
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            {courses.length === 0 && <option value="">IFS kursu yok</option>}
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className={labelCls} style={{ color: "var(--ak-text-secondary)" }}>
            Bölüm
          </label>
          <select
            className={selectCls}
            style={{ borderColor: "var(--ak-border-default)" }}
            value={bolum}
            onChange={(e) => setBolum(e.target.value)}
            disabled={!meta || meta.bolums.length <= 1}
          >
            <option value="">Tüm bölümler</option>
            {(meta?.bolums ?? []).map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className={labelCls} style={{ color: "var(--ak-text-secondary)" }}>
            Kursiyer Durumu
          </label>
          <select
            className={selectCls}
            style={{ borderColor: "var(--ak-border-default)" }}
            value={durum}
            onChange={(e) => setDurum(e.target.value as KursiyerDurum | "")}
          >
            <option value="">Tümü</option>
            <option value="EGITIM_GEREKLI">Eğitim Gerekli</option>
            <option value="ORNEK_YAPILDI">Denedi</option>
            <option value="FARKLI_DEPARTMAN">Farklı Departman</option>
            <option value="BEKLIYOR">Hiç dokunmamış</option>
          </select>
        </div>

        {/* Ana kullanım kısayolu: 1 tıkla eğitim taleplerinin toplu görünümü. */}
        <button
          type="button"
          onClick={() => setDurum("EGITIM_GEREKLI")}
          className="px-3 py-2 text-sm rounded-md border font-medium"
          style={{
            borderColor: "rgba(245,158,11,0.4)",
            background:
              durum === "EGITIM_GEREKLI"
                ? "rgba(245,158,11,0.18)"
                : "transparent",
            color: "rgb(180,120,10)",
          }}
        >
          Eğitim Taleplerini Göster
        </button>
      </div>

      {/* ── Liste ── */}
      {loading && (
        <div className="text-sm" style={{ color: "var(--ak-text-secondary)" }}>
          Yükleniyor…
        </div>
      )}

      {!loading && data && (
        <>
          <div className="text-xs" style={{ color: "var(--ak-text-secondary)" }}>
            {data.courseTitle} · {gorunenTasks.length} görev
            {durum ? ` · filtre: ${DURUM_LABEL[durum as KursiyerDurum]}` : ""}
            {data.bolums.length === 1 ? ` · ${data.bolums[0]}` : ` · ${data.bolums.length} bölüm`}
          </div>

          <div
            className="rounded-lg border overflow-hidden"
            style={{ borderColor: "var(--ak-border-default)" }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--ak-surface-secondary)" }}>
                    <th className="px-2 py-2 w-8" />
                    <th className="px-3 py-2 text-left font-medium">Konu</th>
                    <th className="px-3 py-2 text-left font-medium">Modül</th>
                    <th className="px-2 py-2 text-center font-medium">Kişi</th>
                    <th className="px-3 py-2 text-left font-medium">Dağılım</th>
                  </tr>
                </thead>
                <tbody>
                  {gorunenTasks.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-6 text-center text-sm"
                        style={{ color: "var(--ak-text-tertiary)" }}
                      >
                        Eşleşen görev yok.
                      </td>
                    </tr>
                  )}
                  {gorunenTasks.map((t) => {
                    const open = acik.has(t.contentId);
                    return (
                      <Fragment key={t.contentId}>
                        <tr
                          className="border-t cursor-pointer"
                          style={{ borderColor: "var(--ak-border-default)" }}
                          onClick={() => toggle(t.contentId)}
                        >
                          <td className="px-2 py-2 align-top">
                            {open ? (
                              <ChevronDown size={14} />
                            ) : (
                              <ChevronRight size={14} />
                            )}
                          </td>
                          <td className="px-3 py-2 align-top">
                            <div className="font-medium">{t.konu}</div>
                            {t.ifsEkran && (
                              <div
                                className="text-xs"
                                style={{ color: "var(--ak-text-tertiary)" }}
                              >
                                {t.ifsEkran}
                              </div>
                            )}
                          </td>
                          <td
                            className="px-3 py-2 align-top text-xs"
                            style={{ color: "var(--ak-text-secondary)" }}
                          >
                            {t.modul ?? "—"}
                            {t.altModul ? ` / ${t.altModul}` : ""}
                          </td>
                          <td className="px-2 py-2 text-center align-top">
                            {t.toplamKisi}
                          </td>
                          <td className="px-3 py-2 align-top">
                            <div className="flex flex-wrap gap-1">
                              {(
                                [
                                  "EGITIM_GEREKLI",
                                  "ORNEK_YAPILDI",
                                  "FARKLI_DEPARTMAN",
                                  "BEKLIYOR",
                                ] as KursiyerDurum[]
                              ).map((d) =>
                                t.dagilim[d] > 0 ? (
                                  <Badge
                                    key={d}
                                    style={DURUM_STYLE[d]}
                                    title={DURUM_LABEL[d]}
                                  >
                                    {DURUM_LABEL[d]}: {t.dagilim[d]}
                                  </Badge>
                                ) : null
                              )}
                            </div>
                          </td>
                        </tr>

                        {open && (
                          <tr style={{ background: "var(--ak-surface-secondary)" }}>
                            <td />
                            <td colSpan={4} className="px-3 py-3">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr
                                    style={{ color: "var(--ak-text-secondary)" }}
                                  >
                                    <th className="px-2 py-1 text-left font-medium">
                                      Çalışan
                                    </th>
                                    <th className="px-2 py-1 text-left font-medium">
                                      Bölüm
                                    </th>
                                    <th className="px-2 py-1 text-left font-medium">
                                      Kursiyer Durumu
                                    </th>
                                    <th className="px-2 py-1 text-left font-medium">
                                      Örnek Durumu
                                    </th>
                                    <th className="px-2 py-1 text-left font-medium">
                                      Kursiyer Açıklaması
                                    </th>
                                    <th className="px-2 py-1 text-left font-medium">
                                      Değerlendirme
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {t.kisiler.length === 0 && (
                                    <tr>
                                      <td
                                        colSpan={6}
                                        className="px-2 py-3 text-center"
                                        style={{
                                          color: "var(--ak-text-tertiary)",
                                        }}
                                      >
                                        Bu görevde eşleşen kişi yok.
                                      </td>
                                    </tr>
                                  )}
                                  {t.kisiler.map((k) => (
                                    <tr
                                      key={k.userId}
                                      className="border-t"
                                      style={{
                                        borderColor: "var(--ak-border-default)",
                                      }}
                                    >
                                      <td className="px-2 py-1.5">{k.ad}</td>
                                      <td
                                        className="px-2 py-1.5"
                                        style={{
                                          color: "var(--ak-text-secondary)",
                                        }}
                                      >
                                        {k.bolum ?? "—"}
                                      </td>
                                      <td className="px-2 py-1.5">
                                        <Badge
                                          style={DURUM_STYLE[k.kursiyerDurum]}
                                        >
                                          {DURUM_LABEL[k.kursiyerDurum]}
                                        </Badge>
                                      </td>
                                      <td className="px-2 py-1.5">
                                        {ORNEK_STATUS_LABEL[k.ornekStatus]}
                                      </td>
                                      <td
                                        className="px-2 py-1.5 whitespace-pre-wrap break-words max-w-[320px]"
                                        style={{
                                          color: "var(--ak-text-secondary)",
                                        }}
                                      >
                                        {k.ornekAciklama ?? "—"}
                                      </td>
                                      <td
                                        className="px-2 py-1.5"
                                        style={{
                                          color: "var(--ak-text-secondary)",
                                        }}
                                      >
                                        {k.degerlendirildiAt
                                          ? `${fmtTarih(k.degerlendirildiAt)}${
                                              k.degerlendirenAd
                                                ? ` · ${k.degerlendirenAd}`
                                                : ""
                                            }`
                                          : "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
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
        </>
      )}
    </div>
  );
}

"use client";

// IFS RAPORU — iki seviyeli tek ekran. Üst filtre YOK: sayfa açılır açılmaz
// departman listesi gelir (seviye 1), satıra tıklanınca o bölümün kişi × eğitim
// satırları açılır (seviye 2, tıklandığında yüklenir).
//
// Uçlar: reports/ifs-departman-ozet (parametresiz)
//        reports/ifs-departman-kisiler?bolum=...
// "Görev Bazlı" sekmesi ve ifs-gorev-detay ucu bu ekrandan BAĞIMSIZ, duruyor.

import { Fragment, useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

type Seviye = "BASARILI" | "EGITIM_GEREKLI" | "BASARISIZ";

const SEVIYE_LABEL: Record<Seviye, string> = {
  BASARILI: "Başarılı",
  EGITIM_GEREKLI: "Eğitime İhtiyacı Var",
  BASARISIZ: "Başarısız",
};
const SEVIYE_STYLE: Record<Seviye, React.CSSProperties> = {
  BASARILI: { background: "rgba(16,185,129,0.15)", color: "rgb(6,120,90)" },
  EGITIM_GEREKLI: { background: "rgba(245,158,11,0.15)", color: "rgb(180,120,10)" },
  BASARISIZ: { background: "rgba(239,68,68,0.15)", color: "rgb(180,40,40)" },
};

interface BolumRow {
  bolum: string;
  egitimAlanKisi: number;
  basariPct: number;
  /** Eğitmen kararı verilmiş satır (BASARILI + TEKRAR_GEREKLI). */
  degerlendirilmisSatir: number;
  egitimGerekli: number;
}
interface OzetData {
  scope: "full" | "own";
  bolums: BolumRow[];
}
interface DegerlendirmeAlan {
  seviye: Seviye | null;
  not: string | null;
  girenAd: string | null;
  girenAt: string | null;
}
interface KisiRow {
  userId: string;
  ad: string;
  courseId: string;
  egitimAdi: string;
  toplamGorev: number;
  basariliGorev: number;
  basarisizGorev: number;
  /** Eğitmen kararı verilmiş görev sayısı; 0 ise pct anlamsız. */
  degerlendirilmisGorev: number;
  pct: number;
  degerlendirme: DegerlendirmeAlan;
  egitimIhtiyaci: number;
  keyUser: DegerlendirmeAlan;
}
interface KisilerData {
  bolum: string;
  scope: "full" | "own";
  /** Sunucuda hesaplanır: izin + bu bölüme atanmış key user olma. */
  keyUserYetkim: boolean;
  satirlar: KisiRow[];
}
interface EgitimGorev {
  contentId: string;
  konu: string;
  order: number;
  modul: string | null;
  altModul: string | null;
  ifsEkran: string | null;
  ornekAciklama: string | null;
  degerlendirildiAt: string | null;
}
interface EgitimIstenenData {
  ad: string;
  egitimAdi: string;
  gorevler: EgitimGorev[];
}

/**
 * Yüzde hücresi. Eğitmen kararı verilmiş satır YOKSA %0 yazmak yanıltıcı —
 * başarısızlık gibi okunuyor; oysa kimse değerlendirmemiş demek. O durumda
 * yüzde yerine soluk bir "Değerlendirilmedi" ibaresi gösterilir (rozet değil).
 */
function YuzdeHucre({ pct, degerlendirilmis }: { pct: number; degerlendirilmis: number }) {
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
  return <>%{pct}</>;
}

/** seviye + altında giren kişi adı; veri yoksa "—". */
function DegerlendirmeHucre({ d }: { d: DegerlendirmeAlan }) {
  if (!d.seviye && !d.not && !d.girenAd) {
    return (
      <span className="text-xs" style={{ color: "var(--ak-text-tertiary)" }}>
        —
      </span>
    );
  }
  return (
    <div className="space-y-0.5">
      {d.seviye && (
        <Badge style={SEVIYE_STYLE[d.seviye]} title={d.not ?? undefined}>
          {SEVIYE_LABEL[d.seviye]}
        </Badge>
      )}
      {d.girenAd && (
        <div className="text-[11px]" style={{ color: "var(--ak-text-tertiary)" }}>
          {d.girenAd}
        </div>
      )}
    </div>
  );
}

export function IfsRaporuTab() {
  const [ozet, setOzet] = useState<OzetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acikBolum, setAcikBolum] = useState<string | null>(null);
  const [kisiler, setKisiler] = useState<Record<string, KisilerData | "yukleniyor">>({});
  const [bosGoster, setBosGoster] = useState(false);
  // "Eğitim İstenen Görev" açılır paneli — anahtar: `${userId}|${courseId}`
  const [acikEgitim, setAcikEgitim] = useState<string | null>(null);
  const [egitimler, setEgitimler] = useState<
    Record<string, EgitimIstenenData | "yukleniyor">
  >({});
  // Key user düzenleme taslağı — anahtar aynı; kaydedilene kadar yerelde durur.
  const [taslak, setTaslak] = useState<
    Record<string, { seviye: Seviye | ""; not: string }>
  >({});
  const [kaydediliyor, setKaydediliyor] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/akademi/admin/reports/ifs-departman-ozet")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: OzetData | null) => setOzet(d))
      .catch(() => setOzet(null))
      .finally(() => setLoading(false));
  }, []);

  const bolumAc = useCallback(
    (bolum: string) => {
      if (acikBolum === bolum) {
        setAcikBolum(null);
        return;
      }
      setAcikBolum(bolum);
      if (kisiler[bolum]) return; // bir kez yüklenen bölüm tekrar çekilmez
      setKisiler((p) => ({ ...p, [bolum]: "yukleniyor" }));
      fetch(
        `/api/akademi/admin/reports/ifs-departman-kisiler?bolum=${encodeURIComponent(bolum)}`
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((d: KisilerData | null) =>
          setKisiler((p) => ({
            ...p,
            [bolum]: d ?? { bolum, scope: "own", keyUserYetkim: false, satirlar: [] },
          }))
        )
        .catch(() =>
          setKisiler((p) => ({
            ...p,
            [bolum]: { bolum, scope: "own", keyUserYetkim: false, satirlar: [] },
          }))
        );
    },
    [acikBolum, kisiler]
  );

  const egitimAc = useCallback(
    (userId: string, courseId: string) => {
      const k = `${userId}|${courseId}`;
      if (acikEgitim === k) {
        setAcikEgitim(null);
        return;
      }
      setAcikEgitim(k);
      if (egitimler[k]) return; // bir kez çekilir
      setEgitimler((p) => ({ ...p, [k]: "yukleniyor" }));
      fetch(
        `/api/akademi/admin/reports/ifs-egitim-istenen?userId=${encodeURIComponent(
          userId
        )}&courseId=${encodeURIComponent(courseId)}`
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((d: EgitimIstenenData | null) =>
          setEgitimler((p) => ({
            ...p,
            [k]: d ?? { ad: "", egitimAdi: "", gorevler: [] },
          }))
        )
        .catch(() =>
          setEgitimler((p) => ({
            ...p,
            [k]: { ad: "", egitimAdi: "", gorevler: [] },
          }))
        );
    },
    [acikEgitim, egitimler]
  );

  const keyUserKaydet = useCallback(
    async (bolum: string, s: KisiRow) => {
      const k = `${s.userId}|${s.courseId}`;
      const t = taslak[k] ?? {
        seviye: (s.keyUser.seviye ?? "") as Seviye | "",
        not: s.keyUser.not ?? "",
      };
      setKaydediliyor(k);
      try {
        const res = await fetch(
          "/api/akademi/admin/reports/ifs-keyuser-degerlendirme",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: s.userId,
              courseId: s.courseId,
              keyUserSeviye: t.seviye === "" ? null : t.seviye,
              keyUserNot: t.not.trim() || null,
            }),
          }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          toast.error(err?.error || "Kaydedilemedi");
          return;
        }
        toast.success("Key user değerlendirmesi kaydedildi");
        // Sunucudan taze oku — keyUserAt/giren ad sunucuda dolduruluyor.
        setKisiler((p) => {
          const n = { ...p };
          delete n[bolum];
          return n;
        });
        setAcikBolum(null);
        setTaslak((p) => {
          const n = { ...p };
          delete n[k];
          return n;
        });
      } finally {
        setKaydediliyor(null);
      }
    },
    [taslak]
  );

  const dolu = (ozet?.bolums ?? []).filter((b) => b.egitimAlanKisi > 0);
  const bos = (ozet?.bolums ?? []).filter((b) => b.egitimAlanKisi === 0);

  const thCls = "px-3 py-2 text-left font-medium";
  const thNumCls = "px-3 py-2 text-right font-medium";

  const bolumSatiri = (b: BolumRow) => {
    const open = acikBolum === b.bolum;
    const detay = kisiler[b.bolum];
    return (
      <Fragment key={b.bolum}>
        <tr
          className="border-t cursor-pointer"
          style={{ borderColor: "var(--ak-border-default)" }}
          onClick={() => bolumAc(b.bolum)}
        >
          <td className="px-2 py-2 w-8">
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </td>
          <td className="px-3 py-2 font-medium">{b.bolum}</td>
          <td className="px-3 py-2 text-right">{b.egitimAlanKisi}</td>
          <td className="px-3 py-2 text-right">
            <YuzdeHucre pct={b.basariPct} degerlendirilmis={b.degerlendirilmisSatir} />
          </td>
          <td className="px-3 py-2 text-right">
            {b.egitimGerekli > 0 ? (
              <span
                className="font-semibold px-2 py-0.5 rounded"
                style={{
                  background: "rgba(245,158,11,0.15)",
                  color: "rgb(180,120,10)",
                }}
              >
                {b.egitimGerekli}
              </span>
            ) : (
              <span style={{ color: "var(--ak-text-tertiary)" }}>0</span>
            )}
          </td>
        </tr>

        {open && (
          <tr style={{ background: "var(--ak-surface-secondary)" }}>
            <td />
            <td colSpan={4} className="px-3 py-3">
              {detay === "yukleniyor" && (
                <div className="text-xs" style={{ color: "var(--ak-text-secondary)" }}>
                  Yükleniyor…
                </div>
              )}
              {detay && detay !== "yukleniyor" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ color: "var(--ak-text-secondary)" }}>
                        <th className="px-2 py-1 text-left font-medium">Kişi</th>
                        <th className="px-2 py-1 text-left font-medium">Eğitim Adı</th>
                        <th className="px-2 py-1 text-right font-medium">Toplam Görev</th>
                        <th className="px-2 py-1 text-right font-medium">Başarılı</th>
                        <th className="px-2 py-1 text-right font-medium">Başarısız</th>
                        <th className="px-2 py-1 text-right font-medium">%</th>
                        <th className="px-2 py-1 text-left font-medium">Değerlendirme</th>
                        <th className="px-2 py-1 text-right font-medium">
                          Eğitim İstenen Görev
                        </th>
                        <th className="px-2 py-1 text-left font-medium">
                          Key User Değerlendirmesi
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detay.satirlar.length === 0 && (
                        <tr>
                          <td
                            colSpan={9}
                            className="px-2 py-3 text-center"
                            style={{ color: "var(--ak-text-tertiary)" }}
                          >
                            Bu bölümde değerlendirme kaydı yok.
                          </td>
                        </tr>
                      )}
                      {detay.satirlar.map((s, i) => {
                        // Görsel gruplama: aynı kişinin ardışık satırlarında ad
                        // yalnız ilkinde yazılır (uç zaten ada göre sıralı döner).
                        const ilkSatir =
                          i === 0 || detay.satirlar[i - 1].userId !== s.userId;
                        const k = `${s.userId}|${s.courseId}`;
                        const egitimAcik = acikEgitim === k;
                        const egitimVeri = egitimler[k];
                        const t = taslak[k] ?? {
                          seviye: (s.keyUser.seviye ?? "") as Seviye | "",
                          not: s.keyUser.not ?? "",
                        };
                        return (
                        <Fragment key={k}>
                          <tr
                            className={ilkSatir ? "border-t" : ""}
                            style={{ borderColor: "var(--ak-border-default)" }}
                          >
                            <td className="px-2 py-1.5 font-medium align-top">
                              {ilkSatir ? s.ad : ""}
                            </td>
                            <td className="px-2 py-1.5 align-top">{s.egitimAdi}</td>
                            <td className="px-2 py-1.5 text-right align-top">
                              {s.toplamGorev}
                            </td>
                            <td className="px-2 py-1.5 text-right align-top">
                              {s.basariliGorev}
                            </td>
                            <td className="px-2 py-1.5 text-right align-top">
                              {s.basarisizGorev}
                            </td>
                            <td className="px-2 py-1.5 text-right align-top">
                              <YuzdeHucre
                                pct={s.pct}
                                degerlendirilmis={s.degerlendirilmisGorev}
                              />
                            </td>
                            <td className="px-2 py-1.5 align-top">
                              <DegerlendirmeHucre d={s.degerlendirme} />
                            </td>
                            <td className="px-2 py-1.5 text-right align-top">
                              {s.egitimIhtiyaci > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => egitimAc(s.userId, s.courseId)}
                                  className="font-semibold px-1.5 py-0.5 rounded underline underline-offset-2"
                                  style={{
                                    background: "rgba(245,158,11,0.15)",
                                    color: "rgb(180,120,10)",
                                  }}
                                  title="Eğitim istenen görevleri göster"
                                >
                                  {s.egitimIhtiyaci}
                                </button>
                              ) : (
                                // 0 ise tıklanabilir DEĞİL — açılacak liste yok.
                                <span style={{ color: "var(--ak-text-tertiary)" }}>0</span>
                              )}
                            </td>
                            {/* Key user: yalnız bu bölümün key user'ı düzenler (sunucu
                                keyUserYetkim ile söyler); değilse salt okunur. */}
                            <td className="px-2 py-1.5 align-top">
                              {detay.keyUserYetkim ? (
                                <div className="space-y-1 min-w-[190px]">
                                  <select
                                    className="w-full px-2 py-1 text-xs rounded border bg-white"
                                    style={{ borderColor: "var(--ak-border-default)" }}
                                    value={t.seviye}
                                    onChange={(e) =>
                                      setTaslak((p) => ({
                                        ...p,
                                        [k]: { ...t, seviye: e.target.value as Seviye | "" },
                                      }))
                                    }
                                  >
                                    <option value="">— seçilmedi —</option>
                                    <option value="BASARILI">Başarılı</option>
                                    <option value="EGITIM_GEREKLI">Eğitime İhtiyacı Var</option>
                                    <option value="BASARISIZ">Başarısız</option>
                                  </select>
                                  <Textarea
                                    rows={1}
                                    className="text-xs min-h-[30px]"
                                    placeholder="Key user notu"
                                    value={t.not}
                                    onChange={(e) =>
                                      setTaslak((p) => ({
                                        ...p,
                                        [k]: { ...t, not: e.target.value },
                                      }))
                                    }
                                  />
                                  <button
                                    type="button"
                                    disabled={kaydediliyor === k}
                                    onClick={() => keyUserKaydet(detay.bolum, s)}
                                    className="text-xs px-2 py-1 rounded border disabled:opacity-50"
                                    style={{ borderColor: "var(--ak-border-default)" }}
                                  >
                                    {kaydediliyor === k ? "Kaydediliyor…" : "Kaydet"}
                                  </button>
                                  {s.keyUser.girenAd && (
                                    <div
                                      className="text-[11px]"
                                      style={{ color: "var(--ak-text-tertiary)" }}
                                    >
                                      son: {s.keyUser.girenAd}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <DegerlendirmeHucre d={s.keyUser} />
                              )}
                            </td>
                          </tr>

                          {/* Eğitim istenen görevler — satırın ALTINDA, aynı ekranda. */}
                          {egitimAcik && (
                            <tr style={{ background: "var(--ak-surface-primary)" }}>
                              <td colSpan={9} className="px-3 py-2">
                                {egitimVeri === "yukleniyor" && (
                                  <div
                                    className="text-xs"
                                    style={{ color: "var(--ak-text-secondary)" }}
                                  >
                                    Yükleniyor…
                                  </div>
                                )}
                                {egitimVeri && egitimVeri !== "yukleniyor" && (
                                  <div className="space-y-1">
                                    {egitimVeri.gorevler.length === 0 && (
                                      <div
                                        className="text-xs"
                                        style={{ color: "var(--ak-text-tertiary)" }}
                                      >
                                        Eğitim istenen görev yok.
                                      </div>
                                    )}
                                    {egitimVeri.gorevler.map((g) => (
                                      <div
                                        key={g.contentId}
                                        className="text-xs border-l-2 pl-2 py-0.5"
                                        style={{ borderColor: "rgba(245,158,11,0.6)" }}
                                      >
                                        <div className="font-medium">{g.konu}</div>
                                        <div style={{ color: "var(--ak-text-tertiary)" }}>
                                          {[g.modul, g.ifsEkran].filter(Boolean).join(" / ") || "—"}
                                        </div>
                                        {g.ornekAciklama && (
                                          <div
                                            className="whitespace-pre-wrap break-words"
                                            style={{ color: "var(--ak-text-secondary)" }}
                                          >
                                            {g.ornekAciklama}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
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
              )}
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  return (
    <div className="space-y-4">
      {loading && (
        <div className="text-sm" style={{ color: "var(--ak-text-secondary)" }}>
          Yükleniyor…
        </div>
      )}

      {!loading && ozet && (
        <div
          className="rounded-lg border overflow-hidden"
          style={{ borderColor: "var(--ak-border-default)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--ak-surface-secondary)" }}>
                  <th className="px-2 py-2 w-8" />
                  <th className={thCls}>Departman</th>
                  <th className={thNumCls}>Eğitim Alan Kişi</th>
                  <th className={thNumCls}>Başarı %</th>
                  <th className={thNumCls}>Eğitim Gerekli</th>
                </tr>
              </thead>
              <tbody>
                {dolu.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-sm"
                      style={{ color: "var(--ak-text-tertiary)" }}
                    >
                      Değerlendirme verisi olan bölüm yok.
                    </td>
                  </tr>
                )}
                {dolu.map(bolumSatiri)}

                {/* Veri yok bölümler — varsayılan gizli, tek satırla açılır. */}
                {bos.length > 0 && (
                  <tr className="border-t" style={{ borderColor: "var(--ak-border-default)" }}>
                    <td />
                    <td colSpan={4} className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setBosGoster((v) => !v)}
                        className="text-xs underline"
                        style={{ color: "var(--ak-text-secondary)" }}
                      >
                        {bosGoster
                          ? "Veri yok bölümleri gizle"
                          : `${bos.length} bölüm daha (veri yok)`}
                      </button>
                    </td>
                  </tr>
                )}
                {bosGoster && bos.map(bolumSatiri)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

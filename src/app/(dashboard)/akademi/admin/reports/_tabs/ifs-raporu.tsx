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
import { Badge } from "@/components/ui/badge";

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
  satirlar: KisiRow[];
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
            [bolum]: d ?? { bolum, scope: "own", satirlar: [] },
          }))
        )
        .catch(() =>
          setKisiler((p) => ({ ...p, [bolum]: { bolum, scope: "own", satirlar: [] } }))
        );
    },
    [acikBolum, kisiler]
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
                        return (
                          <tr
                            key={`${s.userId}|${s.courseId}`}
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
                                <span
                                  className="font-semibold px-1.5 py-0.5 rounded"
                                  style={{
                                    background: "rgba(245,158,11,0.15)",
                                    color: "rgb(180,120,10)",
                                  }}
                                >
                                  {s.egitimIhtiyaci}
                                </span>
                              ) : (
                                <span style={{ color: "var(--ak-text-tertiary)" }}>0</span>
                              )}
                            </td>
                            {/* Key user: bu turda SALT OKUNUR — veri yok, "—". Yazma sonraki turda. */}
                            <td className="px-2 py-1.5 align-top">
                              <DegerlendirmeHucre d={s.keyUser} />
                            </td>
                          </tr>
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

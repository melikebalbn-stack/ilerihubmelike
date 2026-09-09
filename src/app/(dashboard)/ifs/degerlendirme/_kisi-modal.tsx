"use client";

// IFS EĞİTİMLER — kişi detayı MODALI.
//
// Eskiden kişi satırının ALTINDA açılan panel vardı; tablo içinde tablo
// büyüyordu ve uzun görev dökümünde satır kayboluyordu. Detay artık ortada
// açılan bir modalda: liste arkada yerinde kalır, seçili satır işaretli durur.
//
// Tipler ve iki küçük gösterim yardımcısı da burada — hem sayfa hem modal
// kullanıyor, tek yerde dursun.

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Check, Download, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export type Seviye = "BASARILI" | "EGITIM_GEREKLI" | "BASARISIZ";

export const SEVIYE_LABEL: Record<Seviye, string> = {
  BASARILI: "Başarılı",
  EGITIM_GEREKLI: "Eğitim gerekli",
  BASARISIZ: "Başarısız",
};
// Üç seviye + boş. Uzatma yok.
export const SEVIYE_STIL: Record<Seviye, React.CSSProperties> = {
  BASARILI: { background: "rgba(16,185,129,0.15)", color: "rgb(6,120,90)" },
  EGITIM_GEREKLI: { background: "rgba(245,158,11,0.15)", color: "rgb(180,120,10)" },
  BASARISIZ: { background: "rgba(239,68,68,0.15)", color: "rgb(180,40,40)" },
};
export const AMBER = "rgb(180,120,10)";

export interface Kanaat {
  seviye: Seviye | null;
  not: string | null;
  girenAd: string | null;
  girenAt: string | null;
}
export interface KursSatir {
  courseId: string;
  egitimAdi: string;
  toplamGorev: number;
  tamamlananGorev: number;
  ilerlemePct: number;
  egitimIstenenSayisi: number;
  egitmen: Kanaat;
  keyUser: Kanaat;
  ayrisiyor: boolean;
}
export interface KisiSatir {
  userId: string;
  ad: string;
  bolum: string | null;
  atamaVar: boolean;
  toplamGorev: number;
  tamamlananGorev: number;
  ilerlemePct: number;
  egitimIstenenSayisi: number;
  degerlendirilenKursSayisi: number;
  kursSayisi: number;
  egitmen: Kanaat;
  keyUser: Kanaat;
  ayrisiyor: boolean;
  keyUserYetkim: boolean;
  kurslar: KursSatir[];
}
export interface Gorev {
  contentId: string;
  courseId: string;
  egitimAdi: string;
  konu: string;
  modul: string | null;
  ifsEkran: string | null;
  kursiyerDurum: string;
  ornekStatus: string;
  ornekAciklama: string | null;
  degerlendirildiAt: string | null;
  degerlendirenAd: string | null;
}
export interface GorevlerVeri {
  ad: string;
  gorevler: Gorev[];
}

export const fmtTarih = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("tr-TR") : null;

/** Seviye rozeti + altında giren adı/tarihi. */
export function KanaatHucre({
  k,
  bosMetin = "—",
  onDegerlendir,
}: {
  k: Kanaat;
  bosMetin?: string;
  onDegerlendir?: () => void;
}) {
  if (!k.seviye && !k.girenAd) {
    if (onDegerlendir) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDegerlendir();
          }}
          className="text-xs underline underline-offset-2"
          style={{ color: "#1B4F72" }}
        >
          Değerlendir
        </button>
      );
    }
    return (
      <span className="text-xs" style={{ color: "var(--ak-text-tertiary)" }}>
        {bosMetin}
      </span>
    );
  }
  return (
    <div className="space-y-0.5">
      {k.seviye && (
        <span
          className="inline-block text-[11px] px-1.5 py-0.5 rounded"
          style={SEVIYE_STIL[k.seviye]}
          title={k.not ?? undefined}
        >
          {SEVIYE_LABEL[k.seviye]}
        </span>
      )}
      {(k.girenAd || k.girenAt) && (
        <div className="text-[11px]" style={{ color: "var(--ak-text-tertiary)" }}>
          {[k.girenAd, fmtTarih(k.girenAt)].filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
}

export function IlerlemeCubuk({ pct }: { pct: number }) {
  return (
    <div className="space-y-1 min-w-[110px]">
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
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════ MODAL

interface Props {
  satir: KisiSatir;
  paketAdi: string;
  gorevler: GorevlerVeri | "yukleniyor" | undefined;
  oncekiVar: boolean;
  sonrakiVar: boolean;
  onOnceki: () => void;
  onSonraki: () => void;
  onKapat: () => void;
  /** courseId + taslak ile PATCH. Başarılıysa sayfa listeyi tazeler. */
  onKaydet: (courseId: string, seviye: Seviye | "", not: string) => Promise<void>;
  kaydediliyorCourseId: string | null;
  /** Bu kişinin görev dökümünü dışarı aktarır (sayfadaki egitimIndir). */
  onIndir: (format: "xlsx" | "pdf") => void;
}

export function KisiDetayModal({
  satir,
  paketAdi,
  gorevler,
  oncekiVar,
  sonrakiVar,
  onOnceki,
  onSonraki,
  onKapat,
  onKaydet,
  kaydediliyorCourseId,
  onIndir,
}: Props) {
  // Değerlendirme şeridi: hangi alan (kurs) düzenleniyor + taslak.
  const [seciliCourseId, setSeciliCourseId] = useState<string>("");
  const [seviye, setSeviye] = useState<Seviye | "">("");
  const [not, setNot] = useState("");
  const govdeRef = useRef<HTMLDivElement | null>(null);

  // Kişi değişince şerit o kişinin ilk alanına ve MEVCUT kanaatine döner;
  // önceki kişinin taslağı taşınmaz.
  useEffect(() => {
    const ilk = satir.kurslar[0];
    setSeciliCourseId(ilk?.courseId ?? "");
    setSeviye((ilk?.keyUser.seviye ?? "") as Seviye | "");
    setNot(ilk?.keyUser.not ?? "");
    govdeRef.current?.scrollTo({ top: 0 });
  }, [satir.userId, satir.kurslar]);

  // Alan değişince o alanın kayıtlı kanaati yüklenir.
  const alanSec = useCallback(
    (courseId: string) => {
      const c = satir.kurslar.find((k) => k.courseId === courseId);
      setSeciliCourseId(courseId);
      setSeviye((c?.keyUser.seviye ?? "") as Seviye | "");
      setNot(c?.keyUser.not ?? "");
    },
    [satir.kurslar]
  );

  // Esc kapatır; ok tuşları kişi değiştirir. Ok tuşları bir metin/seçim
  // alanındayken YOK SAYILIR — orada oklar alanın kendi işi. Esc her yerde.
  useEffect(() => {
    const el = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onKapat();
        return;
      }
      const hedef = e.target as HTMLElement | null;
      const yaziAlani =
        !!hedef &&
        (hedef.tagName === "INPUT" ||
          hedef.tagName === "TEXTAREA" ||
          hedef.tagName === "SELECT" ||
          hedef.isContentEditable);
      if (yaziAlani) return;
      if (e.key === "ArrowUp" && oncekiVar) {
        e.preventDefault();
        onOnceki();
      } else if (e.key === "ArrowDown" && sonrakiVar) {
        e.preventDefault();
        onSonraki();
      }
    };
    window.addEventListener("keydown", el);
    return () => window.removeEventListener("keydown", el);
  }, [onKapat, onOnceki, onSonraki, oncekiVar, sonrakiVar]);

  // Modal açıkken arka plan kaymasın.
  useEffect(() => {
    const eski = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = eski;
    };
  }, []);

  const liste = gorevler && gorevler !== "yukleniyor" ? gorevler.gorevler : [];
  const egitimIstenen = liste.filter((g) => g.kursiyerDurum === "EGITIM_GEREKLI");
  const tamamlanan = liste.filter((g) => g.kursiyerDurum === "ORNEK_YAPILDI");
  // BEKLIYOR / FARKLI_DEPARTMAN — iki başlığın dışında kalanlar sessizce
  // düşmesin diye ayrı blokta, yalnız doluysa.
  const diger = liste.filter(
    (g) =>
      g.kursiyerDurum !== "EGITIM_GEREKLI" && g.kursiyerDurum !== "ORNEK_YAPILDI"
  );

  const seciliKurs = satir.kurslar.find((k) => k.courseId === seciliCourseId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.55)" }}
      // Arka plana tıklama kapatır; içeriye tıklama kapatmaz.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onKapat();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`${satir.ad} — görev detayı`}
    >
      <div
        className="w-full max-w-[640px] max-h-[calc(100vh-2rem)] rounded-lg shadow-xl flex flex-col overflow-hidden"
        style={{ background: "var(--ak-surface-primary, #fff)" }}
      >
        {/* ── Başlık ── */}
        <div
          className="px-5 py-3.5 flex items-start justify-between gap-3 border-b shrink-0"
          style={{ borderColor: "var(--ak-border-default)" }}
        >
          <div className="min-w-0">
            <div className="text-base font-semibold truncate">{satir.ad}</div>
            <div className="text-xs truncate" style={{ color: "var(--ak-text-secondary)" }}>
              {[satir.bolum ?? "—", paketAdi].filter(Boolean).join(" · ")}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Kişi export'u — sayfadaki listeyle aynı uç, kapsam=kisi. */}
            {(["xlsx", "pdf"] as const).map((f) => (
              <button
                key={f}
                type="button"
                title={`Dışa aktar — ${f.toUpperCase()}`}
                onClick={() => onIndir(f)}
                className="inline-flex items-center gap-1 px-1.5 py-1 text-[11px] rounded border"
                style={{
                  borderColor: "var(--ak-border-default)",
                  color: "var(--ak-text-secondary)",
                }}
              >
                <Download size={11} />
                {f.toUpperCase()}
              </button>
            ))}
            <button
              type="button"
              title="Önceki kişi (↑)"
              disabled={!oncekiVar}
              onClick={onOnceki}
              className="p-1.5 rounded disabled:opacity-30"
              style={{ color: "var(--ak-text-secondary)" }}
            >
              <ChevronUp size={16} />
            </button>
            <button
              type="button"
              title="Sonraki kişi (↓)"
              disabled={!sonrakiVar}
              onClick={onSonraki}
              className="p-1.5 rounded disabled:opacity-30"
              style={{ color: "var(--ak-text-secondary)" }}
            >
              <ChevronDown size={16} />
            </button>
            <button
              type="button"
              title="Kapat (Esc)"
              onClick={onKapat}
              className="p-1.5 rounded"
              style={{ color: "var(--ak-text-secondary)" }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── İlerleme + iki kanaat sütunu ── */}
        <div
          className="px-5 py-3 space-y-3 border-b shrink-0"
          style={{ borderColor: "var(--ak-border-default)" }}
        >
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <IlerlemeCubuk pct={satir.ilerlemePct} />
            </div>
            <div className="text-xs pb-1" style={{ color: "var(--ak-text-secondary)" }}>
              {satir.tamamlananGorev}/{satir.toplamGorev} görev · %{satir.ilerlemePct}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div
                className="text-[11px] uppercase tracking-wide mb-1"
                style={{ color: "var(--ak-text-tertiary)" }}
              >
                Eğitmen
              </div>
              <KanaatHucre k={satir.egitmen} bosMetin="Değerlendirilmedi" />
            </div>
            <div>
              <div
                className="text-[11px] uppercase tracking-wide mb-1"
                style={{ color: "var(--ak-text-tertiary)" }}
              >
                Key user
              </div>
              <KanaatHucre k={satir.keyUser} bosMetin="Değerlendirilmedi" />
            </div>
          </div>
          {satir.ayrisiyor && (
            <div className="text-xs" style={{ color: AMBER }}>
              Değerlendirmeler ayrışıyor
            </div>
          )}
        </div>

        {/* ── Kaydıran gövde ── */}
        <div ref={govdeRef} className="px-5 py-3 overflow-y-auto flex-1 space-y-4">
          {gorevler === "yukleniyor" && (
            <div className="text-sm" style={{ color: "var(--ak-text-secondary)" }}>
              Yükleniyor…
            </div>
          )}
          {gorevler && gorevler !== "yukleniyor" && liste.length === 0 && (
            <div className="text-sm" style={{ color: "var(--ak-text-tertiary)" }}>
              Kayıtlı görev yok.
            </div>
          )}

          {egitimIstenen.length > 0 && (
            <div className="space-y-1.5">
              <div
                className="text-[11px] uppercase tracking-wide font-medium"
                style={{ color: AMBER }}
              >
                Eğitim istenen · {egitimIstenen.length}
              </div>
              {egitimIstenen.map((g) => (
                <div
                  key={g.contentId}
                  className="pl-2.5 py-1"
                  style={{ borderLeft: `2px solid ${AMBER}` }}
                >
                  <div className="text-sm font-medium">{g.konu}</div>
                  <div className="text-xs" style={{ color: "var(--ak-text-tertiary)" }}>
                    {[g.egitimAdi, g.modul, g.ifsEkran].filter(Boolean).join(" / ")}
                  </div>
                  {g.ornekAciklama && (
                    <div
                      className="text-xs whitespace-pre-wrap break-words mt-0.5"
                      style={{ color: "var(--ak-text-secondary)" }}
                    >
                      {g.ornekAciklama}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tamamlanan.length > 0 && (
            <div className="space-y-0.5">
              <div
                className="text-[11px] uppercase tracking-wide font-medium"
                style={{ color: "var(--ak-text-tertiary)" }}
              >
                Tamamlanan · {tamamlanan.length}
              </div>
              {tamamlanan.map((g) => (
                <div
                  key={g.contentId}
                  className="flex items-center gap-2 py-0.5 text-sm"
                >
                  <span className="truncate flex-1">{g.konu}</span>
                  <Check size={14} className="shrink-0" style={{ color: "rgb(6,120,90)" }} />
                </div>
              ))}
            </div>
          )}

          {diger.length > 0 && (
            <div className="space-y-0.5">
              <div
                className="text-[11px] uppercase tracking-wide font-medium"
                style={{ color: "var(--ak-text-tertiary)" }}
              >
                Diğer · {diger.length}
              </div>
              {diger.map((g) => (
                <div key={g.contentId} className="flex items-center gap-2 py-0.5 text-sm">
                  <span className="truncate flex-1">{g.konu}</span>
                  <span className="text-xs shrink-0" style={{ color: "var(--ak-text-tertiary)" }}>
                    {g.kursiyerDurum === "FARKLI_DEPARTMAN" ? "Farklı departman" : "Bekliyor"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Alt sabit şerit — YALNIZ key user yetkisi olana render edilir ── */}
        {satir.keyUserYetkim && seciliKurs && (
          <div
            className="px-5 py-3 border-t shrink-0 space-y-2"
            style={{
              borderColor: "var(--ak-border-default)",
              background: "var(--ak-surface-secondary)",
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              {/* Kişinin birden çok alanı varsa hangisine kanaat yazıldığı
                  seçilebilir olmalı; tek alanda seçici yerine adı yazılır. */}
              {satir.kurslar.length > 1 ? (
                <select
                  className="px-2 py-1 text-xs rounded border bg-white max-w-[200px]"
                  style={{ borderColor: "var(--ak-border-default)" }}
                  value={seciliCourseId}
                  onChange={(e) => alanSec(e.target.value)}
                >
                  {satir.kurslar.map((c) => (
                    <option key={c.courseId} value={c.courseId}>
                      {c.egitimAdi}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs font-medium">{seciliKurs.egitimAdi}</span>
              )}
              <select
                className="px-2 py-1 text-xs rounded border bg-white"
                style={{ borderColor: "var(--ak-border-default)" }}
                value={seviye}
                onChange={(e) => setSeviye(e.target.value as Seviye | "")}
              >
                <option value="">— seçilmedi —</option>
                <option value="BASARILI">Başarılı</option>
                <option value="EGITIM_GEREKLI">Eğitim gerekli</option>
                <option value="BASARISIZ">Başarısız</option>
              </select>
              <Textarea
                rows={1}
                className="text-xs min-h-[30px] flex-1 min-w-[180px] bg-white"
                placeholder="Not"
                value={not}
                onChange={(e) => setNot(e.target.value)}
              />
              <button
                type="button"
                disabled={kaydediliyorCourseId === seciliCourseId}
                onClick={() => onKaydet(seciliCourseId, seviye, not)}
                className="px-3 py-1 text-xs rounded text-white disabled:opacity-50"
                style={{ background: "#1B4F72" }}
              >
                {kaydediliyorCourseId === seciliCourseId ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

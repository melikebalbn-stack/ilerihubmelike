"use client";

// İK başvuru detayında KVKK onayı + Sağlık beyanı bölümleri (Faz 3).
// Yalnız yetkili rolde (VIEW_ROLES) render edilir. Sağlık default KAPALI; "Görüntüle"
// her açılışta GET → accessLog. TC maskeli; "Göster" ile unmask (ayrı log).

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { canViewJobAppSensitive } from "@/lib/job-application/hr-access";
import { F13_37, F13_56 } from "@/content/f13-37-56";

const NAVY = "#1B4F72";
const fmtDate = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" }) : "—";
const evetHayir = (v: boolean | null) => (v === true ? "EVET" : v === false ? "HAYIR" : "—");
const varYok = (v: boolean) => (v ? "VAR" : "YOK");

interface ConsentData {
  adSoyad: string;
  tcKimlikNo: string | null;
  documentCode: string;
  documentRev: string;
  consentTextHash: string | null;
  signedAt: string | null;
  signatureImage: string | null;
  ipAddress: string | null;
}
interface HealthResp {
  health: {
    ameliyatOlduMu: boolean | null;
    ameliyatNotu: string | null;
    gecmisHastalikNotu: string | null;
    dogumTarihi: string | null;
    testTarihi: string | null;
    cinsiyet: string | null;
    telefonGunduz: string | null;
    telefonGece: string | null;
    items: { itemNo: number; itemLabel: string; deger: boolean }[];
    [k: string]: unknown;
  } | null;
  summary?: {
    varItems: { itemNo: number; itemLabel: string }[];
    astimEvetler: { no: string; metin: string }[];
    ameliyat: { oldu: boolean; not: string | null };
    bosMu: boolean;
  };
}

export function JobApplicationSensitiveSections({ applicationId }: { applicationId: string }) {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const canView = canViewJobAppSensitive(role);

  const [consent, setConsent] = useState<ConsentData | null>(null);
  const [consentLoaded, setConsentLoaded] = useState(false);
  const [unmasked, setUnmasked] = useState(false);
  const [sigBig, setSigBig] = useState(false);

  const [health, setHealth] = useState<HealthResp | null>(null);
  const [healthOpen, setHealthOpen] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);

  // KVKK: yetkiliyse mount'ta yükle (accessLog VIEW_CONSENT).
  useEffect(() => {
    if (!canView) return;
    fetch(`/api/job-application/${applicationId}/consent`)
      .then((r) => (r.ok ? r.json() : { consent: null }))
      .then((d) => setConsent(d.consent))
      .catch(() => setConsent(null))
      .finally(() => setConsentLoaded(true));
  }, [canView, applicationId]);

  async function unmaskTc() {
    const r = await fetch(`/api/job-application/${applicationId}/consent?unmask=true`);
    if (r.ok) {
      const d = await r.json();
      if (d.consent) {
        setConsent(d.consent);
        setUnmasked(true);
      }
    }
  }

  async function openHealth() {
    if (health) {
      setHealthOpen((o) => !o);
      return;
    }
    setHealthLoading(true);
    try {
      const r = await fetch(`/api/job-application/${applicationId}/health`);
      const d = await r.json();
      setHealth(d);
      setHealthOpen(true);
    } finally {
      setHealthLoading(false);
    }
  }

  if (!canView) return null;

  return (
    <div className="space-y-6 print:hidden">
      {/* ── KVKK Onayı ── */}
      <Card>
        <CardHeader>
          <CardTitle style={{ color: NAVY }}>KVKK Onayı</CardTitle>
        </CardHeader>
        <CardContent>
          {!consentLoaded ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : !consent ? (
            <p className="text-sm text-gray-500 italic">
              Bu başvuru KVKK/sağlık akışı öncesine ait — dijital onay kaydı yok.
            </p>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div><span className="text-gray-500">Onay durumu:</span> <b className="text-green-700">Onaylandı</b></div>
                <div><span className="text-gray-500">Tarih:</span> {fmtDate(consent.signedAt)}</div>
                <div><span className="text-gray-500">Doküman:</span> {consent.documentCode} Rev.{consent.documentRev}</div>
                <div>
                  <span className="text-gray-500">Ad Soyad:</span> {consent.adSoyad}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">T.C. No:</span>
                  <span className="font-mono">{consent.tcKimlikNo}</span>
                  {!unmasked && (
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={unmaskTc}>
                      Göster
                    </Button>
                  )}
                </div>
                <div className="text-xs text-gray-400 truncate" title={consent.consentTextHash ?? ""}>
                  Metin hash: {consent.consentTextHash?.slice(0, 16)}…
                </div>
              </div>
              {consent.signatureImage && (
                <div>
                  <p className="text-gray-500 mb-1">İmza:</p>
                  <img
                    src={consent.signatureImage}
                    alt="İmza"
                    onClick={() => setSigBig((b) => !b)}
                    className={`cursor-zoom-in rounded border bg-white ${sigBig ? "max-w-md" : "max-w-[180px]"}`}
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Sağlık Beyanı (default kapalı) ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle style={{ color: NAVY }}>Sağlık Beyanı</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openHealth}
            disabled={healthLoading}
          >
            {healthLoading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Yükleniyor…</>
            ) : healthOpen ? (
              "Gizle"
            ) : (
              "Görüntüle"
            )}
          </Button>
        </CardHeader>
        {healthOpen && (
          <CardContent>
            {!health?.health ? (
              <p className="text-sm text-gray-500 italic">
                Bu başvuru KVKK/sağlık akışı öncesine ait — sağlık beyanı yok.
              </p>
            ) : (
              <div className="space-y-5 text-sm">
                {/* Özet kartı */}
                <div className="rounded-md border p-3 bg-gray-50">
                  <p className="font-semibold mb-2" style={{ color: NAVY }}>Özet</p>
                  {health.summary?.bosMu ? (
                    <p className="text-green-700">Beyan edilen hastalık bulunmuyor.</p>
                  ) : (
                    <div className="space-y-2">
                      {health.summary && health.summary.varItems.length > 0 && (
                        <div>
                          <span className="text-gray-500">VAR işaretli:</span>{" "}
                          {health.summary.varItems.map((v) => `${v.itemNo}. ${v.itemLabel}`).join("; ")}
                        </div>
                      )}
                      {health.summary && health.summary.astimEvetler.length > 0 && (
                        <div>
                          <span className="text-gray-500">Astım EVET:</span>{" "}
                          {health.summary.astimEvetler.map((a) => a.no).join(", ")}
                        </div>
                      )}
                      {health.summary?.ameliyat.oldu && (
                        <div>
                          <span className="text-gray-500">Ameliyat:</span> {health.summary.ameliyat.not || "—"}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Tam liste: 26 madde */}
                <div>
                  <p className="font-semibold mb-2">{F13_37.baslik}</p>
                  <div className="divide-y rounded border">
                    {health.health.items.map((it) => (
                      <div key={it.itemNo} className="flex justify-between gap-3 p-2">
                        <span className="text-gray-700"><b className="text-gray-400 mr-1">{it.itemNo}.</b>{it.itemLabel}</span>
                        <span className={`font-semibold shrink-0 ${it.deger ? "text-red-600" : "text-gray-400"}`}>
                          {it.itemNo === F13_37.AMELIYAT_ITEM_NO ? evetHayir(it.deger) : varYok(it.deger)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {health.health.ameliyatNotu && (
                    <p className="mt-2"><span className="text-gray-500">Ameliyat notu:</span> {health.health.ameliyatNotu}</p>
                  )}
                  {health.health.gecmisHastalikNotu && (
                    <p className="mt-1"><span className="text-gray-500">Geçmiş hastalık notu:</span> {health.health.gecmisHastalikNotu}</p>
                  )}
                </div>

                {/* Astım */}
                <div>
                  <p className="font-semibold mb-2">{F13_56.baslik}</p>
                  <div className="divide-y rounded border">
                    {F13_56.sorular.map((s) => {
                      const v = (health.health as Record<string, unknown>)[s.key] as boolean | null;
                      if ("parent" in s && (health.health as Record<string, unknown>)["astimSoru1"] !== true) return null;
                      return (
                        <div key={s.key} className="flex justify-between gap-3 p-2">
                          <span className="text-gray-700"><b className="text-gray-400 mr-1">{s.no}.</b>{s.metin}</span>
                          <span className="font-semibold shrink-0">{evetHayir(v)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                    <div><span className="text-gray-500">Doğum tarihi:</span> {fmtDate(health.health.dogumTarihi)}</div>
                    <div><span className="text-gray-500">Test tarihi:</span> {fmtDate(health.health.testTarihi)}</div>
                    <div><span className="text-gray-500">Cinsiyet:</span> {health.health.cinsiyet || "—"}</div>
                    <div><span className="text-gray-500">Telefon (gündüz):</span> {health.health.telefonGunduz || "—"}</div>
                    <div><span className="text-gray-500">Telefon (gece):</span> {health.health.telefonGece || "—"}</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

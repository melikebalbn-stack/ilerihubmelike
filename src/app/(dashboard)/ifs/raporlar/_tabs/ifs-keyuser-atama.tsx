"use client";

// KEY USER ATAMA — akademi.admin'e özel sekme.
// Bölüm seç + kişi ara + ekle; mevcut atamalar listesi ve kaldırma.
// Bir bölüme BİRDEN FAZLA kişi atanabilir (@@unique([bolum, userId]) yalnız
// aynı kişinin aynı bölüme iki kez eklenmesini engeller).
//
// Uçlar: reports/ifs-keyuser (GET / POST / DELETE)
//        bölüm listesi: reports/ifs-departman-ozet (aynı kaynak, ek uç yok)

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

interface Atama {
  id: string;
  bolum: string;
  userId: string;
  ad: string;
  atayanAd: string | null;
  olusturmaTarihi: string;
}
interface OzetBolum {
  bolum: string;
}
interface AkademiKullanici {
  id: string;
  name?: string | null;
  email?: string | null;
}

export function IfsKeyUserAtamaTab() {
  const [atamalar, setAtamalar] = useState<Atama[]>([]);
  const [bolums, setBolums] = useState<string[]>([]);
  const [kullanicilar, setKullanicilar] = useState<AkademiKullanici[]>([]);
  const [bolum, setBolum] = useState("");
  const [arama, setArama] = useState("");
  const [seciliUser, setSeciliUser] = useState("");
  const [loading, setLoading] = useState(true);
  const [islemde, setIslemde] = useState(false);

  const yukle = useCallback(() => {
    setLoading(true);
    fetch("/api/akademi/admin/reports/ifs-keyuser")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { atamalar: Atama[] } | null) => setAtamalar(d?.atamalar ?? []))
      .catch(() => setAtamalar([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    yukle();
    fetch("/api/akademi/admin/reports/ifs-departman-ozet")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { bolums: OzetBolum[] } | null) => {
        const list = (d?.bolums ?? []).map((b) => b.bolum);
        setBolums(list);
        if (list.length) setBolum(list[0]);
      })
      .catch(() => setBolums([]));
    fetch("/api/akademi/admin/users")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setKullanicilar(d?.users ?? d ?? []))
      .catch(() => setKullanicilar([]));
  }, [yukle]);

  // Arama en az 2 karakterden sonra süzer — 1400 kullanıcılık listeyi
  // olduğu gibi <select>'e basmak ekranı kilitliyor.
  const adayListe = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr-TR");
    if (q.length < 2) return [];
    return kullanicilar
      .filter((u) =>
        `${u.name ?? ""} ${u.email ?? ""}`.toLocaleLowerCase("tr-TR").includes(q)
      )
      .slice(0, 30);
  }, [arama, kullanicilar]);

  const ekle = async () => {
    if (!bolum || !seciliUser) return;
    setIslemde(true);
    try {
      const res = await fetch("/api/akademi/admin/reports/ifs-keyuser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bolum, userId: seciliUser }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || "Eklenemedi");
        return;
      }
      toast.success("Key user atandı");
      setSeciliUser("");
      setArama("");
      yukle();
    } finally {
      setIslemde(false);
    }
  };

  const kaldir = async (a: Atama) => {
    setIslemde(true);
    try {
      const res = await fetch(
        `/api/akademi/admin/reports/ifs-keyuser?id=${encodeURIComponent(a.id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || "Kaldırılamadı");
        return;
      }
      toast.success(`${a.ad} — ${a.bolum} ataması kaldırıldı`);
      yukle();
    } finally {
      setIslemde(false);
    }
  };

  const selectCls = "px-3 py-2 text-sm rounded-md border bg-white min-w-[220px]";

  return (
    <div className="space-y-4">
      {/* ── Atama formu ── */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium block" style={{ color: "var(--ak-text-secondary)" }}>
            Bölüm
          </label>
          <select
            className={selectCls}
            style={{ borderColor: "var(--ak-border-default)" }}
            value={bolum}
            onChange={(e) => setBolum(e.target.value)}
          >
            {bolums.length === 0 && <option value="">bölüm yok</option>}
            {bolums.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium block" style={{ color: "var(--ak-text-secondary)" }}>
            Kişi ara (en az 2 harf)
          </label>
          <input
            className={selectCls}
            style={{ borderColor: "var(--ak-border-default)" }}
            value={arama}
            onChange={(e) => {
              setArama(e.target.value);
              setSeciliUser("");
            }}
            placeholder="ad veya e-posta"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium block" style={{ color: "var(--ak-text-secondary)" }}>
            Kişi
          </label>
          <select
            className={selectCls}
            style={{ borderColor: "var(--ak-border-default)" }}
            value={seciliUser}
            onChange={(e) => setSeciliUser(e.target.value)}
            disabled={adayListe.length === 0}
          >
            <option value="">
              {arama.trim().length < 2 ? "— önce arayın —" : `${adayListe.length} sonuç`}
            </option>
            {adayListe.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ?? u.email ?? u.id}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={ekle}
          disabled={!bolum || !seciliUser || islemde}
          className="px-4 py-2 text-sm rounded-md font-medium text-white disabled:opacity-50"
          style={{ background: "#1B4F72" }}
        >
          Ekle
        </button>
      </div>

      {/* ── Mevcut atamalar ── */}
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
                  <th className="px-3 py-2 text-left font-medium">Bölüm</th>
                  <th className="px-3 py-2 text-left font-medium">Key User</th>
                  <th className="px-3 py-2 text-left font-medium">Atayan</th>
                  <th className="px-3 py-2 text-left font-medium">Tarih</th>
                  <th className="px-3 py-2 w-16" />
                </tr>
              </thead>
              <tbody>
                {atamalar.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-sm"
                      style={{ color: "var(--ak-text-tertiary)" }}
                    >
                      Henüz key user ataması yok.
                    </td>
                  </tr>
                )}
                {atamalar.map((a) => (
                  <tr
                    key={a.id}
                    className="border-t"
                    style={{ borderColor: "var(--ak-border-default)" }}
                  >
                    <td className="px-3 py-2">{a.bolum}</td>
                    <td className="px-3 py-2 font-medium">{a.ad}</td>
                    <td className="px-3 py-2" style={{ color: "var(--ak-text-secondary)" }}>
                      {a.atayanAd ?? "—"}
                    </td>
                    <td className="px-3 py-2" style={{ color: "var(--ak-text-secondary)" }}>
                      {new Date(a.olusturmaTarihi).toLocaleDateString("tr-TR")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => kaldir(a)}
                        disabled={islemde}
                        title="Atamayı kaldır"
                        className="p-1 rounded disabled:opacity-50"
                        style={{ color: "rgb(180,40,40)" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

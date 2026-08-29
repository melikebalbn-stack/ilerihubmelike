"use client";
import { useEffect, useState } from "react";

/**
 * Aktif bölümleri DepartmentDefinition tablosundan çeker.
 * Türkçe-aware alfabetik sıralı.
 */
export function useDepartments() {
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  // Liste çekilemedi/boş döndü → çağıran SESSİZ boş dropdown çizmesin, mesaj göstersin.
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/hr-departments")
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? "yetki" : "sunucu");
        return r.json();
      })
      .then((d: Array<{ name: string; isActive: boolean }>) => {
        if (cancelled) return;
        const active = d.filter((x) => x.isActive).map((x) => x.name);
        active.sort((a, b) => a.localeCompare(b, "tr"));
        setDepartments(active);
        setHata(active.length === 0 ? "Tanımlı bölüm bulunamadı (Ayarlar → İV Tanımları)." : null);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setDepartments([]);
        setHata(
          e.message === "yetki"
            ? "Bölüm listesi için yetkiniz yok."
            : "Bölüm listesi yüklenemedi.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { departments, loading, hata };
}

/**
 * Personel'in mevcut bölümü whitelist'te varsa onu, yoksa ilk
 * bölümü, o da yoksa boş string döndürür.
 */
export function resolveDefaultDepartment(
  personBolum: string | null | undefined,
  departments: string[]
): string {
  if (personBolum && departments.includes(personBolum)) return personBolum;
  return departments[0] ?? "";
}

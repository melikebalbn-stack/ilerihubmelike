"use client";
import { useEffect, useState } from "react";

/**
 * Aktif bölümleri DepartmentDefinition tablosundan çeker.
 * Türkçe-aware alfabetik sıralı.
 */
export function useDepartments() {
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/hr-departments")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Array<{ name: string; isActive: boolean }>) => {
        if (cancelled) return;
        const active = d.filter((x) => x.isActive).map((x) => x.name);
        active.sort((a, b) => a.localeCompare(b, "tr"));
        setDepartments(active);
      })
      .catch(() => {
        if (!cancelled) setDepartments([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { departments, loading };
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

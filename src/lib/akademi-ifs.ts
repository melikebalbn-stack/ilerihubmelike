// IFS-6: Kullanıcı tarafı "IFS Eğitimleri" display yardımcıları.
// NOT: Bu fonksiyon route dosyalarından PAYLAŞILDIĞI için lib'de — Next.js route
// dosyaları handler dışı export kabul etmez (build-time "Route does not match"
// hatası). Ad temizleme yalnız DISPLAY'de; veriye/import'a dokunmaz.

/** Paket adından "IFS Geçiş · " prefix'ini kırp (departman görünen adı). */
export function stripDeptPrefix(name: string): string {
  return name.replace(/^IFS\s*Geçiş\s*·\s*/u, "").trim() || name;
}

/** Kurs adından "<Departman> · " prefix'ini kırp (alan görünen adı). */
export function stripAreaPrefix(title: string, dept: string): string {
  const prefix = `${dept} · `;
  return title.startsWith(prefix) ? title.slice(prefix.length) : title;
}

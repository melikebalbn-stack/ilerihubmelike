# Proje Takip — ek alan önerisi: Proje Sorumlusu (Melih Bey onayına)

`ProjeTakip` modeline tek bir yeni alan öneriliyor — Syteline'daki
"Proje Sorumlusu" (satış tarafı, serbest metin) karşılığı. Mevcut
hiçbir alana dokunulmuyor, `muhendislikSorumluId` (Sorumlu Mühendis)
ile karıştırılmasın — o ayrı, bu ayrı.

```prisma
model ProjeTakip {
  // ... mevcut alanlar (bkz. SCHEMA-DIFF-MELIH.md) ...

  projeSorumlusu String? // Syteline "Proje Sorumlusu" alanı, satış tarafı, serbest metin
}
```

Henüz schema.prisma'ya eklenmedi, henüz migrate edilmedi — Melih Bey'in
onayı bekleniyor.

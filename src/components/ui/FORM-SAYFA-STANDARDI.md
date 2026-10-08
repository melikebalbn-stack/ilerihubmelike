# Form/liste sayfası standardı

Referans: [`src/app/(dashboard)/forms/bolum-degisiklik/page.tsx`](../../app/(dashboard)/forms/bolum-degisiklik/page.tsx)
(Bölüm Değişikliği Talebi). Yeni bir form/liste sayfası yazarken bu iskelet
kopyalanır; aşağıdaki sınıf adları **referanstan birebir** alınmıştır.

## İskelet

1. **Sayfa kabuğu** — `<div className="space-y-6">`. Kendi `container`/`max-w`
   verilmez; dashboard layout'u zaten sarıyor.
2. **Başlık bloğu** — başlık solda, aksiyon sağda, tek satırda:
   `<div className="flex flex-wrap items-start justify-between gap-3">`
   - `h1`: `flex items-center gap-2 text-xl font-semibold` + **lucide-react**
     ikonu `h-5 w-5` (ikon seti lucide-react, başka set yok).
   - Açıklama: `p` · `mt-1 text-sm text-muted-foreground` — **TEK satır**, ne
     yapıldığını ve gerekiyorsa **kullanıcının rolünü** söyler
     (`· Rolünüz: ${ACAN_ROL_ETIKET[rol]}`).
3. **Sağ üst aksiyon** — `SplitBadge` (`@/components/akademi/SplitBadge`),
   `color` + `left` + `right` + `onClick`/`href`. Birincil işlem `green`,
   vazgeç/ikincil `gray`, yıkıcı `red`, gezinme `blue`.
4. **İçerik kartı** — TEK kart, başlığı `X (sayı)` biçiminde:
   ```tsx
   <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
     <div className="border-b bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
       Taleplerim ({satirlar.length})
     </div>
     <div className="overflow-x-auto"> …tablo… </div>
   </div>
   ```
   Form (giriş alanları) açılıyorsa ayrı bir kutuda ve tablonun ÜSTÜNDE:
   `<div className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">`.
5. **Tablo**
   ```tsx
   <table className="w-full text-xs">
     <thead className="bg-slate-50 text-left font-semibold uppercase tracking-wide text-slate-500">
       <tr className="[&>th]:whitespace-nowrap [&>th]:px-3 [&>th]:py-2.5">
         <th>Kolon</th>…<th className="text-right">İşlem</th>
       </tr>
     </thead>
     <tbody className="divide-y">
       {/* yükleniyor */}
       <tr><td colSpan={N} className="p-8 text-center text-muted-foreground">
         <Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
       {/* boş */}
       <tr><td colSpan={N} className="p-8 text-center text-muted-foreground">…</td></tr>
       {/* satır */}
       <tr className="[&>td]:px-3 [&>td]:py-2.5 hover:bg-slate-50">…</tr>
     </tbody>
   </table>
   ```
   İki satırlı hücre: üstte `font-medium`, altta `text-xs text-muted-foreground`
   (ad + sicil deseni). Sayı/tarih hücresi `whitespace-nowrap tabular-nums`.
   Son kolon `text-right` + `SplitBadge`.
6. **Altta legend** — kart DIŞINDA, yalnız anlamlıysa:
   `<p className="text-xs text-muted-foreground">Gerekçe etiketleri: …</p>`
7. **Yetkisiz görünümü** — sayfanın kendi dalı:
   ```tsx
   <div className="mx-auto max-w-lg py-16 text-center">
     <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
     <h1 className="mb-2 text-lg font-semibold">Bu forma erişim yetkiniz yok</h1>
     <p className="text-sm text-muted-foreground">…</p>
   </div>
   ```

## Ortak bileşenler (yalnız bunlar)

| Ne | Nereden |
|---|---|
| Aksiyon/rozet butonu | `@/components/akademi/SplitBadge` |
| Arama kutusu | `@/components/envanter/EnvanterArama` (+ `envanterAramaEslesir`) |
| Aranabilir seçim | `@/components/envanter/AramaliSecim` |
| Durum rozeti | modülün kendi `durum-rozet` bileşeni (ör. `@/components/bolum-talep/durum-rozet`) |
| İkon | `lucide-react` |
| Bildirim | `sonner` · `toast` |
| Yükleniyor | `lucide-react` · `Loader2` |

## Yapılmayacaklar

- **KPI/özet kutu satırı yok.** `grid-cols-… ` + `text-2xl font-semibold`
  sayaç kartları bu sayfalara konmaz; sayı, kart başlığındaki `X (N)` ile verilir.
- **Ayrı filtre kartı yok.** Arama/süzgeçler başlık bloğunun altında düz bir
  satırda ya da içerik kartının içinde durur; kendi `Card`'ı olmaz.
- **Renkli uyarı bandı yok.** "Gizli kayıt", "dikkat" gibi notlar başlık
  altındaki tek satır açıklamaya girer. (İstisna: işlem sonucu/veri tutarsızlığı
  uyarısı — `rounded-lg border border-amber-300 bg-amber-50`.)
- **Kendi `container mx-auto px-6 py-8` kabuğu yok** — layout zaten sarıyor.
- **`text-2xl font-bold` başlık yok** — standart `text-xl font-semibold`.
- **Yeni ortak bileşen yazılmaz.** Yukarıdaki tablodakiler kullanılır.
- **Tremor yok.** Depoda `@tremor/*` kullanılmıyor.
- **Sabit renk kodu (`text-[#1B4F72]`) yok** — kalite modülündeki eski desen,
  yeni sayfalara taşınmaz.

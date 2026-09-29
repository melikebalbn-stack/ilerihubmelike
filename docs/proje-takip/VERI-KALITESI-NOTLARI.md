# Proje Takip — Veri Kalitesi Notları

Başka bir yerde aynı tuzağa düşmemek için, geliştirme sırasında bulunan veri
sorunları. Her madde dev DB'de (`ilerihub_dev_nurgul`) doğrulandı; prod için
ayrıca kontrol edilmeli.

## 1. Kişiyi isimle bulmak yanlış kayda düşebiliyor (2026-09-28)

**Sorun:** `normalizeTr("Azra İleri")` ile `Personnel.adSoyad` üzerinden arama,
doğru kişiyi değil başka bir kaydı buluyor:

| Personnel | Bölüm | Aktif | Bağlı User |
|---|---|---|---|
| `AZRA İLERİ` (cmp68rigi00mlv6pebka9gx3p) — isim aramasının bulduğu | Yeni İş Geliştirme | **hayır** | **yok** |
| `AZRA ŞURA İLERİ` (cmnwv36zs005dsfpe6fhyceit, ILR-01020) — gerçek kişi | Satış & Pazarlama Müdürlüğü | evet | `ad_azra.ileri` |

Gerçek kişinin Personnel adında ikinci bir isim ("Şura") var; isim araması onu
kaçırıp pasif, hesapsız bir kayda düşüyor. Böyle bir kayda bildirim gidemez,
yetki de verilemez — ve hata sessizdir.

**Etkisi:** Eski fiyat görünürlüğü istisnası (`FIYAT_GORUNUR_EK_KISILER`, isim
bazlı) büyük olasılıkla bu yüzden Azra İleri için hiç çalışmamıştı (917fc56f'te
kaldırıldı; bölüm kuralı onu zaten kapsıyor).

**Kural:** Belirli bir kişiye bağlı iş kuralı/bildirim → **sabit `User.id`**
kullan, isimle arama. Sabit id'nin yanına nerede doğrulandığını yaz ve prod'da
doğrulanmasını iste. Örnek: `IFS_MUSTERI_ACMA_SORUMLUSU_ID = "ad_azra.ileri"`
(`src/app/api/proje-takip/_lib/musteri-bildirim.ts`).

## 2. Müşteri adları serbest metin, tutarsız yazılıyor (2026-09-28)

Hub'da aynı firma farklı yazılmış (`AGCO-VALTRA`, `Agco Valtra`, `AGCO VALTRA`,
`AGCO Valtra`); IFS'teki adlar ise başka kalıpta (`TURK TRAKTOR VE ZIRAAT MAK. A.S.`).
`normalizeTr` yalnız harf/diakritik düzeltir — **boşluk ve noktalama farkını
gidermez**.

**Uygulanan:** `musteriAdiNormalize()` (`src/lib/proje-takip/ifs-musteri.ts`) =
normalizeTr + noktalama/tire → boşluk + çoklu boşluk → tek. Birebir eşleşmezse
"benzer kayıtlar" gösterilir, eşdeğer sayılmaz; karar kullanıcıda. Şirket türü
ekleri (A.Ş., GmbH) tahminle silinmez.

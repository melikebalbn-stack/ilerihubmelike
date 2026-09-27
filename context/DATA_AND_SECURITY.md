# Veri ve güvenlik

## Yetki mekanizması

`User` → `user_role` → `role` → `role_permission` → `permission`.
Anahtarlar oturum açarken JWT'ye yazılır ve **5 dakikada bir DB'den
tazelenir** (`src/lib/auth.ts`). Yani bir rol değişikliği ≤5 dk içinde
kendiliğinden yansır; çıkış-giriş anında yansıtır.

Kod tarafı: `requirePermission(key)` tek anahtar, dizi verilirse **OR**.
İki anahtarın **birlikte** istendiği yerde `requireAllPermissions([...])`.

## 🔴 Servis yetki matrisi — 13 anahtar

Bu tablo daha önce repo dışında bir belgede duruyordu ve kodla senkron
kalmıyordu. **Tek kaynak artık burasıdır**; kod karşılığı
`prisma/seed-servis-role-mapping.ts` başlığındaki tablodur (ikisi aynı
kümeyi tutar, `src/lib/auth/servis-permission-sabitleri.test.ts` bunu
sabitler).

| Anahtar | super-admin | admin | hr-yoneticisi | idari-isler |
|---|:--:|:--:|:--:|:--:|
| servis.view | ✓ | ✓ | ✓ | ✓ |
| servis.create | ✓ | ✓ | ✓ | ✓ |
| servis.edit | ✓ | ✓ | ✓ | ✓ |
| servis.history | ✓ | ✓ | ✓ | ✓ |
| servis.tanim.manage | ✓ | ✓ | ✓ | ✓ |
| servis.sorumlu.manage | ✓ | ✓ | ✓ | ✓ |
| servis.passive | ✓ | ✓ | ✓ | — |
| servis.restore | ✓ | ✓ | ✓ | — |
| servis.export | ✓ | ✓ | ✓ | — |
| servis.kvkk.view | ✓ | — | ✓ | — |
| servis.liste.publish | ✓ | — | ✓ | — |
| servis.sikayet.view | ✓ | — | ✓ | ✓ |
| servis.sikayet.manage | ✓ | — | ✓ | ✓ |

### Anahtarların anlamı

- **`servis.edit` = operasyonel kayıt** düzenleme: personel atama, personel
  durum. Bugün yalnız iki uç kullanır.
- **`servis.tanim.manage` = tanım kaydı** düzenleme: firma, yerleşke,
  güzergâh, durak, araç, şoför, sefer dilimi, varsayılanlar, sıra, saat.
- Ayrım bugün **yalnız belgeleyicidir** — iki anahtarın rol kümesi aynı.
  Roller ileride ayrışırsa anlam hazır olsun diye sabitlendi.
  Sürüklenme testi: `src/lib/auth/servis-edit-tanim-ayrimi.test.ts`.

### Kurallar

- 🔴 **Entity'ye özel `.manage` yalnız CREATE/EDIT kapsar.** Pasifleştirme ve
  geri alma **her zaman** generic `servis.passive` / `servis.restore`
  kullanır. Yeni bir `.manage` anahtarı bu iki işi kapsamaz.
- 🔴 **Şikâyet anahtarlarında `admin` BİLEREK dışarıda.** Şikâyet kaydı
  şikâyetçi kimliği taşır; bu kişisel veriyi yalnız İK/İdari İşler görür.
  Aynı gerekçe `servis.kvkk.view` satırında da var — desen tekrarlanıyor,
  icat edilmiyor.
- 🔴 **Dışa aktarım ekrandan geniş olamaz.** Export ucu, ekranın view
  anahtarı **VE** `servis.export` ister (AND). Örnek: şikâyet export'u
  `servis.sikayet.view` + `servis.export` — `servis.view` **değil**, çünkü
  `admin` rolünde `servis.view` var ama `servis.sikayet.view` yok.
- 🔴 **Her anahtarın ya bir tüketicisi ya da "rezerve" satırı olacak.**
  Bugünkü tek rezerve: **`servis.liste.publish` — madde 30 (versiyonlu liste
  yayımlama) için.** Tüketicisi olmayan ve rezerve de olmayan anahtar
  düşürülür (`servis.admin` bu yüzden düşürüldü, `8eea6ad1` main'de).

### Prod durumu ve rol açılışı

🔴 Prod'da servis anahtarları şu an **yalnız `super-admin`'dedir**. Rollere
açılış yazılı tetikleyiciye bağlıdır: **"servis çekirdeği prod'a çıkıp göç
doğrulandıktan sonra"**. Bu gerçekleşmeden rol eşlemesi genişletilmez.

### Yayın paketi sırası (🔴 sıra zorunlu)

```
npm run seed:permissions                       # anahtar sözlüğü (bootstrap-only)
npx tsx prisma/seed-servis-role-mapping.ts     # rol eşlemesi
```

İkincisi, permission satırı yoksa `process.exit(1)` verir. İkisi de additive
ve idempotenttir; satır **silmezler** — kodda karşılığı kalmayan anahtar
"DB'de var ama kodda yok" uyarısı olarak listelenir, elle temizlenir.

## KVKK ve veri sınırları

- **Minimum veri.** Personel adres/telefon/konum verisinde yalnız işin
  gerektirdiği alan seçilir. Servis modülünde Personnel'den yalnız
  `id / sicilNo / adSoyad / bolum` okunur; telefon, adres, e-posta **yok**.
- **Maskeleme değil, hiç seçmeme.** Firmaya gidecek veride şikâyetçi
  kimliği prisma `select`'ine **hiç konmaz** — maskelenen veri yine sunucudan
  geçer ve bir loga düşebilir.
- **Fail-closed sınır bekçisi.** `src/lib/servis-yonetimi/sikayet-firma-siniri.ts`
  ikinci hattır: sorgu katmanı bir gün yanlışlıkla şikâyetçi seçerse veri
  firmaya ulaşmadan **hata fırlatır**. Ayıklamaz — hata görünür olsun ki
  kaynağı düzeltilsin.
- **Durak konumu kişisel veri değildir** (kod/ad firmaya gidebilir), ama
  il/ilçe/mahalle/koordinat firma görünümüne **konmaz**.
- **Rapor dosyaları `mode 0600`.** Sicil no içeren çıktılar (göç dry-run
  raporu vb.) bu izinle yazılır.
- **Denetim izi değer yazmaz** — yalnız değişen alan adları
  (`permission_audit_log`, `logAuditEvent`).

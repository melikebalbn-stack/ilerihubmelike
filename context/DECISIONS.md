# Kalıcı kararlar

Yalnız **mimari, veri modeli, modül sınırı, güvenlik ve geri dönüşü pahalı
süreç** kararları. Bug fix ve küçük UI değişikliği buraya yazılmaz.

Biçim: karar · gerekçe · nerede uygulanıyor.

---

## Yetki

**`servis.edit` operasyonel kayıt, `servis.tanim.manage` tanım kaydı içindir.**
Rol kümeleri bugün aynı olsa da ayrım korunur; roller ileride ayrışabilir.
→ `src/lib/auth/servis-edit-tanim-ayrimi.test.ts`

**Entity'ye özel `.manage` anahtarı pasifleştirme/geri almayı kapsamaz.**
Bu iki iş her zaman generic `servis.passive`/`servis.restore` ile yapılır —
aksi hâlde her entity için iki anahtar daha doğar.

**Tüketicisi olmayan anahtar düşürülür.** İstisna: "rezerve — şu madde için"
diye yazılı olanlar. `servis.admin` bu kuralla düşürüldü (`8eea6ad1`).

**Dışa aktarım ekrandan geniş olamaz.** Export ucu ekranın view anahtarı VE
`servis.export` ister (AND, `requireAllPermissions`).

**Şikâyet verisinde `admin` dışarıda.** Şikâyetçi kimliği kişisel veridir;
yalnız İK/İdari İşler görür. Aynı gerekçe `servis.kvkk.view`'da da geçerli.

## Veri ve KVKK

**Firmaya giden veride şikâyetçi alanı prisma `select`'ine hiç konmaz.**
Maskeleme değil, hiç seçmeme — maskelenen veri yine sunucudan geçer.
İkinci hat: `sikayet-firma-siniri.ts`, **fail-closed**, ayıklamaz, hata
fırlatır.

**Toplu içe aktarmada boş hücre = dokunma.** Excel'de boş bırakılan hücre
mevcut değeri **silmez**. Bir alanı temizlemek için kayıt ekranı kullanılır.
→ `src/app/api/personnel/import/route.ts`

**İ/I katlaması yapılmaz.** Türkçe normalizasyonda `İ`→`I` katlaması veri
eşleştirmede yanlış pozitif üretir; karar koda ve teste sabitlendi.

**Pasifleştirme silmedir yerine geçer.** Servis tanım kayıtlarında fiziksel
silme yoktur. Fiziksel silme istisnadır ve sahibinin açık talimatını
gerektirir.

## Mimari

**API ucu iş mantığı taşımaz.** Uç = yetki + parametre + durum kodu; mantık
`src/lib/` altında ve oradan test edilir.

**Seri numarası advisory lock ile üretilir** — `pg_advisory_xact_lock` +
`MAX(no)+1` aynı transaction'da. Retry yoktur, gerekmez.

**Nokta-zaman sorgusu `aktif` bayrağına güvenmez**; tarih aralığı pozitif
AND-of-OR ile sorgulanır.

**Tek şema dosyası, modül başına model sahipliği.** Başkasının modeline
dokunmadan önce sorulur. `prisma format` paylaşımlı şemada çalıştırılmaz.

**PDF üreticilerinde ortak iskele yok** (bilinçli). `src/lib/pdf/` altındaki
her üretici kendi font/başlık/tablo bloğunu taşır; paylaşılan tek şey
`fonts/poppins.ts`. İskele ayrı bir iş olarak duruyor.

**Excel yazımı:** servis modülü `xlsx` kullanır. Şikâyet raporu istisnadır ve
`src/lib/rapor/gorunum-xlsx.ts` (exceljs) yeniden kullanır — gruplama ve alt
toplam gerektiği için. Bu istisna dosya başında notlanmıştır.

## Süreç

**Göç script'i tanım verisi yaratmaz**, yalnız `kod` ile arar. Tanım verisi
ayrı bir adımdır ve bugün otomasyonu yoktur.

**Seed'ler additive ve idempotenttir**, satır silmezler. Kodda karşılığı
kalmayan satır "DB'de var ama kodda yok" uyarısıyla raporlanır, elle
temizlenir.

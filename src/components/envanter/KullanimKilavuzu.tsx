'use client'

// IV / Envanter Faz 2 — 2b-3 · Kullanım Kılavuzu modalı (başlık yanındaki ? ikonu açar).
// 16.08.2026 güncellemesi: Sezon Planı detayları, Bakım Yönlendirme, Sil/Pasifleştir/İptal
// mekanizması, satın almada ürün kataloğu seçimi, İşlem Kaydı raporu ve Hedef Yaka/Hedef
// Bölüm çoklu seçimi eklendi.
export function KullanimKilavuzu({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b p-6">
          <h2 className="text-xl font-bold text-slate-900">Kullanım Kılavuzu</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1 text-sm text-slate-500 hover:bg-slate-100">
            Kapat
          </button>
        </div>
        <div className="space-y-5 p-6 text-sm text-slate-700">
          <div className="rounded-xl bg-teal-50 p-4">
            <p className="font-semibold text-teal-900">Bu modül ne işe yarar?</p>
            <p className="mt-1 text-teal-800">Stok, personel zimmeti (KKD/demirbaş), sarf malzeme dağıtımı, sezonluk kıyafet dağıtımı, satın alma talepleri ve bakım yönlendirme süreçlerini tek panelden yönetir. "Elimizde ne var, ne azaldı, ne zaman sipariş açmalı, kim aldı, ne kadara mal oldu, kim ne zaman ne işlem yaptı" sorularının tümü buradan yanıtlanır.</p>
          </div>

          <div>
            <p className="font-semibold text-slate-900">Nereden başlamalı? (ilk kurulum sırası)</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li><span className="font-medium">Parametreler</span>'den kategorileri ve KKD yenileme periyotlarını tanımla.</li>
              <li><span className="font-medium">Ürün Yönetimi</span>'nden ürünleri tanımla (gerekiyorsa beden/renk/numara varyantlarıyla). Sezonluk dağıtılan ürünlerde <span className="font-medium">Hedef Yaka</span> (Mavi/Beyaz/Gri — birden fazlası işaretlenebilir), <span className="font-medium">Hedef Bölüm</span> (birden fazla bölüm işaretlenebilir, kıyafet dışı ürünlerde kullanışlıdır) ve <span className="font-medium">Kullanım Ömrü (Gün)</span> alanlarını da doldur — bunlar Sezon Planı'nın doğru hesap yapması için zorunlu kabul edilmeli (aşağıdaki "Modüller Arası Bağımlılıklar" bölümüne bak).</li>
              <li>Her ürünün <span className="font-medium">Detay</span> ekranından stok bazında <span className="font-medium">min/kritik eşik</span> ve <span className="font-medium">birim maliyet</span> gir. Eşik girilmezse o ürün "kritik" olarak yakalanamaz.</li>
              <li><span className="font-medium">Stok Yönetimi</span>'nden giriş yaparak mevcut miktarları oluştur.</li>
              <li>Artık günlük kullanım: çıkışları/zimmetleri işle, kritikleri Dashboard'dan takip et, gerekirse Satın Alma'da talep aç, sezonu geldiğinde Sezon Planı ile toplu ihtiyaç çıkar.</li>
            </ol>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-amber-900">Modüller arası bağımlılıklar — eksik bırakılırsa ne olur?</p>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-amber-900">
              <li><span className="font-medium">Ürün → Hedef Yaka / Hedef Bölüm (çoklu seçim):</span> Her ikisi de birden fazla değer işaretlenebilir (ör. Mavi Yaka + Gri Yaka, ya da Kaynakhane + Depo). Bir alan boş bırakılırsa Sezon Planı o boyutta filtre UYGULAMAZ — Hedef Yaka boşsa tüm yaka renkleri, Hedef Bölüm boşsa tüm bölümler hedef kitleye dahil olur. İkisi de boşsa (eski davranışla aynı) şirketteki TÜM personel hedef kitle sayılır. Hedef Bölüm seçenekleri gerçek personel kayıtlarındaki Bölüm bilgisinden geliyor — sistemde bölüm bilgisi girilmiş aktif personel yoksa bu liste boş görünür (bu bir arayüz hatası değildir, veri eksikliğidir).</li>
              <li><span className="font-medium">Ürün → Kullanım Ömrü (Gün):</span> Boş bırakılırsa iki şey bozulur — (1) Sezon Planı'nın "kimin süresi dolmuş, kimin dolmamış" ayrımı (yenileme kontrolü) hiç çalışmaz, süresi dolmamış personel de her sezon yeniden ihtiyaç listesine girer; (2) kalem eklerken görünen "yıllık kişi başı adet önerisi" (365 ÷ gün) hiç hesaplanamaz, "Öneriyi Kullan" butonu çıkmaz.</li>
              <li><span className="font-medium">Ürün → Min/Kritik Stok Eşiği:</span> Boş bırakılırsa ürün Dashboard'daki "Sipariş Açılmalı" listesinde doğru önceliklendirilemez; stok durumu her zaman "Eksik" (belirsiz) görünür, gerçek kritiklik seviyesi (Kritik/Minimum) hesaplanamaz.</li>
              <li><span className="font-medium">Kategori → Ürün:</span> Ürün üzerindeki kategori bir metin alanıdır, kategoriye doğrudan bağlı (foreign key) değildir. Bir kategori pasifleştirilse/silinse bile onu daha önce kullanan ürünler etkilenmez, sadece o kategori artık yeni ürün/talep formlarındaki seçim listesinde görünmez.</li>
              <li><span className="font-medium">Ürün Kataloğu → Satın Alma Kalemi:</span> Yeni Talep formunda bir kalemi ürün kataloğundan seçersen (Malzeme Kodu/Adı otomatik dolar), talep "Stoğa İşlendi" aşamasına geldiğinde bu kalem otomatik olarak stoğa eklenir. Ama "Diğer (elle yaz)" ile serbest girdiğin (henüz kataloğa girilmemiş) bir kalem, Stoğa İşle adımında OTOMATİK OLARAK STOĞA YANSIMAZ — sistemin hangi ürüne ekleyeceğini bilecek bir referansı yoktur. Böyle bir malzeme gelince, önce Ürün Yönetimi'nden kataloğa eklenip sonra Stok Yönetimi'nden elle giriş yapılmalıdır.</li>
              <li><span className="font-medium">Varyant → Stok:</span> Bir ürüne yeni varyant eklendiğinde o varyant için otomatik olarak mevcut=0 bir stok kaydı açılır. Her varyantın kendi min/kritik eşiği ve birim maliyeti ayrı ayrı girilmelidir (kırmızı 5 TL, sarı 6 EUR gibi farklı olabilir).</li>
              <li><span className="font-medium">Sezon Planı → Ürün:</span> Bir kalem eklemek için ürünün önceden Ürün Yönetimi'nde tanımlı olması gerekir; plan ekranından yeni ürün oluşturulamaz.</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-slate-900">Dashboard</p>
            <p className="text-slate-600">Genel durumu ve aksiyon gerektirenleri gösterir.</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Üstte özet kartlar: toplam ürün, toplam stok, kritik ürün, stoksuz ürün.</li>
              <li><span className="font-medium">Sipariş Açılmalı</span> listesi: eşiğin altına düşen ürünler. Satırdaki <span className="font-medium">Talep Aç</span> → Satın Alma formunu o ürünle açar. <span className="font-medium">Kritik Ürünleri Bildir</span> → ilgili kişilere mail gönderir.</li>
            </ul>
            <p className="mt-1 text-rose-700"><span className="font-medium">Dikkat:</span> Bir ürün burada görünmüyorsa eşiği tanımlı değildir. Eşik için Ürün Yönetimi → Detay.</p>
          </div>

          <div>
            <p className="font-semibold text-slate-900">Ürün Yönetimi</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li><span className="font-medium">Yeni Ürün</span> → sihirbaz: Genel (kod/ad/kategori), Varyant (beden/renk/numara), stok/dağıtım bilgileri, "Personel Hedefleme" adımında Hedef Yaka/Hedef Bölüm (çoklu seçim, işaretleme kutularıyla), kullanım ömrü.</li>
              <li><span className="font-medium">Varyant</span> kolonu: ürünün tanımlı varyantlarını özetler (ör. "Renk: Kırmızı, Sarı").</li>
              <li><span className="font-medium">Detay</span> ekranında: mevcut ürüne sonradan varyant ekleme; her stok satırına min/kritik eşik ve birim maliyet + para birimi (TL/EUR/USD) girme; Hedef Yaka/Hedef Bölüm işaretleme kutularıyla sonradan da (birden fazla seçenek işaretleyerek) düzenlenebilir.</li>
              <li>Varyant eklerken <span className="font-medium">Değer</span> alanı artık serbest metin değildir — Tip'e (Beden/Numara/Renk) göre mevcut tanımlı listeden seçilir. Listede olmayan bir değer gerekiyorsa "Diğer (elle yaz)" seçeneğiyle serbest girilebilir.</li>
              <li><span className="font-medium">Sil:</span> Ürün Detay ekranındaki "Sil" butonu — bu ürünün hiç stok hareketi veya zimmet geçmişi yoksa kalıcı olarak silinir. Geçmişi varsa (daha önce stok girişi/çıkışı veya zimmet yapılmışsa) kalıcı silinemez, bunun yerine otomatik olarak <span className="font-medium">pasifleştirilir</span> — ürün listelerden/yeni işlemlerden gizlenir ama geçmiş kayıtlar (raporlar, denetim) bozulmadan kalır.</li>
            </ul>
            <p className="mt-1 text-rose-700"><span className="font-medium">Dikkat:</span> Varyant eklenince o varyant için stok kaydı otomatik açılır (mevcut 0). Maliyet ve eşik her varyant için ayrı girilir.</p>
          </div>

          <div>
            <p className="font-semibold text-slate-900">Stok Yönetimi</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>Ürünü seç.</li>
              <li>Varyantlı ürünse Stoklar tablosundan <span className="font-medium">doğru varyantın SEÇ radyosunu</span> işaretle.</li>
              <li>Hareket tipini seç: Giriş / Çıkış / İade / Hurda / Sayım Düzeltme.</li>
              <li>Çıkışsa <span className="font-medium">Bölüm</span> + <span className="font-medium">Alan Personel</span> seç (sarf dağıtım takibi için).</li>
              <li>Miktar gir, kaydet.</li>
            </ol>
            <p className="mt-1 text-rose-700"><span className="font-medium">Dikkat:</span> Varyant seçmezsen hareket "Ana Ürün"e gider. Yanlış bir hareketi <span className="font-medium">Son Hareketler → Geri Al</span> ile tersine çevir (kayıt silinmez, ters hareket oluşur — bu, orijinal kaydı silmez, sadece etkisini tersine çeviren yeni bir hareket ekler).</p>
          </div>

          <div>
            <p className="font-semibold text-slate-900">Personel Zimmeti</p>
            <p className="text-slate-600">KKD/demirbaş teslimi ve teslim takip listesi. İki görünüm arasında geçiş yapılır: <span className="font-medium">Zimmet Ver</span> ve <span className="font-medium">Teslim Takip Listesi</span>.</p>
            <p className="mt-2 font-medium text-slate-800">Zimmet Ver</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>Personeli ara ve seç.</li>
              <li>Stok satırını (ürün + varyant) seç.</li>
              <li>KKD Kategorisi ve Verilme Tarihi'ni gir — bu iki alan doldurulmazsa zimmet Teslim Takip Listesi'nde görünmez.</li>
              <li>Miktar ve açıklama gir, "Zimmet Oluştur" ile kaydet. Stoktan otomatik düşülür.</li>
            </ol>
            <p className="mt-2 font-medium text-slate-800">Personel seçildikten sonra: Aktif Zimmetler / Geçmiş</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li><span className="font-medium">İade Al:</span> Aktif bir zimmetten kısmi veya tam iade alınır; iade edilen miktar stoğa geri eklenir. Tam iade edilirse kayıt "İade Edildi" durumuna geçer, kısmi iade edilirse kalan miktar aktif kalır ve iade edilen kısım ayrı bir "İade Edildi" kaydı olarak görünür.</li>
              <li><span className="font-medium">Sil:</span> Sadece hâlâ AKTİF (hiç iade edilmemiş) zimmetlerde görünür. Yanlışlıkla oluşturulmuş bir zimmeti tamamen kaldırır ve düşülen stoğu geri ekler. İade edilmiş/kapanmış bir kayıt için Sil kullanılamaz.</li>
              <li><span className="font-medium">İptal Et:</span> Sadece "İade Edildi" (geçmiş) kayıtlarda görünür. Kaydı silmez, sadece "İptal" olarak işaretler (örneğin yanlış personele/ürüne zimmetlenmiş ve zaten iade edilmiş bir kaydı geçersiz kılmak için) — stoğa dokunmaz, çünkü stok zaten iade sırasında doğru şekilde güncellenmiştir.</li>
            </ul>
            <p className="mt-2 font-medium text-slate-800">Teslim Takip Listesi</p>
            <p className="text-slate-600">Personel bazında hangi KKD grubundan en son ne zaman/kaç adet verildiğini gösteren matris. Yaklaşan/geçen yenileme tarihleri renkli vurgulanır (kırmızı: süresi geçmiş, amber: yaklaşıyor). Kolon seçici + Excel dışa aktarım vardır.</p>
          </div>

          <div>
            <p className="font-semibold text-slate-900">Sezon Planı</p>
            <p className="text-slate-600">Sezonluk kıyafet/KKD ihtiyacını, personel beden profillerine ve ürünün hedef kitlesine göre hesaplayan modül. Bir sezon planı; plan başlığı (ad, yıl), kalemler (hangi ürün, kişi başı kaç adet) ve hesaplama parametrelerinden (Planlanan Alım, Turnover Oranı, Emniyet Payı Oranı) oluşur.</p>
            <p className="mt-2 font-medium text-slate-800">Yeni plan oluşturma ve kalem ekleme</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>"Yeni Plan" ile ad/yıl gir, gerekirse not ekle.</li>
              <li>Planı seç, "Kalemler" bölümünden ürün seç (sadece Ürün Yönetimi'nde tanımlı ürünler listelenir) ve Kişi Başı Adet gir.</li>
              <li>Seçilen ürünün Kullanım Ömrü (Gün) bilgisi varsa, ekranda otomatik bir "yıllık kişi başı öneri" (365 ÷ kullanım ömrü) çıkar; "Öneriyi Kullan" ile bu değeri Kişi Başı Adet alanına aktarabilirsin.</li>
              <li>"Kalem Ekle" ile kalemi plana kaydet. Bu adımı her ürün için tekrarla.</li>
            </ol>
            <p className="mt-2 font-medium text-slate-800">İhtiyaç hesaplama</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>"İhtiyaç Hesapla" her kalem için: hedef kitle (ürünün Hedef Yaka/Hedef Bölüm'üne uyan personel sayısı) × kişi başı adet formülüyle başlar, sonra Planlanan Alım (yeni işe alım beklentisi), Turnover Oranı (%) ve Emniyet Payı Oranı (%) ile ölçeklenir.</li>
              <li><span className="font-medium">Zaten Üzerinde</span> sütunu: ürünün Kullanım Ömrü (Gün) bilgisine göre, son zimmetinin üzerinden henüz süresi dolmamış personel sayısını gösterir — bu kişiler o sezonun ihtiyaç toplamına DAHİL EDİLMEZ (zaten yenilenmesi gerekmiyor).</li>
              <li>Ekranda görünen iki yardım rozeti ("Nasıl hesaplanır?" ve "Neden farklı?") üzerine gelindiğinde hesap mantığını ve şirket geneli özet ile kalem bazlı tablo arasındaki farkı açıklar.</li>
              <li>Hesap sonrası, doğrudan buradan bir Satın Alma talebi oluşturulabilir.</li>
            </ul>
            <p className="mt-2 font-medium text-slate-800">Planı Sil</p>
            <p className="text-slate-600">Plan detay ekranındaki "Planı Sil" butonu, planı TÜM kalemleriyle birlikte kalıcı olarak siler (başka hiçbir kayıt bir plana referans vermediği için burada pasifleştirme yoktur, doğrudan kalıcı silme yapılır). Bu işlem geri alınamaz — silinen planın kalemleri ve o plana özel Planlanan Alım/Turnover/Emniyet Payı override'ları tamamen kaybolur.</p>
          </div>

          <div>
            <p className="font-semibold text-slate-900">Satın Alma — Doğrudan Talepler</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li><span className="font-medium">Yeni Talep</span> → Bölüm, Masraf Yeri, Asansör/Mekanik bilgilerini gir (ya da Dashboard/Sezon Planı'ndan "Talep Aç" ile ön-dolu gelir).</li>
              <li>Her kalem satırında önce <span className="font-medium">Ürün Seçiniz</span> açılır listesinden ilgili ürünü (kod - ad - kategori) seç — seçtiğinde Malzeme Kodu/Adı otomatik dolar ve kalem gerçek ürünle ilişkilendirilir. Kataloğa henüz girilmemiş yepyeni bir malzeme talep ediyorsan listenin altındaki <span className="font-medium">"Diğer (elle yaz)"</span> seçeneğiyle serbest metin gir (bkz. yukarıdaki "Modüller Arası Bağımlılıklar" — bu şekilde eklenen kalemler Stoğa İşle adımında otomatik stoğa yansımaz).</li>
              <li>Miktar ve açıklama gir, gerekirse "Satır Ekle" ile başka kalemler ekle.</li>
              <li>Talebi oluştur — talep "Taslak" durumunda başlar.</li>
              <li>Onay zincirinden geçer: İdari İşler → Müdür Yrd. → Müdür → Satın Alma. Her aşamada Onayla/Reddet/Revize aksiyonları kullanılır, ilgili kişilere bildirim gider.</li>
              <li>Onaylanınca sırasıyla: Sipariş Açıldı → Termin Girildi → Teslim Alındı → Stoğa İşlendi.</li>
            </ol>
            <p className="mt-2 font-medium text-slate-800">Talebi İptal Et / Sil</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li><span className="font-medium">Talebi İptal Et:</span> Talep detay ekranında, henüz sonlanmamış (Reddedildi/İptal/Stoğa İşlendi dışında) herhangi bir aşamada kullanılabilir. Talebi "İptal" durumuna alır, isteğe bağlı bir sebep notu eklenebilir. Kayıt silinmez, geçmişte görünmeye devam eder.</li>
              <li><span className="font-medium">Sil:</span> Talep listesindeki "Sil" butonu SADECE talep hâlâ "Taslak" durumundaysa VE üzerinde hiçbir onay/red/revize/iptal işlemi yapılmamışsa (yani oluşturulduğu andaki haliyle) çalışır — talebi kalıcı olarak kaldırır. Talebe herhangi bir işlem yapılmışsa Sil butonu bir hata mesajı döner ve bunun yerine "Talebi İptal Et" kullanılmasını ister.</li>
            </ul>
            <p className="mt-1 text-rose-700"><span className="font-medium">Dikkat:</span> "İhtiyaç Duyan Bölüm" alanı malzemenin hangi bölüm için istendiğidir, talebi açan kişi/bölüm oturumdan otomatik gelir. Bu ikisi karıştırılmamalı.</p>
          </div>

          <div>
            <p className="font-semibold text-slate-900">Satın Alma — Bakım Yönlendirme</p>
            <p className="text-slate-600">Tespit edilip bakım birimine yönlendirilen işlerin (arıza, tamir, tesisat vb.) takip edildiği ayrı bir liste. Bakımın konuyu kendi çözüp çözmediğini veya dışarıdan servis/satın alma talebi açıp açmadığını buradan izle.</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>"Yeni Kayıt" ile Konu, Lokasyon ve Açıklama gir. Kayıt "Tespit Edildi" durumunda oluşur.</li>
              <li>İş ilerledikçe kaydı seç, "Durum Güncelle" ekranından durumu (Bakıma Yönlendirildi → Bakım İnceledi → Kendi Çözdü / Servis Talebi Açıldı → Tamamlandı, veya İptal) ve varsa Servis/Talep Referansı ile Sonuç Notu'nu gir.</li>
              <li>Kendi Çözdü, Tamamlandı ve İptal durumları KAPALI (terminal) kabul edilir — bu durumdaki kayıtlar artık güncellenemez.</li>
            </ol>
            <p className="mt-1 text-rose-700"><span className="font-medium">Dikkat:</span> Durum filtresini "Tespit Edildi" gibi belirli bir değerde bıraktıysan, durumu değiştirdiğin (ör. Tamamlandı yaptığın) bir kayıt o filtrede artık görünmez — kaybolmadı, sadece filtrelendi. Tüm kayıtları görmek için filtreyi "Tüm durumlar" yap.</p>
            <p className="mt-1 text-slate-600"><span className="font-medium">Sil:</span> Sadece "Tespit Edildi" durumunda VE Servis/Talep Referansı ile Sonuç Notu hâlâ boşsa (yani üzerinde hiçbir işlem yapılmamış, yalnızca oluşturma anındaki hali varsa) listedeki "Sil" butonu görünür ve kaydı kalıcı olarak kaldırır. Herhangi bir ilerleme kaydedilmişse Sil görünmez, bunun yerine durumu "İptal" olarak güncelleyerek kapatabilirsin.</p>
          </div>

          <div>
            <p className="font-semibold text-slate-900">Parametreler</p>
            <p className="text-slate-600">Kategoriler ve KKD yenileme periyotları gibi tanımlar buradan yönetilir. Yeni ürün/talep formundaki kategori listesi buradan beslenir.</p>
            <p className="mt-1 text-slate-600"><span className="font-medium">Sil:</span> Bir kategoriyi hiçbir ürün kullanmıyorsa kalıcı olarak silinir. En az bir ürün o kategoriyi kullanıyorsa kalıcı silinemez, otomatik olarak pasifleştirilir (yeni ürün/talep formlarındaki seçim listesinden kalkar, ama zaten o kategoriyi taşıyan mevcut ürünler etkilenmez).</p>
          </div>

          <div>
            <p className="font-semibold text-slate-900">Veri Aktarımı</p>
            <p className="text-slate-600">Excel şablonuyla toplu ürün, zimmet geçmişi ve beden profili içe aktarma. Şablonu indir, doldur, yükle.</p>
          </div>

          <div>
            <p className="font-semibold text-slate-900">Raporlar</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li><span className="font-medium">KKD Yenileme:</span> Yaklaşan/geçen hak edişler (kime, ne zaman yenilenmeli).</li>
              <li><span className="font-medium">Sarf Tüketim:</span> Kim / hangi bölüm, hangi malzemeden ne kadar aldı. Ay sonu tüketim takibi.</li>
              <li><span className="font-medium">Maliyet:</span> Tüketim (çıkış) ve satın alma (giriş) maliyeti. Para birimine göre ayrı toplanır (kur çevrimi yok).</li>
              <li><span className="font-medium">İşlem Kaydı:</span> Modüldeki tüm oluşturma, güncelleme, silme, pasifleştirme ve iptal işlemlerinin denetim kaydı — kim, ne zaman, hangi kayıt üzerinde, ne işlem yaptı. Tarih aralığı, işlem tipi ve hedef tipine göre filtrelenebilir. Bu rapor sadece envanter yönetici yetkisi olan kullanıcılara açıktır (diğer raporlardan daha hassas kabul edilir).</li>
            </ul>
            <p className="mt-1 text-slate-600">Hepsinde tarih aralığı filtresi + Excel dışa aktarım vardır.</p>
          </div>

          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <p className="font-semibold text-rose-900">Silme, Pasifleştirme ve İptal — genel kural</p>
            <p className="mt-1 text-rose-800">Modülün her alanında aynı mantık uygulanır: bir kaydın hiç geçmişi/bağımlı işlemi yoksa <span className="font-medium">kalıcı silinir</span>; geçmişi varsa (denetim/rapor bütünlüğü bozulmasın diye) <span className="font-medium">pasifleştirilir veya iptal edilir</span>, kayıt saklanmaya devam eder. Bu işlemlerin hepsi envanter yönetici yetkisi gerektirir ve İşlem Kaydı raporuna otomatik olarak yazılır.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-rose-800">
              <li><span className="font-medium">Ürün:</span> geçmişi yoksa sil, varsa pasifleştir.</li>
              <li><span className="font-medium">Sezon Planı:</span> her zaman kalıcı silinir (geri alınamaz).</li>
              <li><span className="font-medium">Kategori:</span> kullanan ürün yoksa sil, varsa pasifleştir.</li>
              <li><span className="font-medium">Satın Alma Talebi:</span> Taslak ve hiç işlem geçmişi yoksa sil, aksi halde İptal Et.</li>
              <li><span className="font-medium">Zimmet:</span> hiç iade edilmemişse (Aktif) sil — stok geri eklenir; iade edilmişse İptal Et — stoğa dokunulmaz.</li>
              <li><span className="font-medium">Bakım Yönlendirme:</span> hiç işlem görmemişse (Tespit Edildi, referans/not boş) sil, aksi halde durumu İptal olarak güncelle.</li>
            </ul>
          </div>

          <div className="rounded-xl border-t bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">Tipik günlük akış</p>
            <p className="mt-1 text-slate-600">Ürün/varyant tanımla (hedef kitle + kullanım ömrü dahil) → eşik ve maliyet gir → stok giriş/çıkış yap veya personele zimmetle → kritik olanı Dashboard'da gör → <span className="font-medium">Talep Aç</span> veya mail ile bildir → Satın Alma'da süreci tamamla (onay → sipariş → teslim → stoğa işle) → sezonu geldiğinde Sezon Planı ile toplu ihtiyaç çıkar → hatalı bir kayıt varsa uygun şekilde Sil/Pasifleştir/İptal et → sonuçları ve tüm işlemleri Raporlar'dan izle.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

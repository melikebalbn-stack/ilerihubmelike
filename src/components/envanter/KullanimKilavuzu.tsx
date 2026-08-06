'use client'

// IV / Envanter Faz 2 — 2b-3 · Kullanım Kılavuzu modalı (başlık yanındaki ? ikonu açar).
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
            <p className="mt-1 text-teal-800">Stok, personel zimmeti (KKD/demirbaş), sarf malzeme dağıtımı ve satın alma süreçlerini tek panelden yönetir. "Elimizde ne var, ne azaldı, ne zaman sipariş açmalı, kim aldı, ne kadara mal oldu" sorularının tümü buradan yanıtlanır.</p>
          </div>

          <div>
            <p className="font-semibold text-slate-900">Nereden başlamalı? (ilk kurulum sırası)</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li><span className="font-medium">Parametreler</span>'den kategorileri ve KKD yenileme periyotlarını kontrol et.</li>
              <li><span className="font-medium">Ürün Yönetimi</span>'nden ürünleri tanımla (gerekiyorsa beden/renk/numara varyantlarıyla).</li>
              <li>Her ürünün <span className="font-medium">Detay</span> ekranından stok bazında <span className="font-medium">min/kritik eşik</span> ve <span className="font-medium">birim maliyet</span> gir. Eşik girilmezse o ürün "kritik" olarak yakalanamaz.</li>
              <li><span className="font-medium">Stok Yönetimi</span>'nden giriş yaparak mevcut miktarları oluştur.</li>
              <li>Artık günlük kullanım: çıkışları işle, kritikleri Dashboard'dan takip et, sipariş aç.</li>
            </ol>
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
              <li><span className="font-medium">Yeni Ürün</span> → sihirbaz: Genel (kod/ad/kategori), Varyant (beden/renk/numara), stok/dağıtım bilgileri.</li>
              <li><span className="font-medium">Varyant</span> kolonu: ürünün tanımlı varyantlarını özetler (ör. "Renk: Kırmızı, Sarı").</li>
              <li><span className="font-medium">Detay</span> ekranında: mevcut ürüne sonradan varyant ekleme; her stok satırına min/kritik eşik ve birim maliyet + para birimi (TL/EUR/USD) girme.</li>
            </ul>
            <p className="mt-1 text-rose-700"><span className="font-medium">Dikkat:</span> Varyant eklenince o varyant için stok kaydı otomatik açılır (mevcut 0). Maliyet ve eşik her varyant için ayrı girilir (kırmızı 5 TL, sarı 6 EUR gibi).</p>
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
            <p className="mt-1 text-rose-700"><span className="font-medium">Dikkat:</span> Varyant seçmezsen hareket "Ana Ürün"e gider. Yanlış bir hareketi <span className="font-medium">Son Hareketler → Geri Al</span> ile tersine çevir (kayıt silinmez, ters hareket oluşur).</p>
          </div>

          <div>
            <p className="font-semibold text-slate-900">Personel Zimmeti</p>
            <p className="text-slate-600">KKD/demirbaş teslimi ve teslim takip listesi. Kime, ne zaman, hangi bedende teslim edildiği kaydedilir. Yaklaşan/geçen yenileme tarihleri renkli vurgulanır. Kolon seçici + Excel dışa aktarım vardır.</p>
          </div>

          <div>
            <p className="font-semibold text-slate-900">Sezon Planı</p>
            <p className="text-slate-600">Sezonluk kıyafet ihtiyacını personel beden profillerine göre hesaplar. Ürünün "Beden Tipi" alanı, hangi beden profiliyle eşleşeceğini belirler.</p>
          </div>

          <div>
            <p className="font-semibold text-slate-900">Satın Alma</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li><span className="font-medium">Yeni Talep</span> → İhtiyaç Duyan Bölüm + Kategori + kalemleri gir (ya da Dashboard'dan "Talep Aç" ile ön-dolu gelir).</li>
              <li>Talep onay zincirinden geçer: İdari İşler → Müdür Yrd. → Müdür → Satın Alma.</li>
              <li>Onaylanınca: Sipariş Açıldı → Termin Girildi → Teslim Alındı → Stoğa İşlendi.</li>
            </ol>
            <p className="mt-1 text-rose-700"><span className="font-medium">Dikkat:</span> Talebi açan kişi/bölüm oturumdan gelir; "İhtiyaç Duyan Bölüm" ise malzemenin hangi bölüm için istendiğidir. Her aşamada ilgili kişilere bildirim gider.</p>
          </div>

          <div>
            <p className="font-semibold text-slate-900">Parametreler</p>
            <p className="text-slate-600">Kategoriler ve KKD yenileme periyotları gibi tanımlar buradan yönetilir. Yeni ürün/talep formundaki kategori listesi buradan beslenir.</p>
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
            </ul>
            <p className="mt-1 text-slate-600">Hepsinde tarih aralığı filtresi + Excel dışa aktarım vardır.</p>
          </div>

          <div className="rounded-xl border-t bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">Tipik günlük akış</p>
            <p className="mt-1 text-slate-600">Ürün/varyant tanımla → eşik ve maliyet gir → stok giriş/çıkış yap → kritik olanı Dashboard'da gör → <span className="font-medium">Talep Aç</span> veya mail ile bildir → Satın Alma'da süreci tamamla (onay → sipariş → teslim → stoğa işle) → sonuçları Raporlar'dan izle.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

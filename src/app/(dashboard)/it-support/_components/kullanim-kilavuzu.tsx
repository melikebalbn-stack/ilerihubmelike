"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

/**
 * IT Destek — Kullanım Kılavuzu modalı.
 *
 * İskelet ve renk kalıbı Maliyet Kılavuzu ile BİREBİR aynı
 * (cost-analysis/page.tsx): shadcn Dialog + `bg-{renk}-50 rounded-lg p-4
 * border-l-4 border-{renk}-500`, başlık `text-{renk}-800`, içerik
 * `text-{renk}-700 text-sm`. Renk sırası: blue → green → orange → purple.
 *
 * Maliyet'te modal sayfaya gömülüydü; burada ayrı bileşen — it-support/page.tsx
 * zaten 900+ satır ve kılavuz metni onu daha da şişirirdi.
 *
 * Görünürlük: kılavuz HERKES için (talep açan sıradan çalışan da okumalı),
 * bu yüzden çağıran tarafta helpdesk.admin koşulu YOK.
 */

/** Kategori → hangi durumda seçilir. Sıra, Ayarlar'daki sortOrder ile aynı. */
const KATEGORILER: { ad: string; aciklama: string }[] = [
  { ad: "Donanım Sorunları", aciklama: "bilgisayar, yazıcı, ekran, donanım" },
  { ad: "Yazılım Sorunları", aciklama: "program çalışmıyor, kurulum" },
  { ad: "Ağ ve Bağlantı", aciklama: "internet, bağlantı sorunu" },
  { ad: "Erişim Talepleri", aciklama: "şifre, yetki, erişim" },
  { ad: "IFS Eğitim Talebi", aciklama: "IFS eğitimi" },
  { ad: "IFS Problemleri", aciklama: "IFS hatası" },
  { ad: "MAS Problemleri", aciklama: "MAS sorunu" },
  { ad: "Grafik Tasarım İstekleri", aciklama: "afiş, logo, tasarım" },
  { ad: "Syteline Problemleri", aciklama: "Syteline sorunu" },
  { ad: "ILERIHub Problemleri", aciklama: "portal sorunu" },
  { ad: "IPro Problemleri", aciklama: "IPro sorunu" },
  { ad: "Diğer", aciklama: "hiçbirine uymayan" },
]

const DURUMLAR: { etiket: string; aciklama: string }[] = [
  { etiket: "Yeni / Atandı", aciklama: "Talebiniz alındı ve ilgili kişiye iletildi" },
  { etiket: "İşlemde", aciklama: "Üzerinde çalışılıyor" },
  { etiket: "Çözüldü / Kapatıldı", aciklama: "Tamamlandı" },
]

export function KullanimKilavuzu({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>IT Destek Talebi — Kullanım Kılavuzu</DialogTitle>
          <DialogDescription>Destek talebi açma ve takip rehberi</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 1 — Nasıl açılır */}
          <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
            <h3 className="font-semibold text-blue-800 mb-2">Destek Talebi Nasıl Açılır?</h3>
            <ol className="text-blue-700 text-sm space-y-1 list-decimal pl-5">
              <li>Sol menüden <span className="font-medium">IT Destek</span> sayfasını açın.</li>
              <li><span className="font-medium">Yeni Talep</span> butonuna tıklayın.</li>
              <li><span className="font-medium">Konu</span>, <span className="font-medium">Kategori</span> ve <span className="font-medium">Açıklama</span> alanlarını doldurun.</li>
              <li>Gerekiyorsa dosya veya fotoğraf ekleyin.</li>
              <li><span className="font-medium">Talebi Gönder</span> deyin.</li>
            </ol>
            <p className="text-blue-700 text-sm mt-2">
              Talebiniz, seçtiğiniz kategoriye göre ilgili kişiye veya ekibe otomatik iletilir.
            </p>
          </div>

          {/* 2 — Kategori seçimi */}
          <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500">
            <h3 className="font-semibold text-green-800 mb-2">Hangi Sorun Hangi Kategori?</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {KATEGORILER.map((k) => (
                <div key={k.ad} className="bg-white bg-opacity-60 p-2 rounded">
                  <span className="font-medium text-green-800">{k.ad}:</span>
                  <span className="text-green-700"> {k.aciklama}</span>
                </div>
              ))}
            </div>
            <p className="text-green-700 text-sm mt-2 font-medium">
              Doğru kategori = doğru kişiye ulaşır, daha hızlı çözülür.
            </p>
          </div>

          {/* 3 — Dosya ve fotoğraf */}
          <div className="bg-orange-50 rounded-lg p-4 border-l-4 border-orange-500">
            <h3 className="font-semibold text-orange-800 mb-2">Dosya ve Fotoğraf Ekleme</h3>
            <ul className="text-orange-700 text-sm space-y-1 list-disc pl-5">
              <li>Talep formundaki <span className="font-medium">Ekler</span> alanından fotoğraf veya belge ekleyebilirsiniz.</li>
              <li>Telefondan kamera ya da galeri, bilgisayardan dosya seçme ile.</li>
              <li>Birden fazla dosya eklenebilir (örneğin ekran görüntüsü + PDF).</li>
            </ul>
            <p className="text-orange-700 text-sm mt-2">
              <span className="font-medium">İpucu:</span> Hatanın ekran görüntüsü veya fotoğrafı,
              sorunun anlaşılmasını ve çözülmesini belirgin şekilde hızlandırır.
            </p>
          </div>

          {/* 4 — Takip ve ipuçları */}
          <div className="bg-purple-50 rounded-lg p-4 border-l-4 border-purple-500">
            <h3 className="font-semibold text-purple-800 mb-2">Talep Takibi ve İpuçları</h3>
            <p className="text-purple-700 text-sm mb-2">
              Açtığınız talepleri <span className="font-medium">Taleplerim</span> sekmesinden izleyebilirsiniz.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {DURUMLAR.map((d) => (
                <div key={d.etiket} className="bg-white bg-opacity-60 p-2 rounded">
                  <span className="font-medium text-purple-800">{d.etiket}:</span>
                  <span className="text-purple-700"> {d.aciklama}</span>
                </div>
              ))}
            </div>
            <ul className="text-purple-700 text-sm space-y-1 list-disc pl-5 mt-3">
              <li>Konuyu net yazın (&quot;Yazıcı çalışmıyor&quot; yerine &quot;2. kat yazıcı kağıt sıkıştırıyor&quot;).</li>
              <li>Ne yaptığınızı ve ne beklediğinizi anlatın.</li>
              <li>Mümkünse fotoğraf veya ekran görüntüsü ekleyin.</li>
              <li>Doğru kategoriyi seçin.</li>
              <li>Her talep tek bir sorun içersin — ayrı sorunlar için ayrı talep açın.</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Kapat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

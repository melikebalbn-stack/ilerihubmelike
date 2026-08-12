'use client'

import { BookOpen } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Props { open: boolean; onOpenChange: (open: boolean) => void }
const sections = [
  { title: 'Modülün amacı', content: <><p>Yıllık Çalışma Takvimi, yıl boyunca planlanan işleri, sorumluları, tarihleri ve gerçekleşme durumlarını tek ekranda takip etmenizi sağlar.</p><p>Kayıtlar oluşturulabilir, alt görevlerle izlenebilir, kanıtlarla desteklenebilir ve tamamlandıktan sonra sıralı onaya gönderilebilir.</p></> },
  { title: 'Ana ekran ve görünümler', content: <><p>Yıl oklarıyla görüntülemek istediğiniz yılı seçebilirsiniz.</p><ul><li><strong>Yıllık Görünüm:</strong> Kayıtları ana konu grupları ve aylar üzerinden gösterir.</li><li><strong>Liste Görünümü:</strong> Kayıtları ayrıntılı tablo halinde gösterir.</li><li><strong>Aylık Takvim:</strong> Seçili yıldaki kayıtları aylara göre gruplar.</li></ul><p>Her görünümde kayda tıklayarak detay panelini açabilirsiniz.</p></> },
  { title: 'Özet kartları', content: <p>Toplam Plan, Bu Ay, Yaklaşan, Geciken, Tamamlanan, Onay Bekleyen, Kritik ve İptal kartları seçili yılın genel durumunu gösterir. Kartlar filtrelerden etkilenmez.</p> },
  { title: 'Filtreler', content: <p>Ana konu, sorumlu, durum, periyot ve önceliğe göre kayıtları süzebilirsiniz. Filtreler yıllık, liste ve aylık görünümlere birlikte uygulanır.</p> },
  { title: 'Yeni kayıt oluşturma', content: <p>Yetkiniz varsa <strong>Yeni Kayıt</strong> düğmesiyle ana konu, süreç, departman, ana sorumlu, tarihler, periyot ve öncelik gibi temel bilgileri girerek kayıt oluşturabilirsiniz. Yeni kayıt Taslak durumunda başlar.</p> },
  { title: 'Kayıt detayı ve düzenleme', content: <><p>Bir kayda tıkladığınızda Temel Bilgiler, Checklist, Onay, Hatırlatma, Ekler ve Geçmiş sekmelerinden oluşan detay paneli açılır. Görüntüleme yetkisi olan kullanıcılar bilgileri okuyabilir; düzenleme yetkisi olanlar uygun alanları değiştirebilir. Başka bir kaynaktan yönetilen bazı alanlar salt okunur olabilir.</p><p>Panelin üstündeki <strong>Düzenle</strong> kayıt bilgilerini değiştirmek, <strong>Tamamla</strong> kaydı onaya göndermek, <strong>Tarih Değiştir</strong> tarih alanlarını düzenlemek için kullanılır. <strong>Diğer</strong> menüsünden, uygun yetkiniz varsa, kaydı iptal edebilirsiniz.</p><p>Ana sorumlu ayrı bir ekrandan değil, genel <strong>Düzenle</strong> formundaki Ana Sorumlu alanından değiştirilir.</p></> },
  { title: 'Kayıt iptali', content: <p>Yetkiniz varsa detay panelinden kayıt iptal edilebilir. Onay penceresi olmadan işlem yapılmaz. İptal kaydı fiziksel olarak silmez; geçmiş korunur.</p> },
  { title: 'Checklist kullanımı', content: <p>Checklist, işi küçük maddelere bölmek için kullanılır. Yetkili kullanıcılar madde ekleyebilir, düzenleyebilir, sorumlu atayabilir ve silebilir. Atanmış sorumlu kendi maddesinin tamamlanma durumunu güncelleyebilir.</p> },
  { title: 'Kanıt gerekli davranışı', content: <p>Kanıt gerekli olarak işaretlenen checklist maddesi, kayıtta ek bulunmadan tamamlanamaz. Zorunlu maddeler tamamlanmadan kayıt tamamlamaya gönderilemez. Ekler kayıt seviyesinde kanıt olarak değerlendirilir.</p> },
  { title: 'Tamamlamaya gönderme', content: <p>Ana sorumlu veya yetkili kullanıcı, zorunlu checklist ve kanıt koşulları sağlandığında kaydı <strong>Tamamlamaya Gönder</strong> ile onay sürecine iletebilir.</p> },
  { title: 'Onay ve revizyon', content: <p>Onay kademeleri önceden tanımlanır ve her kademe belirli bir kullanıcıya atanır. Adımlar sırayla ilerler; yalnız ilgili kademeye atanmış kullanıcı sırası geldiğinde karar verebilir. Revizyon istenirken gerekçe girilmesi zorunludur. Kayıt gerekli düzeltmeler yapıldıktan sonra yeniden gönderildiğinde yeni bir onay turu başlar ve tüm kademeler baştan karar verir. Tüm kademeler onayladığında kayıt Onaylandı durumuna geçer.</p> },
  { title: 'Onay kararını geri alma', content: <p>Onaylanmış veya revizyon istenmiş son karar, kısa bir gerekçe girilerek geri alınabilir. Bu işlemi yalnız kararı veren kişi veya yönetici yetkisine sahip kullanıcı yapabilir. Geri alma sonrasında kayıt yeniden onay bekleyen duruma döner.</p> },
  { title: 'Sonraki dönemi oluşturma', content: <p>Onaylanmış bir kayıtta, ana sorumlu veya yönetici için <strong>Sonraki Dönemi Oluştur</strong> seçeneği görünür. Ana konu, süreç, departman, öncelik, periyot, katılımcılar, bildirim kuralları ve tamamlanma bilgileri sıfırlanmış checklist yeni kayda kopyalanır; ekler, işlem geçmişi ve onay adımları kopyalanmaz. Düzenli periyotlarda tarihler bir sonraki aralığa ötelenir; belirli veya özel tarihli işlerde yeni kayıt tarihleri boş bir taslak olarak oluşturulur.</p> },
  { title: 'Hatırlatma', content: <p>Hatırlatma sekmesinde, uygun yetkiniz varsa, kayıt için bildirim kuralları ekleyebilir, mevcut kuralları düzenleyebilir veya silebilirsiniz. Bu işlemler ayrı bir yetkiye tabi olabileceği için ilgili seçenekler her kullanıcıda görünmeyebilir.</p> },
  { title: 'Ekler ve kanıtlar', content: <p>Yetkiniz varsa PDF, Word, Excel, görsel veya ZIP dosyası yükleyebilirsiniz. En fazla 15 MB dosya kabul edilir. Ekler listelenebilir, indirilebilir ve uygun yetkiyle silinebilir.</p> },
  { title: 'İşlem geçmişi', content: <p>Kayıt oluşturma, düzenleme, checklist, ek, iptal, onay, revizyon ve onay kararını geri alma gibi işlemler genel zaman çizelgesinde en yeniden eskiye gösterilir. Bildirim kuralı ekleme, güncelleme ve silme işlemleri ile varsa dış kaynaklı sistemlerden gelen kayıt oluşturma, güncelleme ve iptal işlemleri de geçmişte yer alır. Onay paneli ayrıca onay turlarının ayrıntısını sunar.</p> },
  { title: "Excel'e aktar", content: <p><strong>Excel&apos;e Aktar</strong> düğmesi ekranda aktif filtrelerle görünen kayıtları indirir. Seçili yıl ve güvenli, kullanıcıya yönelik alanlar dosyaya eklenir.</p> },
  { title: 'Butonlar neden görünmeyebilir?', content: <p>Modüldeki oluşturma, düzenleme, iptal, checklist, ek, tamamlama ve onay düğmeleri görev ve yetkinize göre gösterilir. Bir işlem düğmesini görmüyorsanız ilgili işlem için yetkiniz olmayabilir veya kayıt o işleme uygun durumda olmayabilir.</p> },
  { title: 'Henüz aktif olmayan özellikler', content: <p>Dış kaynak servis bağlantıları ve Outlook/Teams işlemleri henüz aktif değildir.</p> },
]

export function YillikTakvimKullanimKilavuzu({ open, onOpenChange }: Props) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader><DialogTitle className="flex items-center gap-2 text-[#1B4F72]"><BookOpen className="h-5 w-5" />Kullanım Kılavuzu</DialogTitle><DialogDescription>Yıllık Çalışma Takvimi ekranındaki güncel özellikler için kısa kullanım rehberi.</DialogDescription></DialogHeader>
      <Accordion type="multiple" className="space-y-2">
        {sections.map((section, index) => <AccordionItem key={section.title} value={`section-${index}`} className="rounded-lg border px-3"><AccordionTrigger className="text-[#1B4F72]">{section.title}</AccordionTrigger><AccordionContent className="space-y-2 text-muted-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">{section.content}</AccordionContent></AccordionItem>)}
      </Accordion>
      <DialogFooter><DialogClose asChild><Button type="button">Kapat</Button></DialogClose></DialogFooter>
    </DialogContent>
  </Dialog>
}

import { PrismaClient } from "../src/generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import * as dotenv from "dotenv"

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// ISO 27001:2022 Annex A Kontrolleri - Türkçe Açıklamalar
const CONTROL_DESCRIPTIONS_TR: Record<string, string> = {
  // 5. Organizasyonel Kontroller
  "5.1": "Bilgi güvenliği politikası ve konuya özel politikalar yönetim tarafından tanımlanmalı, onaylanmalı, yayınlanmalı, ilgili personel ve ilgili taraflara iletilmeli ve kabul ettirilmeli, planlı aralıklarla ve önemli değişiklikler olduğunda gözden geçirilmelidir.",
  "5.2": "Bilgi güvenliği rolleri ve sorumlulukları organizasyonun ihtiyaçlarına göre tanımlanmalı ve atanmalıdır.",
  "5.3": "Çakışan görevler ve çakışan sorumluluk alanları ayrılmalıdır.",
  "5.4": "Yönetim, tüm personelin bilgi güvenliğini, kuruluşun yerleşik bilgi güvenliği politikası, konuya özel politikaları ve prosedürlerine uygun olarak uygulamasını talep etmelidir.",
  "5.5": "Kuruluş, ilgili yetkililerle iletişim kurmalı ve sürdürmelidir.",
  "5.6": "Kuruluş, özel ilgi grupları veya diğer uzman güvenlik forumları ve profesyonel derneklerle iletişim kurmalı ve sürdürmelidir.",
  "5.7": "Bilgi güvenliği tehditleriyle ilgili bilgiler toplanmalı ve tehdit istihbaratı üretmek için analiz edilmelidir.",
  "5.8": "Bilgi güvenliği, proje yönetimine entegre edilmelidir.",
  "5.9": "Sahipleri dahil olmak üzere bilgi ve diğer ilişkili varlıkların bir envanteri geliştirilmeli ve sürdürülmelidir.",
  "5.10": "Bilgi ve diğer ilişkili varlıkların kabul edilebilir kullanımı ve işlenmesi için kurallar tanımlanmalı, belgelenmeli ve uygulanmalıdır.",
  "5.11": "Personel ve diğer ilgili taraflar, istihdamın veya sözleşmenin sonlandırılması veya değiştirilmesi üzerine ellerindeki tüm kuruluş varlıklarını iade etmelidir.",
  "5.12": "Bilgi, kuruluşun bilgi güvenliği ihtiyaçlarına göre gizlilik, bütünlük, erişilebilirlik gereksinimlerine ve ilgili taraf gereksinimlerine uygun olarak sınıflandırılmalıdır.",
  "5.13": "Kuruluş tarafından benimsenen bilgi sınıflandırma şemasına uygun olarak uygun bir bilgi etiketleme prosedürleri seti geliştirilmeli ve uygulanmalıdır.",
  "5.14": "Her türlü transfer tesisi için bilgi transfer kuralları, prosedürleri veya anlaşmaları olmalıdır.",
  "5.15": "Bilgi ve diğer ilişkili varlıklara fiziksel ve mantıksal erişimi kontrol etmek için iş ve bilgi güvenliği gereksinimlerine dayalı kurallar oluşturulmalı ve uygulanmalıdır.",
  "5.16": "Kimliklerin tüm yaşam döngüsü yönetilmelidir.",
  "5.17": "Kimlik doğrulama bilgilerinin tahsisi bir yönetim süreci tarafından kontrol edilmeli ve kullanıcılara sorumluluklarını tavsiye eden bilgi dahil edilmelidir.",
  "5.18": "Bilgi ve diğer ilişkili varlıklara erişim hakları, tanımlanmış konuya özel politika ve erişim kontrol kurallarına uygun olarak sağlanmalı, gözden geçirilmeli, değiştirilmeli ve kaldırılmalıdır.",
  "5.19": "Tedarikçi ilişkilerinde yer alan bilgi güvenliği risklerini azaltmak için süreçler ve prosedürler tanımlanmalı ve uygulanmalıdır.",
  "5.20": "Her tedarikçiyle, tedarikçi ilişkisi türüne göre ilgili bilgi güvenliği gereksinimleri oluşturulmalı ve üzerinde anlaşılmalıdır.",
  "5.21": "ICT ürün ve hizmetlerinin tedarik zincirinde yer alan bilgi güvenliği risklerini yönetmek için süreçler ve prosedürler tanımlanmalı ve uygulanmalıdır.",
  "5.22": "Kuruluş, tedarikçi bilgi güvenliği uygulamalarını ve hizmet sunumunu düzenli olarak izlemeli, gözden geçirmeli, değerlendirmeli ve değişiklikleri yönetmelidir.",
  "5.23": "Bulut hizmetlerinin edinilmesi, kullanımı, yönetimi ve çıkışı için süreçler, kuruluşun bilgi güvenliği gereksinimlerine uygun olarak oluşturulmalıdır.",
  "5.24": "Kuruluş, bilgi güvenliği olay yönetimi için yönetim sorumluluklarının ve prosedürlerinin tanımlanmasıyla olay yönetimine hazırlanmalı ve planlamalıdır.",
  "5.25": "Kuruluş, bilgi güvenliği olaylarını değerlendirmeli ve bunların bilgi güvenliği olayları olarak sınıflandırılıp sınıflandırılmayacağına karar vermelidir.",
  "5.26": "Bilgi güvenliği olaylarına, belgelenmiş prosedürlere uygun olarak müdahale edilmelidir.",
  "5.27": "Bilgi güvenliği olaylarından elde edilen bilgi, kuruluşun bilgi güvenliği kontrollerini güçlendirmek ve iyileştirmek için kullanılmalıdır.",
  "5.28": "Kuruluş, bilgi güvenliği olaylarıyla ilgili kanıtların tanımlanması, toplanması, edinilmesi ve muhafazası için prosedürler oluşturmalı ve uygulamalıdır.",
  "5.29": "Kuruluş, kesinti sırasında uygun düzeyde bilgi güvenliğini sürdürmek için nasıl hareket edeceğini planlamalıdır.",
  "5.30": "İş sürekliliği amaçlarını ve ICT süreklilik gereksinimlerini karşılamak için ICT hazırlığı planlanmalı, uygulanmalı, sürdürülmeli ve test edilmelidir.",
  "5.31": "Bilgi güvenliğiyle ilgili yasal, düzenleyici ve sözleşmesel gereksinimler ve kuruluşun bunları karşılama yaklaşımı tanımlanmalı, belgelenmeli ve güncel tutulmalıdır.",
  "5.32": "Kuruluş, fikri mülkiyet haklarının korunması için uygun prosedürler uygulamalıdır.",
  "5.33": "Kayıtlar, yasal, düzenleyici, sözleşmesel ve iş gereksinimlerine uygun olarak kayıp, imha, tahrifat, yetkisiz erişim ve yetkisiz yayınlamaya karşı korunmalıdır.",
  "5.34": "Kuruluş, gizlilik ve kişisel bilgilerin korunması gereksinimlerini, yürürlükteki mevzuat ve düzenlemelere ve sözleşme gereksinimlerine uygun olarak tanımlamalı ve karşılamalıdır.",
  "5.35": "Kuruluşun bilgi güvenliği yönetimi yaklaşımı ve uygulaması, bağımsız olarak planlı aralıklarla veya önemli değişiklikler olduğunda gözden geçirilmelidir.",
  "5.36": "Bilgi güvenliği politikalarına, konuya özel politikalara, kurallara ve standartlara uyum düzenli olarak gözden geçirilmelidir.",
  "5.37": "Bilgi işleme tesisleri ve bilgi güvenliği için işletim prosedürleri belgelenmeli ve ihtiyacı olan personelin kullanımına sunulmalıdır.",

  // 6. İnsan Kaynakları Kontrolleri
  "6.1": "Tüm istihdam adayları için özgeçmiş doğrulamaları, yürürlükteki yasa, düzenleme ve etik kurallarına uygun olarak ve erişecekleri bilginin sınıflandırmasına, iş gereksinimlerine ve algılanan risklere orantılı olarak gerçekleştirilmelidir.",
  "6.2": "İstihdam sözleşmeleri, personelin ve kuruluşun bilgi güvenliği sorumluluklarını belirtmelidir.",
  "6.3": "Kuruluş personeli ve ilgili taraflar, işlerine uygun bilgi güvenliği farkındalık eğitimi ve bilgi güvenliği politikaları, konuya özel politikalar ve prosedürler hakkında düzenli güncellemeler almalıdır.",
  "6.4": "Bilgi güvenliği politikası ihlalleri yapan personel ve diğer ilgili taraflara karşı eylem başlatmak için disiplin süreci resmileştirilmeli ve iletilmelidir.",
  "6.5": "Bilgi güvenliği sorumlulukları ve görevleri, istihdam sonlandırıldıktan veya değiştirildikten sonra geçerli kalmalı, personele ve diğer ilgili taraflara iletilmeli ve uygulanmalıdır.",
  "6.6": "Bilginin korunması ihtiyaçlarını yansıtan gizlilik veya ifşa etmeme anlaşmaları tanımlanmalı, belgelenmeli, düzenli olarak gözden geçirilmeli ve personel ve diğer ilgili taraflar tarafından imzalanmalıdır.",
  "6.7": "Personel kuruluş tesisleri dışında uzaktan çalıştığında bilgiyi korumak için güvenlik önlemleri uygulanmalıdır.",
  "6.8": "Kuruluş, personelin gözlemlenen veya şüphelenilen bilgi güvenliği olaylarını uygun kanallar aracılığıyla zamanında bildirmesi için bir mekanizma sağlamalıdır.",

  // 7. Fiziksel Kontroller
  "7.1": "Güvenlik çevreleri, hassas veya kritik bilgi ve diğer ilişkili varlıkları içeren alanları korumak için tanımlanmalı ve kullanılmalıdır.",
  "7.2": "Güvenli alanlar, yalnızca yetkili personelin erişebilmesini sağlamak için uygun giriş kontrolleri ve erişim noktalarıyla korunmalıdır.",
  "7.3": "Ofisler, odalar ve tesisler için fiziksel güvenlik tasarlanmalı ve uygulanmalıdır.",
  "7.4": "Tesisler, yetkisiz fiziksel erişim için sürekli olarak izlenmelidir.",
  "7.5": "Yangın, su baskını, deprem, bomba ve benzeri doğal ve insan kaynaklı fiziksel ve çevresel tehditlere karşı koruma tasarlanmalı ve uygulanmalıdır.",
  "7.6": "Güvenli alanlarda çalışma için güvenlik önlemleri tasarlanmalı ve uygulanmalıdır.",
  "7.7": "Bilgi ve diğer ilişkili varlıkların yetkisiz erişime veya kaybına maruz kalma risklerini azaltmak için masalardaki kağıtlar ve çıkarılabilir depolama ortamları ve bilgi işleme tesislerindeki ekranlar için temiz masa ve temiz ekran kuralları tanımlanmalı ve uygun şekilde uygulanmalıdır.",
  "7.8": "Ekipman, çevresel tehditler ve tehlikelerden ve yetkisiz erişim fırsatlarından kaynaklanan riskleri azaltmak için güvenli bir şekilde yerleştirilmeli ve korunmalıdır.",
  "7.9": "Tesis dışı varlıklar korunmalıdır.",
  "7.10": "Depolama ortamı, kuruluşun sınıflandırma şeması ve kullanım gereksinimlerine uygun olarak edinme, kullanım, taşıma ve imha boyunca yaşam döngüsü boyunca yönetilmelidir.",
  "7.11": "Bilgi işleme tesisleri, destekleyici hizmetlerdeki arızalardan kaynaklanan güç kesintileri ve diğer kesintilere karşı korunmalıdır.",
  "7.12": "Güç ve telekomünikasyon kabloları dahil olmak üzere veri taşıyan veya bilgi hizmetlerini destekleyen kablolar, dinleme, parazit veya hasara karşı korunmalıdır.",
  "7.13": "Ekipman, kullanılabilirliğini, bütünlüğünü ve bilgi güvenliğini sağlamak için doğru şekilde bakımı yapılmalıdır.",
  "7.14": "Depolama ortamı içeren ekipman parçaları, imha veya yeniden kullanımdan önce hassas verilerin ve lisanslı yazılımların kaldırıldığından veya güvenli bir şekilde üzerine yazıldığından emin olmak için doğrulanmalıdır.",

  // 8. Teknolojik Kontroller
  "8.1": "Kullanıcı uç nokta cihazlarında depolanan, işlenen veya bu cihazlar aracılığıyla erişilebilen bilgiler korunmalıdır.",
  "8.2": "Ayrıcalıklı erişim haklarının tahsisi ve kullanımı kısıtlanmalı ve yönetilmelidir.",
  "8.3": "Bilgiye ve diğer ilişkili varlıklara erişim, erişim kontrolüne ilişkin yerleşik konuya özel politikaya uygun olarak kısıtlanmalıdır.",
  "8.4": "Kaynak koda, geliştirme araçlarına ve yazılım kütüphanelerine okuma ve yazma erişimi uygun şekilde yönetilmelidir.",
  "8.5": "Güvenli kimlik doğrulama teknolojileri ve prosedürleri, bilgi erişim kısıtlamasına ve erişim kontrolüne ilişkin konuya özel politikaya dayalı olarak uygulanmalıdır.",
  "8.6": "Kaynakların kullanımı, mevcut ve beklenen kapasite gereksinimlerine uygun olarak izlenmeli ve ayarlanmalıdır.",
  "8.7": "Bilgi ve diğer ilişkili varlıklar, kötü amaçlı yazılımlara karşı korunmalıdır.",
  "8.8": "Kuruluş tarafından kullanılan bilgi sistemlerinin teknik açıklıkları hakkında bilgi edinilmeli, kuruluşun bu tür açıklıklara maruziyeti değerlendirilmeli ve uygun önlemler alınmalıdır.",
  "8.9": "Donanım, yazılım, hizmetler ve ağların güvenlik ayarları dahil yapılandırmaları oluşturulmalı, belgelenmeli, uygulanmalı, izlenmeli ve gözden geçirilmelidir.",
  "8.10": "Bilgi işleme tesisleri, ortam ve yazılımlarda depolanan bilgiler, artık gerekmediğinde silinmelidir.",
  "8.11": "Veri maskeleme, kuruluşun erişim kontrolüne ilişkin konuya özel politikasına ve diğer ilgili konuya özel politikalara ve iş gereksinimlerine uygun olarak, yürürlükteki mevzuatı dikkate alarak kullanılmalıdır.",
  "8.12": "Veri sızıntısı önleme önlemleri, hassas bilgileri işleyen, depolayan veya ileten sistemlere, ağlara ve diğer cihazlara uygulanmalıdır.",
  "8.13": "Bilgi, yazılım ve sistemlerin yedek kopyaları, üzerinde anlaşılmış yedekleme politikasına uygun olarak saklanmalı ve düzenli olarak test edilmelidir.",
  "8.14": "Bilgi işleme tesisleri, kullanılabilirlik gereksinimlerini karşılayacak şekilde yeterli yedeklilikle uygulanmalıdır.",
  "8.15": "Günlükler, faaliyetleri, istisnaları, hataları ve diğer ilgili olayları kaydedecek şekilde üretilmeli, saklanmalı, korunmalı ve analiz edilmelidir.",
  "8.16": "Ağlar, sistemler ve uygulamalar olağandışı davranışlar için izlenmeli ve potansiyel bilgi güvenliği olaylarını değerlendirmek için uygun eylemler alınmalıdır.",
  "8.17": "Kuruluş tarafından kullanılan bilgi işleme sistemlerinin saatleri, onaylanmış zaman kaynaklarıyla senkronize edilmelidir.",
  "8.18": "Sistem ve uygulama kontrollerini geçersiz kılabilecek yardımcı programların kullanımı kısıtlanmalı ve sıkı bir şekilde kontrol edilmelidir.",
  "8.19": "Operasyonel sistemlere yazılım kurmak için prosedürler ve önlemler güvenli bir şekilde uygulanmalıdır.",
  "8.20": "Ağlar ve ağ cihazları, sistemlerdeki ve uygulamalardaki bilgileri korumak için güvence altına alınmalı, yönetilmeli ve kontrol edilmelidir.",
  "8.21": "Ağ hizmetleri için güvenlik mekanizmaları, hizmet seviyeleri ve yönetim gereksinimleri tanımlanmalı, uygulanmalı ve izlenmelidir.",
  "8.22": "Bilgi hizmetleri, kullanıcıları ve bilgi sistemleri grupları, kuruluşun ağlarında ayrılmalıdır.",
  "8.23": "Kötü amaçlı web içeriğine maruziyeti azaltmak için harici web sitelerine erişim yönetilmelidir.",
  "8.24": "Bilgi koruma için kriptografik kullanıma ilişkin kurallar, kriptografik anahtarların yönetimi dahil olmak üzere tanımlanmalı ve uygulanmalıdır.",
  "8.25": "Yazılım ve sistemlerin güvenli bir şekilde geliştirilmesi için kurallar oluşturulmalı ve uygulanmalıdır.",
  "8.26": "Bilgi güvenliği gereksinimleri, uygulamaları geliştirirken veya edinirken tanımlanmalı, belirtilmeli ve onaylanmalıdır.",
  "8.27": "Güvenli sistemler mühendisliği için ilkeler oluşturulmalı, belgelenmeli, sürdürülmeli ve tüm bilgi sistemi geliştirme faaliyetlerine uygulanmalıdır.",
  "8.28": "Yazılım geliştirme için güvenli kodlama ilkeleri uygulanmalıdır.",
  "8.29": "Güvenlik testi süreçleri, geliştirme yaşam döngüsü boyunca tanımlanmalı ve uygulanmalıdır.",
  "8.30": "Kuruluş, dış kaynaklı sistem geliştirme faaliyetlerini yönlendirmeli, izlemeli ve gözden geçirmelidir.",
  "8.31": "Geliştirme, test ve üretim ortamları ayrılmalı ve güvence altına alınmalıdır.",
  "8.32": "Bilgi işleme tesislerinde ve sistemlerinde değişiklikler, değişiklik yönetimi prosedürlerine tabi olmalıdır.",
  "8.33": "Test bilgisi uygun şekilde seçilmeli, korunmalı ve yönetilmelidir.",
  "8.34": "Operasyonel sistemleri içeren denetim testleri ve diğer güvence faaliyetleri, operasyonel sistemler ve iş süreçleri üzerindeki etkiyi en aza indirmek için planlanmalı ve denetçi ile yönetim arasında kararlaştırılmalıdır.",
}

async function main() {
  console.log("Türkçe açıklamalar güncelleniyor...")

  let updated = 0
  let errors: string[] = []

  for (const [controlId, descriptionTr] of Object.entries(CONTROL_DESCRIPTIONS_TR)) {
    try {
      // Database uses "A.X.Y" format
      const dbControlId = `A.${controlId}`
      const result = await prisma.iso27001Control.updateMany({
        where: { controlId: dbControlId },
        data: { descriptionTr },
      })
      if (result.count > 0) {
        updated++
        console.log(`✓ ${controlId} güncellendi`)
      } else {
        console.log(`○ ${controlId} bulunamadı`)
      }
    } catch (err) {
      errors.push(`${controlId}: ${err}`)
      console.error(`✗ ${controlId} hata:`, err)
    }
  }

  console.log(`\n${updated} kontrol açıklaması güncellendi`)
  if (errors.length > 0) {
    console.error(`${errors.length} hata oluştu`)
  }

  await prisma.$disconnect()
}

main()

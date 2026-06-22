import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/auth/require-user"

// Türkçe açıklamalar
const TURKISH_DESCRIPTIONS: Record<string, string> = {
  "A.5.1": "Bilgi güvenliği politikası ve konuya özgü politikalar tanımlanmalı, yönetim tarafından onaylanmalı, yayımlanmalı, ilgili personel ve ilgili taraflara iletilmeli ve kabul ettirilmeli, planlanan aralıklarla ve önemli değişiklikler olduğunda gözden geçirilmelidir.",
  "A.5.2": "Bilgi güvenliği rol ve sorumlulukları, kuruluşun ihtiyaçlarına göre tanımlanmalı ve atanmalıdır.",
  "A.5.3": "Çakışan görevler ve çakışan sorumluluk alanları birbirinden ayrılmalıdır.",
  "A.5.4": "Yönetim, tüm personelin kuruluşun oluşturulmuş bilgi güvenliği politikası, konuya özgü politikalar ve prosedürlerine uygun olarak bilgi güvenliğini uygulamasını sağlamalıdır.",
  "A.5.5": "Kuruluş, ilgili yetkililerle iletişim kurmalı ve sürdürmelidir.",
  "A.5.6": "Kuruluş, özel ilgi grupları veya diğer uzman güvenlik forumları ve profesyonel birliklerle iletişim kurmalı ve sürdürmelidir.",
  "A.5.7": "Bilgi güvenliği tehditlerini ilişkin bilgiler, tehdit istihbaratı üretmek için toplanmalı ve analiz edilmelidir.",
  "A.5.8": "Bilgi güvenliği, proje yönetimine entegre edilmelidir.",
  "A.5.9": "Sahiplerini de içeren bilgi ve ilişkili varlıkların envanteri geliştirilmeli ve sürdürülmelidir.",
  "A.5.10": "Bilgi ve ilişkili varlıkların kabul edilebilir kullanımı için kurallar ve işleme prosedürleri belirlenmeli, dokümante edilmeli ve uygulanmalıdır.",
  "A.5.11": "Personel ve diğer ilgili taraflar, istihdam, sözleşme veya anlaşmalarının değişmesi veya sona ermesi durumunda, ellerindeki tüm kuruluş varlıklarını iade etmelidir.",
  "A.5.12": "Bilgi, gizlilik, bütünlük, erişilebilirlik ve ilgili taraf gereksinimlerine dayalı olarak kuruluşun bilgi güvenliği ihtiyaçlarına göre sınıflandırılmalıdır.",
  "A.5.13": "Kuruluş tarafından benimsenen bilgi sınıflandırma şemasına uygun olarak bilgi etiketleme için uygun prosedürler geliştirilmeli ve uygulanmalıdır.",
  "A.5.14": "Kuruluş içinde ve kuruluş ile diğer taraflar arasındaki her tür transfer olanağı için bilgi transferi kuralları, prosedürleri veya anlaşmaları mevcut olmalıdır.",
  "A.5.15": "Bilgi ve ilişkili varlıklara fiziksel ve mantıksal erişimi kontrol etmek için kurallar, iş ve bilgi güvenliği gereksinimlerine dayalı olarak oluşturulmalı ve uygulanmalıdır.",
  "A.5.16": "Kimliklerin tam yaşam döngüsü yönetilmelidir.",
  "A.5.17": "Kimlik doğrulama bilgilerinin tahsisi ve yönetimi, personele kimlik doğrulama bilgilerinin uygun kullanımı konusunda tavsiyeleri de içeren bir yönetim süreci ile kontrol edilmelidir.",
  "A.5.18": "Bilgi ve ilişkili varlıklara erişim hakları, kuruluşun erişim kontrolü konuya özgü politikası ve kurallarına uygun olarak sağlanmalı, gözden geçirilmeli, değiştirilmeli ve kaldırılmalıdır.",
  "A.5.19": "Tedarikçi ürün veya hizmetlerinin kullanımıyla ilişkili bilgi güvenliği risklerini yönetmek için süreçler ve prosedürler tanımlanmalı ve uygulanmalıdır.",
  "A.5.20": "İlgili bilgi güvenliği gereksinimleri, tedarikçi ilişkisinin türüne göre her tedarikçi ile oluşturulmalı ve üzerinde anlaşılmalıdır.",
  "A.5.21": "BİT ürün ve hizmetleri tedarik zinciriyle ilişkili bilgi güvenliği risklerini yönetmek için süreçler ve prosedürler tanımlanmalı ve uygulanmalıdır.",
  "A.5.22": "Kuruluş, tedarikçi bilgi güvenliği uygulamaları ve hizmet sunumundaki değişiklikleri düzenli olarak izlemeli, gözden geçirmeli, değerlendirmeli ve yönetmelidir.",
  "A.5.23": "Bulut hizmetlerinin edinimi, kullanımı, yönetimi ve çıkışı için süreçler, kuruluşun bilgi güvenliği gereksinimlerine uygun olarak oluşturulmalıdır.",
  "A.5.24": "Kuruluş, bilgi güvenliği olay yönetimi süreçlerini, rol ve sorumluluklarını tanımlayarak, oluşturarak ve ileterek bilgi güvenliği olaylarını yönetmeye planlamalı ve hazırlanmalıdır.",
  "A.5.25": "Kuruluş, bilgi güvenliği olaylarını değerlendirmeli ve bunların bilgi güvenliği olayı olarak kategorize edilip edilmeyeceğine karar vermelidir.",
  "A.5.26": "Bilgi güvenliği olaylarına dokümante edilmiş prosedürlere uygun olarak müdahale edilmelidir.",
  "A.5.27": "Bilgi güvenliği olaylarından elde edilen bilgi, bilgi güvenliği kontrollerini güçlendirmek ve iyileştirmek için kullanılmalıdır.",
  "A.5.28": "Kuruluş, bilgi güvenliği olaylarıyla ilgili kanıtların belirlenmesi, toplanması, elde edilmesi ve korunması için prosedürler oluşturmalı ve uygulamalıdır.",
  "A.5.29": "Kuruluş, kesinti sırasında bilgi güvenliğini uygun bir düzeyde nasıl sürdüreceğini planlamalıdır.",
  "A.5.30": "BİT hazırlığı, iş sürekliliği hedefleri ve BİT süreklilik gereksinimlerine dayalı olarak planlanmalı, uygulanmalı, sürdürülmeli ve test edilmelidir.",
  "A.5.31": "Bilgi güvenliğiyle ilgili yasal, mevzuat, düzenleyici ve sözleşmesel gereksinimler ve kuruluşun bu gereksinimleri karşılama yaklaşımı belirlenmeli, dokümante edilmeli ve güncel tutulmalıdır.",
  "A.5.32": "Kuruluş, fikri mülkiyet haklarını korumak için uygun prosedürler uygulamalıdır.",
  "A.5.33": "Kayıtlar; kayıp, imha, tahrifat, yetkisiz erişim ve yetkisiz açıklamaya karşı korunmalıdır.",
  "A.5.34": "Kuruluş, yürürlükteki yasa ve düzenlemeler ile sözleşmesel gereksinimlere göre gizliliğin korunması ve kişisel verilerin korunmasına ilişkin gereksinimleri belirlenmeli ve karşılamalıdır.",
  "A.5.35": "Kuruluşun bilgi güvenliğini yönetme yaklaşımı ve insan, süreç ve teknolojileri içeren uygulaması, planlanan aralıklarla veya önemli değişiklikler olduğunda bağımsız olarak gözden geçirilmelidir.",
  "A.5.36": "Kuruluşun bilgi güvenliği politikası, konuya özgü politikalar, kurallar ve standartlara uyumluluk düzenli olarak gözden geçirilmelidir.",
  "A.5.37": "Bilgi işleme tesisleri için işletim prosedürleri dokümante edilmeli ve ihtiyaç duyan personele sunulmalıdır.",
  "A.6.1": "Personel olmak için tüm adaylar üzerinde geçmiş doğrulama kontrolleri, kuruluşa katılmadan önce ve devam eden bir şekilde, yürürlükteki yasalar, düzenlemeler ve etik göz önünde bulundurularak ve iş gereksinimleri, erişilecek bilginin sınıflandırması ve algılanan risklerle orantılı olarak yapılmalıdır.",
  "A.6.2": "İstihdam sözleşmeleri, personelin ve kuruluşun bilgi güvenliği sorumluluklarını belirtmelidir.",
  "A.6.3": "Kuruluş personeli ve ilgili taraflar, iş fonksiyonlarına uygun olarak uygun bilgi güvenliği farkındalık, eğitim ve öğretimi ile kuruluşun bilgi güvenliği politikası, konuya özgü politikalar ve prosedürler hakkında düzenli güncellemeler almalıdır.",
  "A.6.4": "Bilgi güvenliği politikası ihlali gerçekleştiren personel ve diğer ilgili taraflara karşı önlem almak için disiplin süreci resmileştirilmeli ve iletilmelidir.",
  "A.6.5": "İşten ayrılma veya iş değişikliğinden sonra geçerli kalan bilgi güvenliği sorumlulukları ve görevleri tanımlanmalı, uygulanmalı ve ilgili personel ve diğer taraflara iletilmelidir.",
  "A.6.6": "Kuruluşun bilgi koruma ihtiyaçlarını yansıtan gizlilik veya ifşa etmeme anlaşmaları belirlenmeli, dokümante edilmeli, düzenli olarak gözden geçirilmeli ve personel ve diğer ilgili taraflar tarafından imzalanmalıdır.",
  "A.6.7": "Personel uzaktan çalışırken, kuruluşun tesisleri dışında erişilen, işlenen veya depolanan bilgiyi korumak için güvenlik önlemleri uygulanmalıdır.",
  "A.6.8": "Kuruluş, personelin gözlemlenen veya şüphelenilen bilgi güvenliği olaylarını uygun kanallar aracılığıyla zamanında bildirmesi için bir mekanizma sağlamalıdır.",
  "A.7.1": "Bilgi ve ilişkili varlıkları içeren alanları korumak için güvenlik çevreleri tanımlanmalı ve kullanılmalıdır.",
  "A.7.2": "Güvenli alanlar, uygun giriş kontrolleri ve erişim noktalarıyla korunmalıdır.",
  "A.7.3": "Ofis, oda ve tesisler için fiziksel güvenlik tasarlanmalı ve uygulanmalıdır.",
  "A.7.4": "Tesisler, yetkisiz fiziksel erişim için sürekli izlenmelidir.",
  "A.7.5": "Doğal afetler ve altyapıya yönelik kasıtlı veya kasıtsız fiziksel tehditler gibi fiziksel ve çevresel tehditlere karşı koruma tasarlanmalı ve uygulanmalıdır.",
  "A.7.6": "Güvenli alanlarda çalışmak için güvenlik önlemleri tasarlanmalı ve uygulanmalıdır.",
  "A.7.7": "Kağıtlar ve çıkarılabilir depolama ortamları için temiz masa kuralları ve bilgi işleme tesisleri için temiz ekran kuralları tanımlanmalı ve uygun şekilde uygulanmalıdır.",
  "A.7.8": "Ekipman güvenli bir şekilde yerleştirilmeli ve korunmalıdır.",
  "A.7.9": "Tesis dışı varlıklar korunmalıdır.",
  "A.7.10": "Depolama ortamları, kuruluşun sınıflandırma şeması ve kullanım gereksinimlerine uygun olarak edinme, kullanma, taşıma ve imha yaşam döngüsü boyunca yönetilmelidir.",
  "A.7.11": "Bilgi işleme tesisleri, güç kesintileri ve destekleyici altyapı hizmetlerindeki arızaların neden olduğu diğer kesintilere karşı korunmalıdır.",
  "A.7.12": "Güç, veri veya destekleyici bilgi hizmetlerini taşıyan kablolar dinleme, parazit veya hasara karşı korunmalıdır.",
  "A.7.13": "Ekipman, bilginin erişilebilirliği, bütünlüğü ve gizliliğini sağlamak için doğru şekilde bakılmalıdır.",
  "A.7.14": "Depolama ortamı içeren ekipman parçaları, imha veya yeniden kullanımdan önce hassas verilerin ve lisanslı yazılımların kaldırıldığının veya güvenli bir şekilde üzerine yazıldığının doğrulanması gerekir.",
  "A.8.1": "Kullanıcı uç nokta cihazlarında depolanan, işlenen veya erişilebilen bilgi korunmalıdır.",
  "A.8.2": "Ayrıcalıklı erişim haklarının tahsisi ve kullanımı kısıtlanmalı ve yönetilmelidir.",
  "A.8.3": "Bilgi ve ilişkili varlıklara erişim, erişim kontrolü konuya özgü politikasına uygun olarak kısıtlanmalıdır.",
  "A.8.4": "Kaynak kod, geliştirme araçları ve yazılım kütüphanelerine okuma ve yazma erişimi uygun şekilde yönetilmelidir.",
  "A.8.5": "Güvenli kimlik doğrulama teknolojileri ve prosedürleri, bilgi erişim kısıtlamaları ve erişim kontrolü konuya özgü politikasına dayalı olarak uygulanmalıdır.",
  "A.8.6": "Kaynakların kullanımı izlenmeli ve mevcut ve beklenen kapasite gereksinimlerine göre ayarlanmalıdır.",
  "A.8.7": "Zararlı yazılımlara karşı koruma uygulanmalı ve uygun kullanıcı farkındalığı ile desteklenmelidir.",
  "A.8.8": "Kullanımdaki bilgi sistemlerinin teknik açıklıkları hakkında bilgi edinilmeli, kuruluşun bu açıklıklara maruziyeti değerlendirilmeli ve uygun önlemler alınmalıdır.",
  "A.8.9": "Donanım, yazılım, hizmetler ve ağların güvenlik yapılandırmaları dahil yapılandırmaları oluşturulmalı, dokümante edilmeli, uygulanmalı, izlenmeli ve gözden geçirilmelidir.",
  "A.8.10": "Bilgi sistemlerinde, cihazlarda veya diğer depolama ortamlarında saklanan bilgi, artık gerekli olmadığında silinmelidir.",
  "A.8.11": "Veri maskeleme, kuruluşun erişim kontrolü konuya özgü politikası ve diğer ilgili politikalar ile iş gereksinimleri ve yürürlükteki mevzuat dikkate alınarak kullanılmalıdır.",
  "A.8.12": "Veri sızıntısı önleme tedbirleri, hassas bilgiyi işleyen, depolayan veya ileten sistemlere, ağlara ve diğer cihazlara uygulanmalıdır.",
  "A.8.13": "Bilgi, yazılım ve sistemlerin yedek kopyaları, yedekleme konuya özgü politikasına uygun olarak muhafaza edilmeli ve düzenli olarak test edilmelidir.",
  "A.8.14": "Bilgi işleme tesisleri, erişilebilirlik gereksinimlerini karşılamak için yeterli yedeklilik ile uygulanmalıdır.",
  "A.8.15": "Aktiviteleri, istisnaları, hataları ve diğer ilgili olayları kaydeden günlükler üretilmeli, depolanmalı, korunmalı ve analiz edilmelidir.",
  "A.8.16": "Ağlar, sistemler ve uygulamalar anormal davranışlar için izlenmeli ve potansiyel bilgi güvenliği olaylarını değerlendirmek için uygun önlemler alınmalıdır.",
  "A.8.17": "Kuruluş tarafından kullanılan bilgi işleme sistemlerinin saatleri, onaylı zaman kaynaklarına senkronize edilmelidir.",
  "A.8.18": "Sistem ve uygulama kontrollerini geçersiz kılabilen yardımcı programların kullanımı kısıtlanmalı ve sıkı şekilde kontrol edilmelidir.",
  "A.8.19": "İşletim sistemlerine yazılım kurulumunu güvenli bir şekilde yönetmek için prosedürler ve önlemler uygulanmalıdır.",
  "A.8.20": "Sistemler ve uygulamalardaki bilgiyi korumak için ağlar ve ağ cihazları güvenli hale getirilmeli, yönetilmeli ve kontrol edilmelidir.",
  "A.8.21": "Ağ hizmetlerinin güvenlik mekanizmaları, hizmet seviyeleri ve hizmet gereksinimleri belirlenmeli, uygulanmalı ve izlenmelidir.",
  "A.8.22": "Bilgi hizmetleri, kullanıcılar ve bilgi sistemleri grupları kuruluşun ağlarında ayrılmalıdır.",
  "A.8.23": "Zararlı içeriğe maruziyeti azaltmak için dış web sitelerine erişim yönetilmelidir.",
  "A.8.24": "Kriptografik anahtar yönetimi dahil olmak üzere kriptografinin etkin kullanımı için kurallar tanımlanmalı ve uygulanmalıdır.",
  "A.8.25": "Yazılım ve sistemlerin güvenli geliştirilmesi için kurallar oluşturulmalı ve uygulanmalıdır.",
  "A.8.26": "Uygulamalar geliştirilirken veya edinilirken bilgi güvenliği gereksinimleri belirlenmeli, tanımlanmalı ve onaylanmalıdır.",
  "A.8.27": "Güvenli sistemler mühendisliği ilkeleri oluşturulmalı, dokümante edilmeli, sürdürülmeli ve herhangi bir bilgi sistemi geliştirme faaliyetine uygulanmalıdır.",
  "A.8.28": "Güvenli kodlama ilkeleri yazılım geliştirmeye uygulanmalıdır.",
  "A.8.29": "Güvenlik test süreçleri geliştirme yaşam döngüsünde tanımlanmalı ve uygulanmalıdır.",
  "A.8.30": "Kuruluş, dış kaynaklı sistem geliştirme ile ilgili faaliyetleri yönlendirmeli, izlemeli ve gözden geçirmelidir.",
  "A.8.31": "Geliştirme, test ve üretim ortamları ayrılmalı ve güvenlik altına alınmalıdır.",
  "A.8.32": "Bilgi işleme tesisleri ve bilgi sistemlerindeki değişiklikler, değişiklik yönetimi prosedürlerine tabi olmalıdır.",
  "A.8.33": "Test bilgileri uygun şekilde seçilmeli, korunmalı ve yönetilmelidir.",
  "A.8.34": "İşletim sistemlerinin değerlendirmesini içeren denetim testleri ve diğer güvence faaliyetleri, test eden ve uygun yönetim arasında planlanmalı ve üzerinde anlaşılmalıdır.",
}

// Mevcut kontrollerin Türkçe açıklamalarını güncelle
export async function POST() {
  try {
    // PR-Y2.5-iso27001-A: requireUser → user.role
    const { user, error } = await requireUser()
    if (error) return error

    // Sadece yetkili roller
    if (!["ADMIN", "SUPER_ADMIN", "IT_MANAGER"].includes(user.role)) {
      return NextResponse.json({ error: "Bu islemi yapmaya yetkiniz yok" }, { status: 403 })
    }

    // Tüm kontrolleri al
    const controls = await prisma.iso27001Control.findMany({
      select: { id: true, controlId: true }
    })

    if (controls.length === 0) {
      return NextResponse.json({
        success: false,
        message: "Guncellenecek kontrol bulunamadi",
      })
    }

    // Her kontrol için Türkçe açıklamayı güncelle
    let updated = 0
    for (const control of controls) {
      const descriptionTr = TURKISH_DESCRIPTIONS[control.controlId]
      if (descriptionTr) {
        await prisma.iso27001Control.update({
          where: { id: control.id },
          data: { descriptionTr }
        })
        updated++
      }
    }

    return NextResponse.json({
      success: true,
      message: `${updated} kontrol icin Turkce aciklama guncellendi`,
      updated,
      total: controls.length,
    })
  } catch (error) {
    console.error("Guncelleme hatasi:", error)
    return NextResponse.json(
      { error: "Aciklamalar guncellenemedi" },
      { status: 500 }
    )
  }
}

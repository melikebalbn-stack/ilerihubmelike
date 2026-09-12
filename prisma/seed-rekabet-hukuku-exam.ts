/**
 * Rekabet Hukuku Farkındalık Eğitimi — Ölçme ve Değerlendirme Sınavı seed'i.
 * 15 soru, tek doğru cevap (SINGLE_CHOICE), eşit puan (1), 4 seçenek.
 *
 * Idempotent:
 *   - Kurs `ak_course_rekabet` upsert (varsa alanları güncellenir, içerik/atama silinmez).
 *   - Aynı başlıklı sınav varsa silinir, sonra yeniden kurulur
 *     (seed-akademi-exam.ts deseni). Sınav silinince sorular/seçenekler cascade.
 *
 * Çalıştırma:
 *   npx tsx prisma/seed-rekabet-hukuku-exam.ts
 */

import { PrismaClient, QuestionType } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const COURSE_ID = 'ak_course_rekabet';
const EXAM_TITLE =
  'Rekabet Hukuku Farkındalık Eğitimi — Ölçme ve Değerlendirme Sınavı';

// Seçenekler A-D sırasıyla; `correct` 0 tabanlı indeks (0=A … 3=D).
type Q = { question: string; options: string[]; correct: number; explanation: string };

const QUESTIONS: Q[] = [
  {
    question: 'Rakip firma gelecek ay yapacağımız fiyat artışını sorarsa ne yapmalıyım?',
    options: [
      'Bilgi vermemeli, görüşmeyi sonlandırmalı ve gerekli iç bildirimi yapmalıyım.',
      'Yaklaşık artış oranını sözlü olarak paylaşabilirim.',
      'Rakip de kendi bilgisini verirse karşılıklı paylaşabilirim.',
      'Yalnızca kesinleşmemiş fiyat bilgisini paylaşabilirim.',
    ],
    correct: 0,
    explanation:
      'Gelecekteki fiyat bilgisi rekabete duyarlı bilgidir; rakiple hiçbir biçimde paylaşılmaz, görüşme kesilir ve iç bildirim yapılır.',
  },
  {
    question: 'Rakiplerle müşteri veya bölge paylaşımı yapılabilir mi?',
    options: [
      'Evet, tarafların yazılı onayı varsa yapılabilir.',
      'Hayır.',
      'Sadece aynı bölgede faaliyet gösterilmiyorsa yapılabilir.',
      'Müşteriler bilgilendirilirse yapılabilir.',
    ],
    correct: 1,
    explanation:
      'Müşteri veya bölge paylaşımı, biçimi ne olursa olsun pazar paylaşımı anlaşmasıdır ve yasaktır.',
  },
  {
    question: 'Gelecekte uygulanacak fiyat politikası rakiple paylaşılabilir mi?',
    options: [
      'Evet, henüz yürürlüğe girmediyse paylaşılabilir.',
      'Sadece sektör toplantılarında paylaşılabilir.',
      'Hayır.',
      'Yaklaşık bilgi verilmesi mümkündür.',
    ],
    correct: 2,
    explanation:
      'Henüz uygulanmamış fiyat politikası en hassas bilgi türüdür; rakiple paylaşımı fiyat koordinasyonu riski doğurur.',
  },
  {
    question: 'Rakiple ihale öncesinde teklif fiyatlarını karşılaştırabilir miyiz?',
    options: [
      'Hayır.',
      'Evet, teklif verilmeden hemen önce karşılaştırılabilir.',
      'Sadece fiyat aralığı paylaşılabilir.',
      'İhale özel sektör ihalesiyse karşılaştırılabilir.',
    ],
    correct: 0,
    explanation:
      'İhale öncesi teklif karşılaştırması ihalede danışıklı hareket (bid rigging) sayılır; ihalenin türü fark etmez.',
  },
  {
    question:
      'Sektör toplantısında rakipler gelecek dönem fiyatlarını konuşmaya başlarsa sadece dinleyebilir miyim?',
    options: [
      'Evet, görüş bildirmediğim sürece dinleyebilirim.',
      'Evet, not almadığım sürece sorun olmaz.',
      'Hayır. Konuya katılmamalı, gerektiğinde toplantıdan ayrılmalı ve bildirim yapmalıyım.',
      'Toplantı resmi bir organizasyonsa dinleyebilirim.',
    ],
    correct: 2,
    explanation:
      'Sessiz kalmak da anlaşmaya katılım olarak değerlendirilebilir; itiraz edip ayrılmak ve kayda geçirmek gerekir.',
  },
  {
    question: 'Bir şirketin hâkim durumda olması tek başına yasak mıdır?',
    options: [
      'Evet, hâkim durumda olmak tek başına yasaktır.',
      'Hayır. Yasak olan hâkim durumun kötüye kullanılmasıdır.',
      'Sadece büyük şirketler açısından yasaktır.',
      'Pazar payı yüksekse otomatik olarak yasaktır.',
    ],
    correct: 1,
    explanation:
      'Rekabet hukuku hâkim durumu değil, hâkim durumun kötüye kullanılmasını yasaklar.',
  },
  {
    question:
      'Rakipler arasındaki hassas bilgi değişimi yalnızca doğrudan yapılırsa mı risklidir?',
    options: [
      'Evet, yalnızca iki rakibin doğrudan görüşmesi risklidir.',
      'Hayır. Dernek, oda veya üçüncü kişiler üzerinden dolaylı değişim de risk oluşturabilir.',
      'Yalnızca e-posta ile yapılırsa risklidir.',
      'Üçüncü kişiler üzerinden yapılan paylaşım risk oluşturmaz.',
    ],
    correct: 1,
    explanation:
      'Bilginin dernek, oda ya da aracı üzerinden dolaylı yoldan rakibe ulaşması da hassas bilgi değişimi sayılır.',
  },
  {
    question:
      'Rakip çalışan bana kendi firmasının gizli fiyat bilgisini kendiliğinden gönderirse kullanabilir miyim?',
    options: [
      'Evet, ben talep etmediysem kullanabilirim.',
      'Sadece şirket içinde kullanabilirim.',
      'Hayır. İletişimi ilerletmemeli ve şirket içindeki yetkili birime bildirmeliyim.',
      'Bilginin doğruluğunu teyit ettikten sonra kullanabilirim.',
    ],
    correct: 2,
    explanation:
      'Talep edilmeden gelen hassas bilgi de risk yaratır; kullanmadan iletişimi kesip yetkili birime bildirmek gerekir.',
  },
  {
    question:
      'Rekabet Kurumu yerinde incelemesi başladıktan sonra işle ilgili WhatsApp mesajlarını silebilir miyim?',
    options: [
      'Evet, kişisel telefondaysa silebilirim.',
      'Sadece eski mesajları silebilirim.',
      'Yöneticimin onayıyla silebilirim.',
      'Kesinlikle hayır.',
    ],
    correct: 3,
    explanation:
      'İnceleme sırasında veri silmek incelemenin engellenmesi sayılır ve ağır para cezası doğurur.',
  },
  {
    question:
      'İşle ilgili yazışma kişisel telefonda bulunuyorsa hiçbir şekilde incelenemez mi?',
    options: [
      'Evet, kişisel cihazlar hiçbir koşulda incelenemez.',
      'Hayır. İşle ilgili veri içeren cihazlar somut koşullarda inceleme kapsamına girebilir.',
      'Sadece şirket hattı varsa incelenebilir.',
      'Çalışan izin vermezse hiçbir şekilde incelenemez.',
    ],
    correct: 1,
    explanation:
      'İnceleme yetkisinin ölçütü cihazın sahibi değil, içerdiği verinin işle ilgili olmasıdır.',
  },
  {
    question:
      'Yerinde inceleme sırasında eski veya önemsiz olduğunu düşündüğüm işle ilgili dosyaları silebilir miyim?',
    options: [
      'Evet, iş açısından önemsizse silebilirim.',
      'Sadece yöneticime bilgi vererek silebilirim.',
      'Hayır. Hiçbir işle ilgili veri silinmemeli veya değiştirilmemelidir.',
      'Bir yıldan eski dosyalar silinebilir.',
    ],
    correct: 2,
    explanation:
      'Verinin önemine çalışan karar veremez; inceleme boyunca hiçbir işle ilgili veri silinmez ya da değiştirilmez.',
  },
  {
    question:
      'Rakip "Ben kendi fiyatımı söyledim, sen de yaklaşık bir rakam söyle" derse paylaşım yapılabilir mi?',
    options: [
      'Evet, yaklaşık rakam paylaşılabilir.',
      'Hayır.',
      'Sadece rakip önce bilgi verdiyse paylaşılabilir.',
      'Kesin fiyat yerine aralık verilebilir.',
    ],
    correct: 1,
    explanation:
      'Rakibin önce bilgi vermesi ya da rakamın yaklaşık olması ihlali ortadan kaldırmaz; fiyat bilgisi paylaşılmaz.',
  },
  {
    question:
      'Rakiple "Bu müşteriye sen girme, diğer müşteriye biz girmeyelim" şeklinde anlaşmak uygun mudur?',
    options: [
      'Evet, müşteriler farklı bölgelerdeyse uygundur.',
      'Sözlü anlaşma olduğu sürece uygundur.',
      'Hayır. Müşteri/pazar paylaşımı riski taşır.',
      'Yalnızca geçici süre için yapılabilir.',
    ],
    correct: 2,
    explanation:
      'Müşteri paylaşımı, sözlü veya geçici de olsa pazar paylaşımı anlaşmasıdır ve yasaktır.',
  },
  {
    question: 'Rekabet hukuku sadece satış ve üst yönetimin sorumluluğunda mıdır?',
    options: [
      'Evet, yalnızca satış ve üst yönetimi ilgilendirir.',
      'Hayır. Tüm çalışanların davranışları şirket açısından sonuç doğurabilir.',
      'Sadece müşteriyle temas eden çalışanları ilgilendirir.',
      'Yalnızca hukuk ve insan kaynakları birimlerinin sorumluluğundadır.',
    ],
    correct: 1,
    explanation:
      'Herhangi bir çalışanın davranışı şirkete isnat edilir; sorumluluk unvan ya da birimle sınırlı değildir.',
  },
  {
    question: 'Rekabet hukuku açısından tereddüt ettiğim bir durumda ne yapmalıyım?',
    options: [
      'Kendi değerlendirmeme göre işlemi sürdürmeliyim.',
      'Önce rakip firmaya danışmalıyım.',
      'İşlemi veya iletişimi ilerletmeden şirket içerisindeki yetkili birime danışmalıyım.',
      'İşlem tamamlandıktan sonra yöneticime bilgi vermeliyim.',
    ],
    correct: 2,
    explanation:
      'Tereddüt hâlinde doğru adım, işlemi durdurup önceden şirket içi yetkili birime danışmaktır.',
  },
];

async function main() {
  if (QUESTIONS.length !== 15) throw new Error(`15 soru bekleniyor, ${QUESTIONS.length} var`);
  for (const [i, q] of QUESTIONS.entries()) {
    if (q.options.length !== 4) throw new Error(`S${i + 1}: 4 seçenek bekleniyor`);
    if (q.correct < 0 || q.correct > 3) throw new Error(`S${i + 1}: correct indeksi hatalı`);
  }

  const course = await prisma.course.upsert({
    where: { id: COURSE_ID },
    update: {
      title: 'Rekabet Hukuku Farkındalık Eğitimi',
      category: 'Zorunlu',
      difficulty: 'BEGINNER',
      duration: 30,
      isIfs: false,
      isActive: true,
    },
    create: {
      id: COURSE_ID,
      title: 'Rekabet Hukuku Farkındalık Eğitimi',
      description:
        'Rakiplerle iletişim, hassas bilgi değişimi, pazar paylaşımı, hâkim durum ve Rekabet Kurumu yerinde incelemesi konularında her çalışanın bilmesi gereken temel kurallar.',
      category: 'Zorunlu',
      difficulty: 'BEGINNER',
      duration: 30,
      isIfs: false,
      isActive: true,
    },
  });
  console.log(`Kurs: ${course.id} — ${course.title}`);

  const silinen = await prisma.exam.deleteMany({ where: { title: EXAM_TITLE } });
  if (silinen.count) console.log(`Eski sınav silindi: ${silinen.count}`);

  const exam = await prisma.exam.create({
    data: {
      courseId: course.id,
      title: EXAM_TITLE,
      description:
        'Rekabet Hukuku Farkındalık Eğitimi ölçme ve değerlendirme sınavı — 15 çoktan seçmeli soru, tek doğru cevap, eşit puan. Geçme barajı %70.',
      passingScore: 70,
      timeLimit: 30,
      maxAttempts: 3,
      isActive: true,
      questions: {
        create: QUESTIONS.map((q, i) => ({
          type: QuestionType.SINGLE_CHOICE,
          isManualGraded: false,
          question: q.question,
          points: 1,
          order: i + 1,
          explanation: q.explanation,
          options: {
            create: q.options.map((text, j) => ({
              text,
              isCorrect: j === q.correct,
              order: j + 1,
            })),
          },
        })),
      },
    },
    include: { questions: { include: { options: true }, orderBy: { order: 'asc' } } },
  });

  const soru = exam.questions.length;
  const secenek = exam.questions.reduce((n, q) => n + q.options.length, 0);
  const dogru = exam.questions.reduce((n, q) => n + q.options.filter((o) => o.isCorrect).length, 0);
  console.log(`Sınav: ${exam.id} — ${exam.title}`);
  console.log(`  passingScore=${exam.passingScore} timeLimit=${exam.timeLimit} maxAttempts=${exam.maxAttempts} isActive=${exam.isActive}`);
  console.log(`  soru=${soru} seçenek=${secenek} doğru=${dogru} (beklenen 15/60/15)`);
  if (soru !== 15 || secenek !== 60 || dogru !== 15) throw new Error('Sayım beklenenle uyuşmuyor');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

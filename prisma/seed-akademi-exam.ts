/**
 * Sprint 2 örnek exam seed — 12 soru (6 otomatik + 6 manuel).
 * Idempotent: aynı başlıklı exam varsa siler, sonra ekler.
 *
 * Çalıştırma:
 *   npx tsx prisma/seed-akademi-exam.ts
 */

import { PrismaClient, QuestionType } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const EXAM_TITLE = 'BGYS Karışık Sınav (Sprint 2 Örnek)';

const auto = (type: QuestionType) => ({ type, isManualGraded: false });
const manual = (type: QuestionType) => ({ type, isManualGraded: true });

async function main() {
  const course = await prisma.course.findFirst({ orderBy: { id: 'asc' } });
  if (!course) {
    throw new Error('Hiç kurs yok. Önce: npx tsx prisma/seed-akademi.ts');
  }

  await prisma.exam.deleteMany({ where: { title: EXAM_TITLE } });

  const exam = await prisma.exam.create({
    data: {
      courseId: course.id,
      title: EXAM_TITLE,
      description:
        'ISO 27001 BGYS bilinçlendirme — 6 otomatik + 6 manuel soru karışık. Geçme barajı %70.',
      passingScore: 70,
      timeLimit: 30,
      maxAttempts: 3,
      isActive: true,
      questions: {
        create: [
          // === OTOMATİK (6) ===
          {
            ...auto(QuestionType.SINGLE_CHOICE),
            question: 'BGYS politikasına göre şifre kaç günde bir yenilenmelidir?',
            points: 1,
            order: 1,
            explanation: 'BGYS politikamıza göre şifreler 90 günde bir yenilenir.',
            options: {
              create: [
                { text: '30 gün', isCorrect: false, order: 1 },
                { text: '60 gün', isCorrect: false, order: 2 },
                { text: '90 gün', isCorrect: true, order: 3 },
                { text: '180 gün', isCorrect: false, order: 4 },
              ],
            },
          },
          {
            ...auto(QuestionType.SINGLE_CHOICE),
            question: 'Phishing e-postası şüphesi varsa ilk yapılması gereken nedir?',
            points: 1,
            order: 2,
            explanation:
              'Şüpheli e-postalar BT departmanına bildirilmeli, link veya ek tıklanmamalıdır.',
            options: {
              create: [
                { text: 'Hemen sil', isCorrect: false, order: 1 },
                { text: 'BT departmanına bildir', isCorrect: true, order: 2 },
                { text: 'Linkine tıklayıp kontrol et', isCorrect: false, order: 3 },
              ],
            },
          },
          {
            ...auto(QuestionType.MULTIPLE_CHOICE),
            question: 'Aşağıdakilerden hangileri kişisel veridir? (Birden fazla doğru cevap)',
            points: 2,
            order: 3,
            explanation:
              'KVKK kapsamında ad-soyad, TC kimlik no, IP adresi, e-posta gibi belirleyici bilgiler kişisel veridir.',
            options: {
              create: [
                { text: 'Ad-Soyad', isCorrect: true, order: 1 },
                { text: 'TC Kimlik Numarası', isCorrect: true, order: 2 },
                { text: 'Şirket adı', isCorrect: false, order: 3 },
                { text: 'IP adresi', isCorrect: true, order: 4 },
                { text: 'Hava durumu', isCorrect: false, order: 5 },
              ],
            },
          },
          {
            ...auto(QuestionType.MULTIPLE_CHOICE),
            question: 'Hangi durumlarda BT departmanına bilgi verilmelidir?',
            points: 2,
            order: 4,
            explanation:
              'Cihaz kaybı, şüpheli e-posta, yetkisiz erişim ve yazılım yüklemeleri BT departmanına raporlanmalıdır.',
            options: {
              create: [
                { text: 'Dizüstü bilgisayar kayıp/çalıntı', isCorrect: true, order: 1 },
                { text: 'Şüpheli e-posta alındığında', isCorrect: true, order: 2 },
                { text: 'Yeni yazılım kurulması gerektiğinde', isCorrect: true, order: 3 },
                { text: 'Sadece arkadaşa mesaj atarken', isCorrect: false, order: 4 },
                { text: 'Hesap şüpheli aktivite gördüğünde', isCorrect: true, order: 5 },
              ],
            },
          },
          {
            ...auto(QuestionType.TRUE_FALSE),
            question: 'Şirket bilgisayarına 3. parti yazılım kurulabilir.',
            points: 1,
            order: 5,
            explanation:
              'Yanlış. Şirket bilgisayarlarına yazılım kurma yetkisi sadece BT departmanındadır.',
            options: {
              create: [
                { text: 'Doğru', isCorrect: false, order: 1 },
                { text: 'Yanlış', isCorrect: true, order: 2 },
              ],
            },
          },
          {
            ...auto(QuestionType.TRUE_FALSE),
            question:
              'Şifrenizi takım arkadaşınızla paylaşabilirsiniz, eğer güvendiğiniz biriyse.',
            points: 1,
            order: 6,
            explanation: 'Yanlış. Şifre paylaşımı kesinlikle yasaktır.',
            options: {
              create: [
                { text: 'Doğru', isCorrect: false, order: 1 },
                { text: 'Yanlış', isCorrect: true, order: 2 },
              ],
            },
          },

          // === MANUEL (6) ===
          {
            ...manual(QuestionType.TEXT_SHORT),
            question: "KVKK'nın açılımı nedir?",
            points: 1,
            order: 7,
            explanation: 'Kişisel Verilerin Korunması Kanunu',
          },
          {
            ...manual(QuestionType.TEXT_LONG),
            question:
              'Bilgi güvenliği bir olayı tespit ettiğinizde izlemeniz gereken adımları kendi cümlelerinizle anlatın.',
            points: 3,
            order: 8,
            explanation:
              'Tespit → izolasyon → BT departmanına bildirim → kanıt koruma → raporlama adımları beklenir.',
          },
          {
            ...manual(QuestionType.RATING),
            question:
              "Şirketin BGYS eğitim programının etkinliğini 1-5 arası değerlendirin (1=Kötü, 5=Mükemmel).",
            points: 1,
            order: 9,
          },
          {
            ...manual(QuestionType.SCALE),
            question: 'Şirketin bilgi güvenliği kültürünü 1-10 arası puanlayın.',
            points: 1,
            order: 10,
          },
          {
            ...manual(QuestionType.YES_NO),
            question: 'Son 6 ayda en az bir bilgi güvenliği eğitimine katıldınız mı?',
            points: 1,
            order: 11,
          },
          {
            ...manual(QuestionType.DATE),
            question: 'Son şifre değişikliğinizi hangi tarihte yaptınız? (Yaklaşık tarih)',
            points: 1,
            order: 12,
          },
        ],
      },
    },
    include: {
      questions: { include: { options: true } },
    },
  });

  const autoQ = exam.questions.filter(q => !q.isManualGraded);
  const manualQ = exam.questions.filter(q => q.isManualGraded);
  const totalPoints = exam.questions.reduce((s, q) => s + q.points, 0);

  console.log('✅ Sprint 2 örnek exam oluşturuldu');
  console.log(`   ID: ${exam.id}`);
  console.log(`   Title: ${exam.title}`);
  console.log(`   Kurs: ${course.title}`);
  console.log(`   Toplam soru: ${exam.questions.length}`);
  console.log(
    `   Otomatik soru: ${autoQ.length} (${autoQ.reduce((s, q) => s + q.points, 0)} puan)`,
  );
  console.log(
    `   Manuel soru:   ${manualQ.length} (${manualQ.reduce((s, q) => s + q.points, 0)} puan)`,
  );
  console.log(`   Toplam puan: ${totalPoints}`);
  console.log(`   Geçme barajı: %${exam.passingScore}`);
  console.log(`   Süre: ${exam.timeLimit} dk | Max deneme: ${exam.maxAttempts}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

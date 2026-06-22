/**
 * Akademi seed script — dummy data ile UI testi için.
 *
 * Çalıştırma (repo root'tan):
 *   npx tsx prisma/seed-akademi.ts
 *
 * Idempotent: tekrar çalıştırmak güvenli (upsert kullanıyor).
 */

import { PrismaClient, ContentType } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const COURSES = [
  {
    id: "ak_course_isg",
    title: "İş Sağlığı ve Güvenliği Temel Eğitimi",
    description:
      "Tüm İleri Group çalışanları için zorunlu temel İSG eğitimi. Risk değerlendirmesi, acil durum prosedürleri ve iş kazası önleme.",
    category: "Zorunlu",
    difficulty: "BEGINNER" as const,
    duration: 45,
  },
  {
    id: "ak_course_kalite",
    title: "Kalite Yönetim Sistemleri — ISO 9001:2015",
    description:
      "ISO 9001:2015 standardının temel gereksinimleri ve İleri Group'taki uygulamaları.",
    category: "Teknik",
    difficulty: "INTERMEDIATE" as const,
    duration: 60,
  },
  {
    id: "ak_course_bgys",
    title: "Bilgi Güvenliği Farkındalığı",
    description:
      "ISO 27001 kapsamında her çalışanın bilmesi gereken güvenlik prensipleri, phishing ve veri sızıntısı önleme.",
    category: "Zorunlu",
    difficulty: "BEGINNER" as const,
    duration: 30,
  },
];

const CONTENTS: Array<{
  id: string;
  courseId: string;
  title: string;
  type: ContentType;
  duration: number;
  order: number;
}> = [
  // İSG
  { id: "ak_c_isg_1", courseId: "ak_course_isg", title: "Giriş ve Tanımlar", type: "PDF", duration: 10, order: 0 },
  { id: "ak_c_isg_2", courseId: "ak_course_isg", title: "Risk Değerlendirme Süreci", type: "VIDEO", duration: 15, order: 1 },
  { id: "ak_c_isg_3", courseId: "ak_course_isg", title: "Acil Durum Prosedürleri", type: "DOCUMENT", duration: 20, order: 2 },
  // Kalite
  { id: "ak_c_kal_1", courseId: "ak_course_kalite", title: "ISO 9001:2015 Genel Bakış", type: "VIDEO", duration: 20, order: 0 },
  { id: "ak_c_kal_2", courseId: "ak_course_kalite", title: "Süreç Yaklaşımı", type: "PDF", duration: 20, order: 1 },
  { id: "ak_c_kal_3", courseId: "ak_course_kalite", title: "Sürekli İyileştirme", type: "DOCUMENT", duration: 20, order: 2 },
  // BGYS
  { id: "ak_c_bgys_1", courseId: "ak_course_bgys", title: "Bilgi Güvenliği Nedir?", type: "VIDEO", duration: 10, order: 0 },
  { id: "ak_c_bgys_2", courseId: "ak_course_bgys", title: "Phishing Örnekleri", type: "PDF", duration: 10, order: 1 },
  { id: "ak_c_bgys_3", courseId: "ak_course_bgys", title: "Güçlü Parola Politikası", type: "DOCUMENT", duration: 10, order: 2 },
];

const LEVELS = [
  { level: 1, title: "Başlangıç",  minXp: 0,    maxXp: 99 },
  { level: 2, title: "Öğrenci",     minXp: 100,  maxXp: 499 },
  { level: 3, title: "Deneyimli",   minXp: 500,  maxXp: 1499 },
  { level: 4, title: "Uzman",       minXp: 1500, maxXp: 4999 },
  { level: 5, title: "Usta",        minXp: 5000, maxXp: null },
];

const BADGES = [
  { code: "ak_first_course", name: "İlk Kurs",        description: "İlk kursunu tamamladın",         icon: "🎓", category: "general" },
  { code: "ak_streak_7",     name: "7 Gün Kararlı",    description: "7 gün üst üste eğitim izledin",  icon: "🔥", category: "general" },
  { code: "ak_streak_30",    name: "30 Gün Ustası",    description: "30 gün üst üste eğitim izledin", icon: "🏆", category: "general" },
  { code: "ak_xp_1000",      name: "1000 XP",          description: "1000 XP'ye ulaştın",             icon: "⭐", category: "general" },
];

async function main() {
  console.log("🎓 Akademi seed başlıyor...\n");

  for (const l of LEVELS) {
    await prisma.akademiLevel.upsert({
      where: { level: l.level },
      create: l,
      update: l,
    });
  }
  console.log(`  ✓ ${LEVELS.length} seviye`);

  for (const c of COURSES) {
    await prisma.course.upsert({
      where: { id: c.id },
      create: { ...c, isActive: true },
      update: c,
    });
  }
  console.log(`  ✓ ${COURSES.length} kurs`);

  for (const c of CONTENTS) {
    await prisma.content.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        courseId: c.courseId,
        title: c.title,
        description: null,
        type: c.type,
        filePath: null,
        fileUrl: null,
        fileSize: null,
        duration: c.duration,
        order: c.order,
        isActive: true,
      },
      update: {
        title: c.title,
        type: c.type,
        duration: c.duration,
        order: c.order,
      },
    });
  }
  console.log(`  ✓ ${CONTENTS.length} content`);

  for (const b of BADGES) {
    await prisma.badge.upsert({
      where: { code: b.code },
      create: { ...b, isActive: true },
      update: b,
    });
  }
  console.log(`  ✓ ${BADGES.length} rozet\n`);

  console.log("✅ Seed tamamlandı.\n");
  console.log("📋 Sıradaki adım — kendine 3 kursu atamak için:\n");
  console.log("   1. User ID'ni bul:");
  console.log('      SELECT id FROM "User" WHERE email LIKE \'%melih%\';\n');
  console.log("   2. Assignment oluştur:");
  console.log(`      INSERT INTO course_assignments (id, "courseId", "createdAt")
      VALUES
        ('ak_a_isg',    'ak_course_isg',    NOW()),
        ('ak_a_kalite', 'ak_course_kalite', NOW()),
        ('ak_a_bgys',   'ak_course_bgys',   NOW())
      ON CONFLICT (id) DO NOTHING;\n`);
  console.log("   3. Kullanıcıya bağla:");
  console.log(`      INSERT INTO user_course_assignments (id, "userId", "assignmentId", "assignedAt")
      VALUES
        ('ak_ua_1', '<USER_ID>', 'ak_a_isg',    NOW()),
        ('ak_ua_2', '<USER_ID>', 'ak_a_kalite', NOW()),
        ('ak_ua_3', '<USER_ID>', 'ak_a_bgys',   NOW())
      ON CONFLICT (id) DO NOTHING;\n`);
}

main()
  .catch((e) => {
    console.error("❌ Seed hatası:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

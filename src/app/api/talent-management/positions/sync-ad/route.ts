import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAllLDAPUsers } from "@/lib/ldap";
import { PositionLevel, PositionSource } from "@/generated/prisma";

// Unvan'dan seviye tahmin et
function guessLevelFromTitle(title: string): PositionLevel {
  const titleLower = title.toLowerCase();

  // Executive seviye
  if (titleLower.includes('genel müdür') || titleLower.includes('ceo') || titleLower.includes('cfo') || titleLower.includes('cto')) {
    return PositionLevel.EXECUTIVE;
  }

  // Director seviye
  if (titleLower.includes('direktör') || titleLower.includes('director')) {
    return PositionLevel.DIRECTOR;
  }

  // Manager seviye
  if (titleLower.includes('müdür') || titleLower.includes('manager') || titleLower.includes('yönetici')) {
    return PositionLevel.MANAGER;
  }

  // Lead seviye
  if (titleLower.includes('şef') || titleLower.includes('chef') || titleLower.includes('lead') || titleLower.includes('supervisor') || titleLower.includes('takım lideri')) {
    return PositionLevel.LEAD;
  }

  // Senior seviye
  if (titleLower.includes('kıdemli') || titleLower.includes('senior') || titleLower.includes('sr.') || titleLower.includes('uzman')) {
    return PositionLevel.SENIOR;
  }

  // Junior seviye
  if (titleLower.includes('junior') || titleLower.includes('jr.') || titleLower.includes('asistan') || titleLower.includes('yardımcı')) {
    return PositionLevel.JUNIOR;
  }

  // Entry seviye
  if (titleLower.includes('stajyer') || titleLower.includes('intern') || titleLower.includes('trainee')) {
    return PositionLevel.ENTRY;
  }

  // Varsayılan olarak MID seviye
  return PositionLevel.MID;
}

// Unvan'dan kod oluştur
function generateCodeFromTitle(title: string, department: string): string {
  // Departman kısaltması
  const deptAbbr = department
    .split(' ')
    .map(w => w.charAt(0).toUpperCase())
    .join('')
    .substring(0, 3) || 'GEN';

  // Unvan kısaltması
  const titleAbbr = title
    .split(' ')
    .filter(w => w.length > 2)
    .map(w => w.charAt(0).toUpperCase())
    .join('')
    .substring(0, 4) || 'POS';

  // Benzersizlik için random suffix
  const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();

  return `${deptAbbr}-${titleAbbr}-${suffix}`;
}

// POST - AD'den pozisyonları senkronize et
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const userRole = session.user.role;
    const userDepartment = session.user.department || "";

    // Yetki kontrolü
    const fullAccessRoles = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "IT_MANAGER"];
    const hrDepartments = ["insan varliklari", "insan varlıkları", "human resources", "hr"];
    const isHrDepartment = hrDepartments.some(dept => userDepartment.toLowerCase().includes(dept));

    if (!fullAccessRoles.includes(userRole) && !isHrDepartment) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
    }

    // AD'den tüm kullanıcıları al
    const ldapUsers = await getAllLDAPUsers();

    if (ldapUsers.length === 0) {
      return NextResponse.json({ error: "AD'den kullanıcı alınamadı" }, { status: 500 });
    }

    // Benzersiz pozisyonları (title + department) çıkar
    const uniquePositions = new Map<string, { title: string; department: string; count: number }>();

    for (const user of ldapUsers) {
      if (!user.title || !user.department) continue;

      const key = `${user.title.toLowerCase()}|${user.department.toLowerCase()}`;
      const existing = uniquePositions.get(key);

      if (existing) {
        existing.count++;
      } else {
        uniquePositions.set(key, {
          title: user.title,
          department: user.department,
          count: 1
        });
      }
    }

    // Mevcut AD kaynaklı pozisyonları al
    const existingAdPositions = await prisma.position.findMany({
      where: { source: PositionSource.AD }
    });
    const existingAdTitles = new Set(existingAdPositions.map(p => p.adJobTitle?.toLowerCase()));

    // Yeni pozisyonları ekle
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [key, posData] of uniquePositions) {
      const titleLower = posData.title.toLowerCase();

      // Zaten AD'den senkronize edilmiş mi?
      if (existingAdTitles.has(titleLower)) {
        // Mevcut kaydı güncelle (lastSyncedAt)
        try {
          await prisma.position.updateMany({
            where: {
              source: PositionSource.AD,
              adJobTitle: { equals: posData.title, mode: 'insensitive' }
            },
            data: {
              lastSyncedAt: new Date()
            }
          });
          updated++;
        } catch (err) {
          errors.push(`Güncelleme hatası: ${posData.title}`);
        }
        continue;
      }

      // Manuel olarak aynı unvan eklenmiş mi kontrol et
      const existingManual = await prisma.position.findFirst({
        where: {
          title: { equals: posData.title, mode: 'insensitive' },
          department: { equals: posData.department, mode: 'insensitive' }
        }
      });

      if (existingManual) {
        skipped++;
        continue;
      }

      // Yeni pozisyon oluştur
      try {
        const level = guessLevelFromTitle(posData.title);
        let code = generateCodeFromTitle(posData.title, posData.department);

        // Kod benzersiz olana kadar dene
        let attempts = 0;
        while (attempts < 10) {
          const exists = await prisma.position.findUnique({ where: { code } });
          if (!exists) break;
          code = generateCodeFromTitle(posData.title, posData.department);
          attempts++;
        }

        await prisma.position.create({
          data: {
            code,
            title: posData.title,
            department: posData.department,
            level,
            source: PositionSource.AD,
            adJobTitle: posData.title,
            lastSyncedAt: new Date(),
            isActive: true
          }
        });
        created++;
      } catch (err: any) {
        errors.push(`Oluşturma hatası: ${posData.title} - ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `AD senkronizasyonu tamamlandı`,
      stats: {
        totalUniquePositions: uniquePositions.size,
        created,
        updated,
        skipped,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error("AD pozisyon senkronizasyon hatası:", error);
    return NextResponse.json(
      { error: "Senkronizasyon sırasında hata oluştu", details: error.message },
      { status: 500 }
    );
  }
}

// GET - AD'deki pozisyonları önizle (senkronize etmeden)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    // AD'den tüm kullanıcıları al
    const ldapUsers = await getAllLDAPUsers();

    if (ldapUsers.length === 0) {
      return NextResponse.json({ error: "AD'den kullanıcı alınamadı" }, { status: 500 });
    }

    // Benzersiz pozisyonları (title + department) çıkar
    const uniquePositions = new Map<string, { title: string; department: string; count: number }>();

    for (const user of ldapUsers) {
      if (!user.title || !user.department) continue;

      const key = `${user.title.toLowerCase()}|${user.department.toLowerCase()}`;
      const existing = uniquePositions.get(key);

      if (existing) {
        existing.count++;
      } else {
        uniquePositions.set(key, {
          title: user.title,
          department: user.department,
          count: 1
        });
      }
    }

    // Mevcut pozisyonlarla karşılaştır
    const existingPositions = await prisma.position.findMany({
      select: { title: true, department: true, source: true, adJobTitle: true }
    });
    const existingTitles = new Set(existingPositions.map(p =>
      `${p.title.toLowerCase()}|${p.department.toLowerCase()}`
    ));

    const positions = Array.from(uniquePositions.values())
      .map(pos => ({
        ...pos,
        suggestedLevel: guessLevelFromTitle(pos.title),
        alreadyExists: existingTitles.has(`${pos.title.toLowerCase()}|${pos.department.toLowerCase()}`)
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      totalUsers: ldapUsers.length,
      usersWithTitle: ldapUsers.filter(u => u.title).length,
      uniquePositions: positions.length,
      positions,
      newPositions: positions.filter(p => !p.alreadyExists).length
    });

  } catch (error: any) {
    console.error("AD pozisyon önizleme hatası:", error);
    return NextResponse.json(
      { error: "Önizleme sırasında hata oluştu", details: error.message },
      { status: 500 }
    );
  }
}

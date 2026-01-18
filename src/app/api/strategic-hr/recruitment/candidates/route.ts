import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CandidateSource } from "@/generated/prisma";

// Yetki kontrolü helper
async function checkAccess(session: any) {
  const userRole = session?.user?.role;
  const userDepartment = session?.user?.department || "";

  const fullAccessRoles = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER", "IT_MANAGER"];
  const hrDepartments = ["insan varliklari", "insan varlıkları", "human resources", "hr"];
  const isHrDepartment = hrDepartments.some(dept => userDepartment.toLowerCase().includes(dept));

  return {
    hasFullAccess: fullAccessRoles.includes(userRole) || isHrDepartment,
    isDeptHead: userRole === "DEPT_HEAD",
    userDepartment
  };
}

// GET - Adaylar listesi
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { hasFullAccess, isDeptHead } = await checkAccess(session);

    if (!hasFullAccess && !isDeptHead) {
      return NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const source = searchParams.get("source") as CandidateSource | null;
    const skills = searchParams.get("skills");

    const where: any = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { currentTitle: { contains: search, mode: "insensitive" } },
        { currentCompany: { contains: search, mode: "insensitive" } }
      ];
    }

    if (source) {
      where.source = source;
    }

    if (skills) {
      where.skills = { hasSome: skills.split(",") };
    }

    const candidates = await prisma.candidate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        applications: {
          select: {
            id: true,
            status: true,
            jobOpening: {
              select: {
                id: true,
                title: true,
                code: true
              }
            }
          }
        },
        _count: {
          select: {
            applications: true
          }
        }
      }
    });

    return NextResponse.json(candidates);
  } catch (error) {
    console.error("Adaylar listesi hatası:", error);
    return NextResponse.json(
      { error: "Adaylar alınırken hata oluştu" },
      { status: 500 }
    );
  }
}

// POST - Yeni aday ekle
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { hasFullAccess } = await checkAccess(session);

    if (!hasFullAccess) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
    }

    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      currentTitle,
      currentCompany,
      yearsOfExperience,
      education,
      skills,
      resumeUrl,
      linkedinUrl,
      portfolioUrl,
      source,
      referredBy,
      notes,
      tags
    } = body;

    if (!firstName || !lastName || !email || !source) {
      return NextResponse.json(
        { error: "Ad, soyad, e-posta ve kaynak zorunludur" },
        { status: 400 }
      );
    }

    // E-posta benzersizlik kontrolü
    const existingCandidate = await prisma.candidate.findUnique({
      where: { email }
    });

    if (existingCandidate) {
      return NextResponse.json(
        { error: "Bu e-posta adresi ile kayıtlı aday zaten var" },
        { status: 400 }
      );
    }

    const candidate = await prisma.candidate.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        currentTitle,
        currentCompany,
        yearsOfExperience,
        education,
        skills: skills || [],
        resumeUrl,
        linkedinUrl,
        portfolioUrl,
        source: source as CandidateSource,
        referredBy,
        notes,
        tags: tags || []
      }
    });

    return NextResponse.json(candidate, { status: 201 });
  } catch (error) {
    console.error("Aday ekleme hatası:", error);
    return NextResponse.json(
      { error: "Aday eklenirken hata oluştu" },
      { status: 500 }
    );
  }
}

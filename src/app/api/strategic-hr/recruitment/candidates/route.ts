import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CandidateSource, Prisma } from "@/generated/prisma";
import { requireSession } from "@/lib/auth/require-session";

// PR-RECRUIT-RBAC: permissions tabanlı; aday detayını sadece admin veya
// kendi departmanı pozisyonlarına başvuran adayları görür.
function recruitAccess(session: { user: { permissions?: string[]; department?: string | null } }) {
  const perms = session.user.permissions ?? [];
  return {
    isAdmin: perms.includes("recruitment.admin"),
    canViewCandidate: perms.includes("recruitment.candidate.view"),
    canViewByDept: perms.includes("recruitment.view"),
    userDepartment: session.user.department || "",
  };
}

// GET - Adaylar listesi
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;

    const ctx = recruitAccess(session);
    if (!ctx.isAdmin && !ctx.canViewByDept && !ctx.canViewCandidate) {
      return NextResponse.json({ error: "Bu modüle erişim yetkiniz yok" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const source = searchParams.get("source") as CandidateSource | null;
    const skills = searchParams.get("skills");

    const where: Prisma.CandidateWhereInput = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { currentTitle: { contains: search, mode: "insensitive" } },
        { currentCompany: { contains: search, mode: "insensitive" } },
      ];
    }

    if (source) where.source = source;
    if (skills) where.skills = { hasSome: skills.split(",") };

    // Departman müdürü: sadece kendi departmanı pozisyonlarına başvuran adaylar
    if (!ctx.isAdmin && !ctx.canViewCandidate && ctx.canViewByDept) {
      where.applications = {
        some: {
          jobOpening: {
            department: { contains: ctx.userDepartment, mode: "insensitive" },
          },
        },
      };
    }

    const candidates = await prisma.candidate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        applications: {
          select: {
            id: true,
            status: true,
            jobOpening: { select: { id: true, title: true, code: true } },
          },
        },
        _count: { select: { applications: true } },
      },
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

// POST - Yeni aday ekle (sadece admin veya recruitment.candidate.view)
export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;

    const ctx = recruitAccess(session);
    if (!ctx.isAdmin && !ctx.canViewCandidate) {
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

    const normalizedEmail = typeof email === "string" ? email.toLowerCase() : email;

    const existingCandidate = await prisma.candidate.findUnique({
      where: { email: normalizedEmail },
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
        email: normalizedEmail,
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

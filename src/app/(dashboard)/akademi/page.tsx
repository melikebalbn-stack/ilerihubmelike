import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatCard } from "@/components/akademi/dashboard/StatCard";
import { ProgressRing } from "@/components/akademi/dashboard/ProgressRing";
import { CourseCard } from "@/components/akademi/dashboard/CourseCard";
import { SplitBadge } from "@/components/akademi/SplitBadge";
import { MyPackagesWidget } from "@/components/akademi/MyPackagesWidget";
import { resolveFirstName } from "@/lib/akademi-helpers";
import {
  buildCourseCardModel,
  type CourseCardInput,
} from "@/lib/akademi/course-card-model";

export default async function AkademiDashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = await resolveAkademiUserId(session);
  if (!userId) redirect("/login");

  const [user, myCourses, ifsAssignmentCount] = await Promise.all([
    fetchUser(userId),
    fetchMyCourses(userId),
    countIfsAssignments(userId),
  ]);

  const firstName = user
    ? resolveFirstName({
        firstName: user.firstName,
        name: user.name,
        email: user.email,
      })
    : "";

  const assignedCount = myCourses.length;
  const completedCount = myCourses.filter((c) => c.isCompleted).length;
  const inProgressCount = myCourses.filter(
    (c) => !c.isCompleted && c.progressPercent > 0
  ).length;

  const now = new Date();
  const cardModels = myCourses.map((c) => buildCourseCardModel(c, now));

  return (
    <div className="px-8 py-7 max-w-7xl mx-auto">
      <div className="mb-6 ak-animate-in">
        <h1
          className="text-2xl font-bold mb-1"
          style={{ color: "var(--ak-text-primary)" }}
        >
          Merhaba{firstName ? `, ${firstName}` : ""}!
        </h1>
        <p className="text-sm" style={{ color: "var(--ak-text-secondary)" }}>
          Bugün hangi eğitime devam etmek istersin?
        </p>
      </div>

      {/* Üst satır: ilerleme halkası + 3 sayaç */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1fr] gap-4 mb-6 ak-animate-in">
        <ProgressRing
          assigned={assignedCount}
          completed={completedCount}
          inProgress={inProgressCount}
        />
        <StatCard icon="bookOpen" label="Atanan Eğitim" value={assignedCount} color="accent" delayIndex={1} />
        <StatCard icon="award" label="Tamamlanan" value={completedCount} color="green" delayIndex={2} />
        <StatCard icon="clock" label="Devam Eden" value={inProgressCount} color="orange" delayIndex={3} />
      </div>

      {ifsAssignmentCount > 0 && (
        <div className="ak-card-static p-4 mb-6 flex items-center justify-between gap-3 ak-animate-in">
          <div className="min-w-0">
            <div
              className="text-sm font-semibold"
              style={{ color: "var(--ak-text-primary)" }}
            >
              IFS geçiş eğitimleriniz IFS Ödevleri sayfasında
            </div>
            <div className="text-xs" style={{ color: "var(--ak-text-secondary)" }}>
              {ifsAssignmentCount} IFS eğitimi size atanmış — ilerleme ve
              görevler orada takip ediliyor.
            </div>
          </div>
          <SplitBadge
            color="blue"
            left={`${ifsAssignmentCount} IFS eğitimi`}
            right="Ödevlere git"
            href="/ifs/odevler"
            className="shrink-0"
          />
        </div>
      )}

      <MyPackagesWidget />

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2
            className="text-base font-bold"
            style={{ color: "var(--ak-text-primary)" }}
          >
            📚 Eğitimlerim
          </h2>
          <Link
            href="/akademi/courses"
            className="text-xs font-medium flex items-center gap-1"
            style={{ color: "var(--ak-accent)" }}
          >
            Tümünü Gör
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {cardModels.length === 0 ? (
          <div
            className="ak-card-static p-6 text-center text-sm"
            style={{ color: "var(--ak-text-tertiary)" }}
          >
            Henüz sana atanmış bir eğitim yok. Yöneticinle iletişime geç.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-[18px]">
            {cardModels.map((m) => (
              <CourseCard key={m.id} model={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

async function fetchUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, firstName: true, lastName: true, email: true },
  });
}

// IFS-6: IFS kursları akademi panelinde listelenmez; kişinin IFS ataması varsa
// yönlendirme bandı /ifs/odevler'e götürür. Kayıtlara dokunulmaz.
async function countIfsAssignments(userId: string): Promise<number> {
  return prisma.userCourseAssignment.count({
    where: { userId, assignment: { course: { isIfs: true, isActive: true } } },
  });
}

async function fetchMyCourses(userId: string): Promise<CourseCardInput[]> {
  const courses = await prisma.course.findMany({
    where: {
      isActive: true,
      isIfs: false,
      directAssignments: { some: { userAssignments: { some: { userId } } } },
    },
    include: {
      contents: { where: { isActive: true }, select: { type: true } },
      exams: { where: { isActive: true }, select: { _count: { select: { questions: true } } } },
      progress: { where: { userId }, take: 1 },
      directAssignments: {
        where: { userAssignments: { some: { userId } } },
        select: {
          userAssignments: {
            where: { userId },
            select: { dueDate: true, assignedAt: true },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return courses.map((c) => {
    const prog = c.progress[0];
    const ua = c.directAssignments[0]?.userAssignments[0];
    return {
      id: c.id,
      title: c.title,
      thumbnail: c.thumbnail,
      category: c.category,
      duration: c.duration,
      videoCount: c.contents.filter((ct) => ct.type === "VIDEO").length,
      examQuestionCount: c.exams.reduce((s, e) => s + e._count.questions, 0),
      progressPercent: prog?.percentage ?? 0,
      isCompleted: Boolean(prog?.completedAt),
      dueDate: ua?.dueDate ?? null,
      assignedAt: ua?.assignedAt ?? null,
    };
  });
}

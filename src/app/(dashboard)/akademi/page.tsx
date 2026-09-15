import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveAkademiUserId } from "@/lib/akademi-user";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ChevronRight, ArrowRight, Factory } from "lucide-react";
import { StatCard } from "@/components/akademi/dashboard/StatCard";
import { CourseListItem } from "@/components/akademi/dashboard/CourseListItem";
import { MyPackagesWidget } from "@/components/akademi/MyPackagesWidget";
import { resolveFirstName } from "@/lib/akademi-helpers";
import type { CourseListItem as CourseListItemType } from "@/types/akademi";

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

  return (
    <div className="px-8 py-7 max-w-7xl mx-auto">
      <div className="mb-6 ak-animate-in">
        <h1
          className="text-2xl font-bold mb-1"
          style={{ color: "var(--ak-text-primary)" }}
        >
          Merhaba{firstName ? `, ${firstName}` : ""}! 👋
        </h1>
        <p className="text-sm" style={{ color: "var(--ak-text-secondary)" }}>
          Bugün hangi eğitime devam etmek istersin?
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-6">
        <StatCard
          icon="bookOpen"
          label="Atanan Eğitim"
          value={assignedCount}
          color="accent"
          delayIndex={1}
        />
        <StatCard
          icon="award"
          label="Tamamlanan"
          value={completedCount}
          color="green"
          delayIndex={2}
        />
        <StatCard
          icon="clock"
          label="Devam Eden"
          value={inProgressCount}
          color="orange"
          delayIndex={3}
        />
      </div>

      {ifsAssignmentCount > 0 && (
        <Link
          href="/ifs/odevler"
          className="ak-card-static p-4 mb-6 flex items-center gap-3 ak-animate-in"
          style={{ color: "var(--ak-text-primary)" }}
        >
          <Factory
            className="w-5 h-5 shrink-0"
            style={{ color: "var(--ak-accent)" }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">
              IFS geçiş eğitimleriniz IFS Ödevleri sayfasında
            </div>
            <div
              className="text-xs"
              style={{ color: "var(--ak-text-secondary)" }}
            >
              {ifsAssignmentCount} IFS eğitimi size atanmış — ilerleme ve
              görevler orada takip ediliyor.
            </div>
          </div>
          <ArrowRight
            className="w-4 h-4 shrink-0"
            style={{ color: "var(--ak-accent)" }}
          />
        </Link>
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

        {myCourses.length === 0 ? (
          <div
            className="ak-card-static p-6 text-center text-sm"
            style={{ color: "var(--ak-text-tertiary)" }}
          >
            Henüz sana atanmış bir eğitim yok. Yöneticinle iletişime geç.
          </div>
        ) : (
          <div className="space-y-2.5">
            {myCourses.slice(0, 5).map((c, i) => (
              <CourseListItem
                key={c.id}
                course={c}
                delayIndex={Math.min(i + 1, 8)}
              />
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
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  });
}

// IFS-6: IFS kursları akademi panelinde listelenmez — kişinin IFS ataması
// varsa yukarıdaki yönlendirme kartı /ifs/odevler'e götürür. Kayıtlara
// (atama/ilerleme) dokunulmaz; yalnız bu listeden çıkar. courses/my ile aynı.
async function countIfsAssignments(userId: string): Promise<number> {
  return prisma.userCourseAssignment.count({
    where: { userId, assignment: { course: { isIfs: true, isActive: true } } },
  });
}

async function fetchMyCourses(userId: string): Promise<CourseListItemType[]> {
  const courses = await prisma.course.findMany({
    where: {
      isActive: true,
      isIfs: false,
      directAssignments: {
        some: { userAssignments: { some: { userId } } },
      },
    },
    include: {
      _count: { select: { contents: { where: { isActive: true } } } },
      progress: { where: { userId }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return courses.map((c) => {
    const prog = c.progress[0];
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      thumbnail: c.thumbnail,
      category: c.category,
      difficulty: c.difficulty,
      duration: c.duration,
      contentCount: c._count.contents,
      progressPercent: prog?.percentage ?? 0,
      isCompleted: Boolean(prog?.completedAt),
      isAssigned: true,
    };
  });
}

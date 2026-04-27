import { prisma } from "@/lib/prisma";
import { AdminStatCard } from "@/components/akademi/admin/AdminStatCard";
import { AdminActionCard } from "@/components/akademi/admin/AdminActionCard";

export default async function AkademiAdminDashboardPage() {
  const [activeCourses, totalAssignments, activeUsers, activePackages] =
    await Promise.all([
      prisma.course.count({ where: { isActive: true } }),
      prisma.userCourseAssignment.count(),
      prisma.user.count({
        where: {
          courseAssignments: {
            some: {},
          },
        },
      }),
      prisma.coursePackage.count({ where: { isActive: true } }),
    ]);

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        <AdminStatCard
          icon="bookOpen"
          label="Aktif Kurs"
          value={activeCourses}
          color="accent"
          delayIndex={1}
        />
        <AdminStatCard
          icon="package"
          label="Aktif Paket"
          value={activePackages}
          color="purple"
          delayIndex={2}
        />
        <AdminStatCard
          icon="users"
          label="Toplam Atama"
          value={totalAssignments}
          color="green"
          delayIndex={3}
        />
        <AdminStatCard
          icon="award"
          label="Aktif Öğrenci"
          value={activeUsers}
          color="orange"
          delayIndex={4}
        />
      </div>

      <div className="mb-4">
        <h2
          className="text-base font-bold mb-3"
          style={{ color: "var(--ak-text-primary)" }}
        >
          Hızlı Eylemler
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <AdminActionCard
          href="/akademi/admin/courses"
          title="Kursları Yönet"
          description="Yeni kurs oluştur, mevcut kursları düzenle veya sil"
          icon="bookOpen"
          color="accent"
          delayIndex={1}
        />
        <AdminActionCard
          href="/akademi/admin/packages"
          title="Paketleri Yönet"
          description="Departman bazlı kurs paketleri oluştur ve ata"
          icon="package"
          color="purple"
          delayIndex={2}
        />
        <AdminActionCard
          href="/akademi/admin/assignments"
          title="Atamaları Yönet"
          description="Kullanıcılara kurs ata veya atamaları kaldır"
          icon="userCheck"
          color="green"
          delayIndex={3}
        />
        <AdminActionCard
          href="/akademi/admin/users"
          title="Kullanıcı İlerlemesi"
          description="Kullanıcı bazlı eğitim ilerlemesini görüntüle"
          icon="users"
          color="orange"
          delayIndex={3}
        />
        <AdminActionCard
          href="/akademi/admin/courses"
          title="İçerik Yönetimi"
          description="Kurs detayından video ve PDF içerikleri yükleyin"
          icon="upload"
          color="purple"
          delayIndex={4}
        />
      </div>

      <div
        className="mt-8 p-4 rounded-[10px] text-sm"
        style={{
          background: "var(--ak-accent-glow)",
          color: "var(--ak-text-secondary)",
        }}
      >
        <strong style={{ color: "var(--ak-accent)" }}>
          ✅ Sprint 2b tamam:
        </strong>{" "}
        Kurs içerikleri artık yüklenebilir (video/PDF/doküman). Drag-drop
        ile sıralayın. Sınav sistemi Sprint 3&apos;te gelecek.
      </div>
    </div>
  );
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GraduationCap, Sparkles } from "lucide-react";

export default async function AkademiHomePage() {
  const session = await getServerSession(authOptions);
  const u = session?.user as { firstName?: string; name?: string | null } | undefined;
  const firstName = u?.firstName ?? u?.name?.split(" ")[0] ?? "";

  return (
    <div className="px-8 py-7">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10 ak-animate-in">
          <div
            className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-6"
            style={{ background: "var(--ak-accent-glow)" }}
          >
            <GraduationCap
              className="w-10 h-10"
              style={{ color: "var(--ak-accent)" }}
            />
          </div>
          <h1
            className="text-3xl font-bold mb-3"
            style={{ color: "var(--ak-text-primary)" }}
          >
            İleri Akademi&apos;ye Hoş Geldin{firstName ? `, ${firstName}` : ""}!
          </h1>
          <p
            className="text-base max-w-xl mx-auto"
            style={{ color: "var(--ak-text-secondary)" }}
          >
            Kurumsal eğitim platformumuza ILERIHub içinden erişim
            sağlayabilirsin. Modül şu anda kurulum aşamasında — yakında
            eğitimlerin, sınavların ve sertifikaların burada olacak.
          </p>
        </div>

        <div className="ak-card-static p-6 ak-animate-in ak-delay-2">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "var(--ak-orange-glow)" }}
            >
              <Sparkles
                className="w-5 h-5"
                style={{ color: "var(--ak-orange)" }}
              />
            </div>
            <div>
              <h2
                className="text-base font-semibold mb-2"
                style={{ color: "var(--ak-text-primary)" }}
              >
                Geliştirme Sprint Planı
              </h2>
              <ul
                className="text-sm space-y-1.5"
                style={{ color: "var(--ak-text-secondary)" }}
              >
                <li>
                  <span style={{ color: "var(--ak-accent)" }}>Sprint 1:</span>{" "}
                  Dashboard, Eğitimler, Kurs Detayı, Sıralama
                </li>
                <li>
                  <span style={{ color: "var(--ak-accent)" }}>Sprint 2:</span>{" "}
                  Yönetim paneli (kurs CRUD, atama)
                </li>
                <li>
                  <span style={{ color: "var(--ak-accent)" }}>Sprint 3:</span>{" "}
                  Sınav sistemi (çözme, sonuç, analiz)
                </li>
                <li>
                  <span style={{ color: "var(--ak-accent)" }}>Sprint 4:</span>{" "}
                  Sertifika üretimi ve profil yönetimi
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

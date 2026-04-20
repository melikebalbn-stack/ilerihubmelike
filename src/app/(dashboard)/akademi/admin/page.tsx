import { PlaceholderPage } from "@/components/akademi/layout/PlaceholderPage";
import { requireAkademiAdmin } from "@/lib/akademi-admin-guard";
import { redirect } from "next/navigation";

export default async function AkademiAdminPlaceholder() {
  const { error } = await requireAkademiAdmin();
  if (error) {
    redirect("/akademi");
  }

  return (
    <PlaceholderPage
      title="Akademi Yönetimi"
      description="Eğitim oluşturma, içerik yükleme ve kullanıcı atama yönetim paneli hazırlanıyor."
      expectedSprint="Sprint 2"
      features={[
        "Eğitim CRUD (oluşturma, düzenleme, silme)",
        "Video/PDF içerik yükleme",
        "Departman ve kullanıcı bazlı atama",
        "Paket yönetimi ve toplu atama",
      ]}
    />
  );
}

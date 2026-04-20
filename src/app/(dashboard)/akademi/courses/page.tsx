import { PlaceholderPage } from "@/components/akademi/layout/PlaceholderPage";

export default function AkademiCoursesPlaceholder() {
  return (
    <PlaceholderPage
      title="Eğitimler"
      description="Sana atanan ve katalogdaki tüm eğitimleri buradan takip edeceksin. Sayfa Sprint 1 kapsamında aktifleştirilecek."
      expectedSprint="Sprint 1 (PR-A4)"
      features={[
        "Atanmış eğitimlerin listesi + ilerleme durumu",
        "Kategori ve durum filtreleri",
        "Arama ile hızlı erişim",
        "Responsive grid layout",
      ]}
    />
  );
}

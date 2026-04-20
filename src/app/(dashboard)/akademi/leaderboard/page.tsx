import { PlaceholderPage } from "@/components/akademi/layout/PlaceholderPage";

export default function AkademiLeaderboardPlaceholder() {
  return (
    <PlaceholderPage
      title="Sıralama"
      description="XP puanına göre en başarılı öğrenciler ve kendi sıralaman bu sayfada görünecek."
      expectedSprint="Sprint 1 (PR-A4)"
      features={[
        "Top 3 podium animasyonu",
        "Top 20 sıralama listesi",
        "Kendi sıralamana hızlı erişim",
        "Level ve streak bilgisi",
      ]}
    />
  );
}

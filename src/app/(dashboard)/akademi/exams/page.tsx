import { PlaceholderPage } from "@/components/akademi/layout/PlaceholderPage";

export default function AkademiExamsPlaceholder() {
  return (
    <PlaceholderPage
      title="Sınavlar"
      description="Eğitim sınavlarını çözmek ve sonuçlarını görmek için bu bölüm hazırlanıyor."
      expectedSprint="Sprint 3"
      features={[
        "Atanan sınavların listesi ve durumu",
        "Zaman sınırlı sınav çözme arayüzü",
        "Geçmiş deneme sonuçları ve konu analizi",
        "Minimum puan + hak sayısı takibi",
      ]}
    />
  );
}

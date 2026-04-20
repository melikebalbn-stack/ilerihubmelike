import { PlaceholderPage } from "@/components/akademi/layout/PlaceholderPage";

export default function AkademiExamDetailPlaceholder() {
  return (
    <PlaceholderPage
      title="Sınav Detayı"
      description="Sınavın detaylı bilgileri, kuralları ve çözme arayüzü Sprint 3'te aktif olacak."
      expectedSprint="Sprint 3"
      features={[
        "Sınav kuralları ve bilgilendirme",
        "Deneme geçmişi ve konu bazlı analiz",
        "Zamanlı sınav çözme UI'ı",
        "Anında puanlama ve sonuç gösterimi",
      ]}
    />
  );
}

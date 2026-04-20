import { PlaceholderPage } from "@/components/akademi/layout/PlaceholderPage";

export default function AkademiCourseDetailPlaceholder() {
  return (
    <PlaceholderPage
      title="Eğitim Detayı"
      description="Eğitim içeriklerini görüntülemek, video/PDF oynatmak ve ilerlemeyi takip etmek için bu sayfa hazırlanıyor."
      expectedSprint="Sprint 1 (PR-A4)"
      features={[
        "Eğitim kahraman kartı (thumbnail + bilgiler)",
        "Video ve PDF içerik oynatıcı",
        "İçerik tamamlama işaretleme",
        "İlerleme çubuğu ve XP kazanımı",
      ]}
    />
  );
}

import { PlaceholderPage } from "@/components/akademi/layout/PlaceholderPage";

export default function AkademiCertificatesPlaceholder() {
  return (
    <PlaceholderPage
      title="Sertifikalarım"
      description="Tamamladığın eğitimlerin sertifikalarını görüntülemek ve indirmek için bu sayfa hazırlanıyor."
      expectedSprint="Sprint 4"
      features={[
        "Alınan sertifikaların görsel kartları",
        "PDF oluşturma ve indirme",
        "Doğrulama URL'i ile paylaşılabilir sertifika",
        "Geçerlilik süresi takibi",
      ]}
    />
  );
}

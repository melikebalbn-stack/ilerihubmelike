import { PlaceholderPage } from "@/components/akademi/layout/PlaceholderPage";

export default function AkademiProfilePlaceholder() {
  return (
    <PlaceholderPage
      title="Profilim"
      description="Eğitim istatistiklerini, rozetlerini ve tercihlerini yönetebileceğin profil sayfası hazırlanıyor."
      expectedSprint="Sprint 4"
      features={[
        "Kişisel istatistikler ve aktivite geçmişi",
        "Kazanılan rozetler koleksiyonu",
        "Bildirim tercihleri",
        "Kullanıcı bilgileri görüntüleme",
      ]}
    />
  );
}

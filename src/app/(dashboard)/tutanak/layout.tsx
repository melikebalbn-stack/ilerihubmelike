import { modulGuard } from '@/lib/modul-durum/sunucu'

// Modül yayın kapısı: GİZLİ/PİLOT iken yetkisiz kullanıcı 404 alır.
// Tutanak modülü GIZLI olarak başlar (migration'daki SystemSetting satırı);
// durum Ayarlar > Modül Yayın Durumu ekranından değiştirilir.
export default async function ModulLayout({ children }: { children: React.ReactNode }) {
  await modulGuard('tutanak')
  return <>{children}</>
}

"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  BookOpen,
  Cog,
  Calendar,
  ClipboardList,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Clock,
  Info,
  HelpCircle,
  Download,
  Printer,
} from "lucide-react"
import Link from "next/link"

export default function MaintenanceGuidePage() {
  const [activeSection, setActiveSection] = useState("giris")

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto print:max-w-none">
      {/* Header */}
      <div className="flex items-center justify-between guide-screen-only">
        <div className="flex items-center gap-4">
          <Link href="/maintenance">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Geri
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BookOpen className="h-8 w-8 text-primary" />
              Tezgah Bakim Yonetimi Kilavuzu
            </h1>
            <p className="text-muted-foreground mt-1">
              Modul kullanim rehberi ve en iyi uygulamalar
            </p>
          </div>
        </div>
        <Button onClick={handlePrint} variant="outline">
          <Printer className="h-4 w-4 mr-2" />
          Yazdir
        </Button>
      </div>

      {/* Print Header - artık kullanılmıyor, guide-print-container içinde */}
      <div className="hidden">
        <h1 className="text-3xl font-bold">Tezgah Bakim Yonetimi</h1>
        <p className="text-xl">Kullanim Kilavuzu</p>
        <p className="text-sm text-gray-500 mt-2">ILERIHub | Versiyon 1.0</p>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeSection} onValueChange={setActiveSection} className="guide-screen-only">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="giris">
            <Info className="h-4 w-4 mr-2" />
            Giris
          </TabsTrigger>
          <TabsTrigger value="makineler">
            <Cog className="h-4 w-4 mr-2" />
            Makineler
          </TabsTrigger>
          <TabsTrigger value="planlar">
            <Calendar className="h-4 w-4 mr-2" />
            Bakim Planlari
          </TabsTrigger>
          <TabsTrigger value="isemirleri">
            <ClipboardList className="h-4 w-4 mr-2" />
            Is Emirleri
          </TabsTrigger>
          <TabsTrigger value="kpi">
            <BarChart3 className="h-4 w-4 mr-2" />
            KPI
          </TabsTrigger>
        </TabsList>

        {/* Giriş */}
        <TabsContent value="giris" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tezgah Bakim Yonetimi Nedir?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                Tezgah Bakim Yonetimi modulu, fabrikadaki tum makine ve tezgahlarin
                bakim sureclerini dijital ortamda yonetmenizi saglar.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold mb-2">Bu modul ile yapabilecekleriniz:</h4>
                  <ul className="space-y-1 text-sm">
                    <li>• Makine envanterinizi takip edebilirsiniz</li>
                    <li>• Periyodik bakim planlari olusturabilirsiniz</li>
                    <li>• Ariza bildirimlerini kayit altina alabilirsiniz</li>
                    <li>• Is emirlerini yonetebilirsiniz</li>
                    <li>• Bakim performansinizi KPI'larla olcebilirsiniz</li>
                  </ul>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-semibold mb-2">Yetkili Roller:</h4>
                  <ul className="space-y-1 text-sm">
                    <li>• Quality Manager (Kalite Yoneticisi)</li>
                    <li>• Admin (Yonetici)</li>
                    <li>• Super Admin (Super Yonetici)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Temel Kavramlar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="flex items-start gap-3 p-3 border rounded-lg">
                  <Cog className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <h4 className="font-semibold">Makine</h4>
                    <p className="text-sm text-muted-foreground">
                      Uretimde kullanilan tezgah, ekipman veya cihaz
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 border rounded-lg">
                  <Calendar className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <h4 className="font-semibold">Bakim Plani</h4>
                    <p className="text-sm text-muted-foreground">
                      Periyodik olarak yapilmasi gereken bakim tanimi
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 border rounded-lg">
                  <ClipboardList className="h-5 w-5 text-yellow-500 mt-0.5" />
                  <div>
                    <h4 className="font-semibold">Is Emri</h4>
                    <p className="text-sm text-muted-foreground">
                      Tek seferlik bakim veya ariza onarim gorevi
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>KPI Tanimlari</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">KPI</th>
                      <th className="text-left p-2">Aciklama</th>
                      <th className="text-left p-2">Hedef</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-2 font-medium">OEE</td>
                      <td className="p-2">Genel Ekipman Verimliligi</td>
                      <td className="p-2">
                        <Badge className="bg-green-500">%85+</Badge>
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 font-medium">MTBF</td>
                      <td className="p-2">Arizalar Arasi Ortalama Sure</td>
                      <td className="p-2">
                        <Badge className="bg-blue-500">Yuksek</Badge>
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 font-medium">MTTR</td>
                      <td className="p-2">Ortalama Onarim Suresi</td>
                      <td className="p-2">
                        <Badge className="bg-yellow-500">Dusuk</Badge>
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium">PM Uyumu</td>
                      <td className="p-2">Planli Bakim Uyum Orani</td>
                      <td className="p-2">
                        <Badge className="bg-green-500">%95+</Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Makineler */}
        <TabsContent value="makineler" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Yeni Makine Ekleme</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="font-medium">Adimlar:</p>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Sag ust kosedeki <Badge variant="outline">+ Yeni Makine</Badge> butonuna tiklayin</li>
                  <li>Acilan formda gerekli alanlari doldurun</li>
                  <li><Badge variant="outline">Kaydet</Badge> butonuna tiklayin</li>
                </ol>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  <strong>Not:</strong> Makine kodu otomatik olarak olusturulur (orn: TZG-001, TZG-002)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kritiklik Seviyeleri (ABC Analizi)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                  <Badge className="bg-red-500">A - Kritik</Badge>
                  <span className="text-sm">Arizalanirsa uretim tamamen durur</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                  <Badge className="bg-yellow-500">B - Onemli</Badge>
                  <span className="text-sm">Arizalanirsa uretim kapasitesi azalir</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <Badge className="bg-green-500">C - Normal</Badge>
                  <span className="text-sm">Alternatif makine mevcut</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Makine Durumlari</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm"><strong>Calisiyor:</strong> Aktif uretimde</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-400" />
                  <span className="text-sm"><strong>Bosta:</strong> Beklemede</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-sm"><strong>Bakimda:</strong> Planli bakim yapiliyor</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm"><strong>Arizali:</strong> Ariza nedeniyle durus</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-sm"><strong>Ayar/Hazirlik:</strong> Setup yapiliyor</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-600" />
                  <span className="text-sm"><strong>Hurdaya Ayrilmis:</strong> Kullanim disi</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bakım Planları */}
        <TabsContent value="planlar" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Bakim Tipleri</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">Koruyucu</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Planli periyodik bakim - Orn: Yag degisimi, filtre temizligi
                  </p>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">Kestirimci</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Durum izleme bazli - Orn: Titresim analizi sonrasi
                  </p>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">Duzeltici</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Ariza sonrasi onarim - Orn: Motor degisimi
                  </p>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">Denetim</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Kontrol/muayene - Orn: Yillik genel kontrol
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Plan Calistirma</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                Bakim zamani geldiginde ilgili planin kartinda <Badge>Calistir</Badge> butonuna tiklayin.
                Sistem otomatik olarak bir is emri olusturur ve sonraki bakim tarihini gunceller.
              </p>
              <div className="p-4 bg-red-50 rounded-lg flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <p className="font-medium text-red-700">Dikkat!</p>
                  <p className="text-sm text-red-600">
                    Kirmizi kenarli kartlar vadesi gecmis bakimlari gosterir.
                    Bu bakimlari en kisa surede gerceklestirin.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Periyot Secenekleri</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <div className="p-2 border rounded">
                  <strong>Gun:</strong> Her X gunde bir (orn: 7 gun = haftalik)
                </div>
                <div className="p-2 border rounded">
                  <strong>Hafta:</strong> Her X haftada bir
                </div>
                <div className="p-2 border rounded">
                  <strong>Ay:</strong> Her X ayda bir
                </div>
                <div className="p-2 border rounded">
                  <strong>Saat:</strong> Her X calisma saatinde bir
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* İş Emirleri */}
        <TabsContent value="isemirleri" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ariza Bildirimi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Is Emirleri sekmesine gecin</li>
                <li><Badge variant="destructive">Ariza Bildir</Badge> butonuna tiklayin</li>
                <li>Formu doldurun ve kaydedin</li>
              </ol>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  "Ariza" tipinde is emri olusturuldigunda makine durumu otomatik olarak "Arizali" yapilir.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Oncelik Seviyeleri</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-red-600">Kritik</Badge>
                  </div>
                  <span className="text-sm">Mudahale: Hemen</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-orange-500">Yuksek</Badge>
                  </div>
                  <span className="text-sm">Mudahale: 4 saat icinde</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-500">Normal</Badge>
                  </div>
                  <span className="text-sm">Mudahale: 24 saat icinde</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-gray-400">Dusuk</Badge>
                  </div>
                  <span className="text-sm">Mudahale: 1 hafta icinde</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Is Emri Akisi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center gap-2 flex-wrap p-4 bg-muted rounded-lg">
                <Badge className="bg-gray-400">ACIK</Badge>
                <span>→</span>
                <Badge className="bg-yellow-500">DEVAM EDIYOR</Badge>
                <span>→</span>
                <Badge className="bg-green-500">TAMAMLANDI</Badge>
                <span>→</span>
                <Badge className="bg-gray-600">KAPANDI</Badge>
              </div>
              <div className="mt-4 grid md:grid-cols-2 gap-3 text-sm">
                <div className="p-2 border rounded">
                  <strong>Acik:</strong> Yeni olusturuldu, henuz baslanmadi
                </div>
                <div className="p-2 border rounded">
                  <strong>Devam Ediyor:</strong> Bakim ekibi calisiyor
                </div>
                <div className="p-2 border rounded">
                  <strong>Beklemede:</strong> Yedek parca, onay vb. bekleniyor
                </div>
                <div className="p-2 border rounded">
                  <strong>Tamamlandi:</strong> Is bitti, onay bekliyor
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* KPI */}
        <TabsContent value="kpi" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>OEE (Genel Ekipman Verimliligi)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg text-center">
                <p className="text-lg font-bold">OEE = Kullanilabilirlik × Performans × Kalite</p>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-3 border rounded-lg text-center">
                  <p className="font-semibold">Kullanilabilirlik (A)</p>
                  <p className="text-sm text-muted-foreground">Calisma Suresi / Planlanan Sure</p>
                  <Badge className="mt-2 bg-green-500">Hedef: %90+</Badge>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <p className="font-semibold">Performans (P)</p>
                  <p className="text-sm text-muted-foreground">Gercek Uretim / Teorik Uretim</p>
                  <Badge className="mt-2 bg-green-500">Hedef: %95+</Badge>
                </div>
                <div className="p-3 border rounded-lg text-center">
                  <p className="font-semibold">Kalite (Q)</p>
                  <p className="text-sm text-muted-foreground">Iyi Urun / Toplam Urun</p>
                  <Badge className="mt-2 bg-green-500">Hedef: %99+</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>OEE Degerlendirmesi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-green-100 rounded-lg">
                  <span className="font-medium">%85+</span>
                  <Badge className="bg-green-600">World Class (Dunya Sinifi)</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-100 rounded-lg">
                  <span className="font-medium">%60-85</span>
                  <Badge className="bg-blue-600">Iyi</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-yellow-100 rounded-lg">
                  <span className="font-medium">%40-60</span>
                  <Badge className="bg-yellow-600">Orta - Iyilestirme Gerekli</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-red-100 rounded-lg">
                  <span className="font-medium">%40 alti</span>
                  <Badge className="bg-red-600">Dusuk - Acil Eylem Gerekli</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>MTBF ve MTTR</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    MTBF
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Toplam Calisma Suresi / Ariza Sayisi
                  </p>
                  <p className="text-sm mt-2">
                    <strong>Iyilestirme:</strong> Artirilmali (daha uzun sure arizasiz calisma)
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    MTTR
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Toplam Onarim Suresi / Onarim Sayisi
                  </p>
                  <p className="text-sm mt-2">
                    <strong>Iyilestirme:</strong> Azaltilmali (daha hizli onarim)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Print All Content */}
      <style jsx global>{`
        @media print {
          /* Ana sayfa elemanlarını gizle */
          body > * {
            visibility: hidden;
          }

          /* Print container'ı göster */
          .guide-print-container,
          .guide-print-container * {
            visibility: visible !important;
          }

          .guide-print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }

          /* Her sayfa için page break */
          .guide-print-page {
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            min-height: 250mm;
            padding: 10mm;
            box-sizing: border-box;
          }

          .guide-print-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          /* Tabloları düzgün göster */
          table {
            border-collapse: collapse !important;
          }

          th, td {
            border: 1px solid #333 !important;
            padding: 6px !important;
          }

          /* Sidebar ve header'ı gizle */
          nav, aside, header, [data-sidebar] {
            display: none !important;
          }
        }

        /* Ekranda gizle, sadece print'te göster */
        .guide-print-container {
          display: none;
        }

        @media print {
          .guide-print-container {
            display: block !important;
          }

          .guide-screen-only {
            display: none !important;
          }
        }
      `}</style>
      <div className="guide-print-container">
        {/* Kapak Sayfası */}
        <div className="guide-print-page" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '20px' }}>Tezgah Bakim Yonetimi</h1>
          <h2 style={{ fontSize: '24px', marginBottom: '40px' }}>Kullanim Kilavuzu</h2>
          <p style={{ fontSize: '14px', color: '#666' }}>ILERIHub | Versiyon 1.0 | Ocak 2026</p>
          <div style={{ marginTop: '60px', fontSize: '12px', color: '#888' }}>
            <p>Ileri Group</p>
            <p>System Development Team</p>
          </div>
        </div>

        {/* Sayfa 1 - Giris */}
        <div className="guide-print-page">
          <h2 className="text-2xl font-bold mb-4 border-b-2 border-gray-300 pb-2">1. Giris</h2>
          <p className="mb-4">
            Tezgah Bakim Yonetimi modulu, fabrikadaki tum makine ve tezgahlarin
            bakim sureclerini dijital ortamda yonetmenizi saglar.
          </p>
          <h3 className="text-lg font-semibold mb-2 mt-6">Bu modul ile yapabilecekleriniz:</h3>
          <ul className="list-disc list-inside mb-4 space-y-1">
            <li>Makine envanterinizi takip edebilirsiniz</li>
            <li>Periyodik bakim planlari olusturabilirsiniz</li>
            <li>Ariza bildirimlerini kayit altina alabilirsiniz</li>
            <li>Is emirlerini yonetebilirsiniz</li>
            <li>Bakim performansinizi KPI'larla olcebilirsiniz</li>
          </ul>
          <h3 className="text-lg font-semibold mb-2 mt-6">Yetkili Roller:</h3>
          <ul className="list-disc list-inside mb-4 space-y-1">
            <li>Quality Manager (Kalite Yoneticisi)</li>
            <li>Admin (Yonetici)</li>
            <li>Super Admin (Super Yonetici)</li>
          </ul>
          <h3 className="text-lg font-semibold mb-2 mt-6">Temel Kavramlar:</h3>
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-2 text-left">Kavram</th>
                <th className="border border-gray-300 p-2 text-left">Aciklama</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 p-2 font-medium">Makine</td>
                <td className="border border-gray-300 p-2">Uretimde kullanilan tezgah, ekipman veya cihaz</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2 font-medium">Bakim Plani</td>
                <td className="border border-gray-300 p-2">Periyodik olarak yapilmasi gereken bakim tanimi</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2 font-medium">Is Emri</td>
                <td className="border border-gray-300 p-2">Tek seferlik bakim veya ariza onarim gorevi</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2 font-medium">OEE</td>
                <td className="border border-gray-300 p-2">Genel Ekipman Verimliligi (Overall Equipment Effectiveness)</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2 font-medium">MTBF</td>
                <td className="border border-gray-300 p-2">Arizalar Arasi Ortalama Sure (Mean Time Between Failures)</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2 font-medium">MTTR</td>
                <td className="border border-gray-300 p-2">Ortalama Onarim Suresi (Mean Time To Repair)</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Sayfa 2 - Makineler */}
        <div className="guide-print-page">
          <h2 className="text-2xl font-bold mb-4 border-b-2 border-gray-300 pb-2">2. Makineler</h2>

          <h3 className="text-lg font-semibold mb-2">Yeni Makine Ekleme:</h3>
          <ol className="list-decimal list-inside mb-4 space-y-1">
            <li>Sag ust kosedeki "+ Yeni Makine" butonuna tiklayin</li>
            <li>Acilan formda gerekli alanlari doldurun</li>
            <li>"Kaydet" butonuna tiklayin</li>
          </ol>
          <p className="text-sm italic mb-4">Not: Makine kodu otomatik olarak olusturulur (orn: TZG-001, TZG-002)</p>

          <h3 className="text-lg font-semibold mb-2 mt-6">Kritiklik Seviyeleri (ABC Analizi):</h3>
          <table className="w-full border-collapse border border-gray-300 text-sm mb-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-2 text-left">Seviye</th>
                <th className="border border-gray-300 p-2 text-left">Anlami</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 p-2 font-medium">A - Kritik</td>
                <td className="border border-gray-300 p-2">Arizalanirsa uretim tamamen durur</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2 font-medium">B - Onemli</td>
                <td className="border border-gray-300 p-2">Arizalanirsa uretim kapasitesi azalir</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2 font-medium">C - Normal</td>
                <td className="border border-gray-300 p-2">Alternatif makine mevcut</td>
              </tr>
            </tbody>
          </table>

          <h3 className="text-lg font-semibold mb-2 mt-6">Makine Durumlari:</h3>
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-2 text-left">Durum</th>
                <th className="border border-gray-300 p-2 text-left">Anlami</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="border border-gray-300 p-2">Calisiyor</td><td className="border border-gray-300 p-2">Aktif uretimde</td></tr>
              <tr><td className="border border-gray-300 p-2">Bosta</td><td className="border border-gray-300 p-2">Beklemede</td></tr>
              <tr><td className="border border-gray-300 p-2">Bakimda</td><td className="border border-gray-300 p-2">Planli bakim yapiliyor</td></tr>
              <tr><td className="border border-gray-300 p-2">Arizali</td><td className="border border-gray-300 p-2">Ariza nedeniyle durus</td></tr>
              <tr><td className="border border-gray-300 p-2">Ayar/Hazirlik</td><td className="border border-gray-300 p-2">Setup yapiliyor</td></tr>
              <tr><td className="border border-gray-300 p-2">Hurdaya Ayrilmis</td><td className="border border-gray-300 p-2">Kullanim disi</td></tr>
            </tbody>
          </table>
        </div>

        {/* Sayfa 3 - Bakim Planlari */}
        <div className="guide-print-page">
          <h2 className="text-2xl font-bold mb-4 border-b-2 border-gray-300 pb-2">3. Bakim Planlari</h2>

          <h3 className="text-lg font-semibold mb-2">Bakim Tipleri:</h3>
          <table className="w-full border-collapse border border-gray-300 text-sm mb-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-2 text-left">Tip</th>
                <th className="border border-gray-300 p-2 text-left">Aciklama</th>
                <th className="border border-gray-300 p-2 text-left">Ornek</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 p-2 font-medium">Koruyucu</td>
                <td className="border border-gray-300 p-2">Planli periyodik bakim</td>
                <td className="border border-gray-300 p-2">Yag degisimi, filtre temizligi</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2 font-medium">Kestirimci</td>
                <td className="border border-gray-300 p-2">Durum izleme bazli</td>
                <td className="border border-gray-300 p-2">Titresim analizi sonrasi</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2 font-medium">Duzeltici</td>
                <td className="border border-gray-300 p-2">Ariza sonrasi onarim</td>
                <td className="border border-gray-300 p-2">Motor degisimi</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2 font-medium">Acil</td>
                <td className="border border-gray-300 p-2">Kritik ariza</td>
                <td className="border border-gray-300 p-2">Ani durus</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2 font-medium">Denetim</td>
                <td className="border border-gray-300 p-2">Kontrol/muayene</td>
                <td className="border border-gray-300 p-2">Yillik genel kontrol</td>
              </tr>
            </tbody>
          </table>

          <h3 className="text-lg font-semibold mb-2 mt-6">Periyot Secenekleri:</h3>
          <ul className="list-disc list-inside mb-4 space-y-1">
            <li><strong>Gun:</strong> Her X gunde bir (orn: 7 gun = haftalik)</li>
            <li><strong>Hafta:</strong> Her X haftada bir</li>
            <li><strong>Ay:</strong> Her X ayda bir</li>
            <li><strong>Saat:</strong> Her X calisma saatinde bir</li>
            <li><strong>Cevrim:</strong> Her X uretim cevriminde bir</li>
          </ul>

          <h3 className="text-lg font-semibold mb-2 mt-6">Plan Calistirma:</h3>
          <p className="mb-2">Bakim zamani geldiginde ilgili planin kartinda "Calistir" butonuna tiklayin.</p>
          <p className="mb-2">Sistem otomatik olarak bir is emri olusturur ve sonraki bakim tarihini gunceller.</p>
          <p className="font-semibold text-red-600 mt-4">DIKKAT: Kirmizi kenarli kartlar vadesi gecmis bakimlari gosterir!</p>
        </div>

        {/* Sayfa 4 - Is Emirleri */}
        <div className="guide-print-page">
          <h2 className="text-2xl font-bold mb-4 border-b-2 border-gray-300 pb-2">4. Is Emirleri</h2>

          <h3 className="text-lg font-semibold mb-2">Ariza Bildirimi:</h3>
          <ol className="list-decimal list-inside mb-4 space-y-1">
            <li>"Is Emirleri" sekmesine gecin</li>
            <li>"Ariza Bildir" butonuna tiklayin (kirmizi buton)</li>
            <li>Formu doldurun ve kaydedin</li>
          </ol>
          <p className="text-sm italic mb-4">Not: "Ariza" tipinde is emri olusturuldigunda makine durumu otomatik olarak "Arizali" yapilir.</p>

          <h3 className="text-lg font-semibold mb-2 mt-6">Oncelik Seviyeleri:</h3>
          <table className="w-full border-collapse border border-gray-300 text-sm mb-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-2 text-left">Oncelik</th>
                <th className="border border-gray-300 p-2 text-left">Mudahale Suresi</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="border border-gray-300 p-2 font-medium">Kritik</td><td className="border border-gray-300 p-2">Hemen</td></tr>
              <tr><td className="border border-gray-300 p-2 font-medium">Yuksek</td><td className="border border-gray-300 p-2">4 saat icinde</td></tr>
              <tr><td className="border border-gray-300 p-2 font-medium">Normal</td><td className="border border-gray-300 p-2">24 saat icinde</td></tr>
              <tr><td className="border border-gray-300 p-2 font-medium">Dusuk</td><td className="border border-gray-300 p-2">1 hafta icinde</td></tr>
            </tbody>
          </table>

          <h3 className="text-lg font-semibold mb-2 mt-6">Is Emri Akisi:</h3>
          <div className="p-4 bg-gray-100 rounded text-center mb-4">
            <p className="font-mono">ACIK → DEVAM EDIYOR → TAMAMLANDI → KAPANDI</p>
          </div>
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-2 text-left">Durum</th>
                <th className="border border-gray-300 p-2 text-left">Aciklama</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="border border-gray-300 p-2">Acik</td><td className="border border-gray-300 p-2">Yeni olusturuldu, henuz baslanmadi</td></tr>
              <tr><td className="border border-gray-300 p-2">Devam Ediyor</td><td className="border border-gray-300 p-2">Bakim ekibi calisiyor</td></tr>
              <tr><td className="border border-gray-300 p-2">Beklemede</td><td className="border border-gray-300 p-2">Yedek parca, onay vb. bekleniyor</td></tr>
              <tr><td className="border border-gray-300 p-2">Tamamlandi</td><td className="border border-gray-300 p-2">Is bitti, onay bekliyor</td></tr>
              <tr><td className="border border-gray-300 p-2">Kapandi</td><td className="border border-gray-300 p-2">Tamamen tamamlandi</td></tr>
            </tbody>
          </table>
        </div>

        {/* Sayfa 5 - KPI Metrikleri */}
        <div className="guide-print-page">
          <h2 className="text-2xl font-bold mb-4 border-b-2 border-gray-300 pb-2">5. KPI Metrikleri</h2>

          <h3 className="text-lg font-semibold mb-2">OEE (Genel Ekipman Verimliligi):</h3>
          <div className="p-4 bg-gray-100 rounded text-center mb-4">
            <p className="text-lg font-bold">OEE = Kullanilabilirlik × Performans × Kalite</p>
          </div>

          <table className="w-full border-collapse border border-gray-300 text-sm mb-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-2 text-left">Bilesen</th>
                <th className="border border-gray-300 p-2 text-left">Hesaplama</th>
                <th className="border border-gray-300 p-2 text-left">Hedef</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 p-2 font-medium">Kullanilabilirlik (A)</td>
                <td className="border border-gray-300 p-2">Calisma Suresi / Planlanan Sure</td>
                <td className="border border-gray-300 p-2">%90+</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2 font-medium">Performans (P)</td>
                <td className="border border-gray-300 p-2">Gercek Uretim / Teorik Uretim</td>
                <td className="border border-gray-300 p-2">%95+</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2 font-medium">Kalite (Q)</td>
                <td className="border border-gray-300 p-2">Iyi Urun / Toplam Urun</td>
                <td className="border border-gray-300 p-2">%99+</td>
              </tr>
            </tbody>
          </table>

          <h3 className="text-lg font-semibold mb-2 mt-6">OEE Degerlendirmesi:</h3>
          <table className="w-full border-collapse border border-gray-300 text-sm mb-4">
            <tbody>
              <tr><td className="border border-gray-300 p-2 font-medium">%85+</td><td className="border border-gray-300 p-2">World Class (Dunya Sinifi)</td></tr>
              <tr><td className="border border-gray-300 p-2 font-medium">%60-85</td><td className="border border-gray-300 p-2">Iyi</td></tr>
              <tr><td className="border border-gray-300 p-2 font-medium">%40-60</td><td className="border border-gray-300 p-2">Orta - Iyilestirme Gerekli</td></tr>
              <tr><td className="border border-gray-300 p-2 font-medium">%40 alti</td><td className="border border-gray-300 p-2">Dusuk - Acil Eylem Gerekli</td></tr>
            </tbody>
          </table>

          <h3 className="text-lg font-semibold mb-2 mt-6">MTBF ve MTTR:</h3>
          <table className="w-full border-collapse border border-gray-300 text-sm mb-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-2 text-left">Metrik</th>
                <th className="border border-gray-300 p-2 text-left">Formul</th>
                <th className="border border-gray-300 p-2 text-left">Iyilestirme</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 p-2 font-medium">MTBF</td>
                <td className="border border-gray-300 p-2">Toplam Calisma Suresi / Ariza Sayisi</td>
                <td className="border border-gray-300 p-2">Artirilmali</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2 font-medium">MTTR</td>
                <td className="border border-gray-300 p-2">Toplam Onarim Suresi / Onarim Sayisi</td>
                <td className="border border-gray-300 p-2">Azaltilmali</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-8 pt-4 border-t border-gray-300 text-center text-sm text-gray-500">
            <p>ILERIHub - Tezgah Bakim Yonetimi Kilavuzu</p>
            <p>Versiyon 1.0 | Ocak 2026</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Card className="guide-screen-only">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <HelpCircle className="h-4 w-4" />
              Sorulariniz icin IT Destek'e ticket acabilirsiniz
            </div>
            <div className="text-sm text-muted-foreground">
              Versiyon 1.0 | Ocak 2026
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

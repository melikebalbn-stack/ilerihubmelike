import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import * as XLSX from "xlsx"

// GET - Bilgisayar envanteri Excel sablonu indir
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erisim" }, { status: 401 })
    }

    // Ornek satirlar
    const sampleData = [
      {
        "Bilgisayar Adi": "PC-MUHASEBE-01",
        "Marka": "Dell",
        "Model": "OptiPlex 7090",
        "Seri No": "ABC123456",
        "IP Adresi": "192.168.1.101",
        "MAC Adresi": "AA:BB:CC:DD:EE:01",
        "Isletim Sistemi": "Windows 11 Pro",
        "Islemci": "Intel Core i7-12700",
        "RAM": "16 GB",
        "Disk": "512 GB SSD",
        "Barkod": "BRK-001",
        "Departman": "Muhasebe",
        "Konum": "A Blok 2. Kat",
        "Kullanici": "Ahmet Yilmaz",
        "Email": "ahmet.yilmaz@ilerigroup.com",
        "Garanti Bitis": "31.12.2027",
        "Not": "",
      },
      {
        "Bilgisayar Adi": "NB-IT-01",
        "Marka": "Lenovo",
        "Model": "ThinkPad T14 Gen 3",
        "Seri No": "XYZ789012",
        "IP Adresi": "192.168.1.150",
        "MAC Adresi": "AA:BB:CC:DD:EE:02",
        "Isletim Sistemi": "Windows 11 Pro",
        "Islemci": "Intel Core i5-1245U",
        "RAM": "16 GB",
        "Disk": "256 GB SSD",
        "Barkod": "BRK-002",
        "Departman": "Bilgi Islem",
        "Konum": "A Blok 3. Kat",
        "Kullanici": "Mehmet Kaya",
        "Email": "mehmet.kaya@ilerigroup.com",
        "Garanti Bitis": "15.06.2028",
        "Not": "Notebook - dizustu bilgisayar",
      },
      {
        "Bilgisayar Adi": "PC-URETIM-01",
        "Marka": "HP",
        "Model": "ProDesk 400 G9",
        "Seri No": "DEF345678",
        "IP Adresi": "192.168.2.10",
        "MAC Adresi": "AA:BB:CC:DD:EE:03",
        "Isletim Sistemi": "Windows 10 Pro",
        "Islemci": "Intel Core i5-12500",
        "RAM": "8 GB",
        "Disk": "256 GB SSD",
        "Barkod": "BRK-003",
        "Departman": "Uretim",
        "Konum": "B Blok 1. Kat",
        "Kullanici": "Ayse Demir",
        "Email": "ayse.demir@ilerigroup.com",
        "Garanti Bitis": "01.03.2026",
        "Not": "",
      },
    ]

    const ws = XLSX.utils.json_to_sheet(sampleData)

    // Kolon genislikleri
    ws["!cols"] = [
      { wch: 20 }, // Bilgisayar Adi
      { wch: 12 }, // Marka
      { wch: 22 }, // Model
      { wch: 15 }, // Seri No
      { wch: 15 }, // IP
      { wch: 18 }, // MAC
      { wch: 18 }, // OS
      { wch: 22 }, // Islemci
      { wch: 8 },  // RAM
      { wch: 12 }, // Disk
      { wch: 10 }, // Barkod
      { wch: 15 }, // Departman
      { wch: 18 }, // Konum
      { wch: 20 }, // Kullanici
      { wch: 30 }, // Email
      { wch: 12 }, // Garanti
      { wch: 25 }, // Not
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Bilgisayar Envanteri")

    // Aciklama sayfasi
    const helpData = [
      { "Kolon": "Bilgisayar Adi", "Aciklama": "PC/Notebook hostname (orn: PC-MUHASEBE-01)", "Zorunlu": "Evet" },
      { "Kolon": "Marka", "Aciklama": "Uretici (Dell, HP, Lenovo vb.)", "Zorunlu": "Hayir" },
      { "Kolon": "Model", "Aciklama": "Cihaz modeli (orn: OptiPlex 7090)", "Zorunlu": "Hayir" },
      { "Kolon": "Seri No", "Aciklama": "Uretici seri numarasi", "Zorunlu": "Hayir" },
      { "Kolon": "IP Adresi", "Aciklama": "Atanan IP adresi", "Zorunlu": "Hayir" },
      { "Kolon": "MAC Adresi", "Aciklama": "Ag karti MAC adresi", "Zorunlu": "Hayir" },
      { "Kolon": "Isletim Sistemi", "Aciklama": "Windows 10/11, Linux vb.", "Zorunlu": "Hayir" },
      { "Kolon": "Islemci", "Aciklama": "CPU modeli", "Zorunlu": "Hayir" },
      { "Kolon": "RAM", "Aciklama": "Bellek miktari (orn: 16 GB)", "Zorunlu": "Hayir" },
      { "Kolon": "Disk", "Aciklama": "Disk kapasitesi (orn: 512 GB SSD)", "Zorunlu": "Hayir" },
      { "Kolon": "Barkod", "Aciklama": "Demirbasinize ait barkod numarasi", "Zorunlu": "Hayir" },
      { "Kolon": "Departman", "Aciklama": "Cihazin bulundugu departman", "Zorunlu": "Hayir" },
      { "Kolon": "Konum", "Aciklama": "Fiziksel konum (orn: A Blok 2. Kat)", "Zorunlu": "Hayir" },
      { "Kolon": "Kullanici", "Aciklama": "Cihazi kullanan kisinin ad soyadi", "Zorunlu": "Hayir" },
      { "Kolon": "Email", "Aciklama": "Kullanicinin e-posta adresi", "Zorunlu": "Hayir" },
      { "Kolon": "Garanti Bitis", "Aciklama": "Garanti bitis tarihi (GG.AA.YYYY)", "Zorunlu": "Hayir" },
      { "Kolon": "Not", "Aciklama": "Ek aciklama veya notlar", "Zorunlu": "Hayir" },
    ]

    const wsHelp = XLSX.utils.json_to_sheet(helpData)
    wsHelp["!cols"] = [{ wch: 18 }, { wch: 45 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, wsHelp, "Aciklama")

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" })

    return new NextResponse(excelBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="BilgisayarEnvanteri_Sablon.xlsx"',
      },
    })
  } catch (error) {
    console.error("Sablon olusturma hatasi:", error)
    return NextResponse.json({ error: "Sablon olusturulamadi" }, { status: 500 })
  }
}

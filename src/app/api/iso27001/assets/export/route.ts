import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"
import { requireSession } from "@/lib/auth/require-session"

const CATEGORY_LABELS: Record<string, string> = {
  INFORMATION: "Bilgi",
  SOFTWARE: "Yazilim",
  HARDWARE: "Donanim",
  NETWORK: "Ag",
  PERSONNEL: "Personel",
  PHYSICAL: "Fiziksel",
  SERVICE: "Hizmet",
  INTANGIBLE: "Soyut",
}

const CRITICALITY_LABELS: Record<string, string> = {
  CRITICAL: "Kritik",
  HIGH: "Yuksek",
  MEDIUM: "Orta",
  LOW: "Dusuk",
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktif",
  INACTIVE: "Pasif",
  UNDER_MAINTENANCE: "Bakimda",
  DISPOSED: "Imha Edildi",
  LOST: "Kayip",
}

const CLASSIFICATION_LABELS: Record<string, string> = {
  PUBLIC: "Genel",
  INTERNAL: "Dahili",
  CONFIDENTIAL: "Gizli",
  RESTRICTED: "Kisitli",
}

export async function GET() {
  try {
    // PR-Y2.5-iso27001-B: requireSession (read-only export)
    const { error } = await requireSession()
    if (error) return error

    const assets = await prisma.iso27001Asset.findMany({
      include: {
        owner: { select: { name: true, email: true } },
        custodian: { select: { name: true, email: true } },
      },
      orderBy: { assetNumber: "asc" },
    })

    // Varlik Envanteri sayfasi
    const assetData = assets.map((a) => ({
      "Varlik No": a.assetNumber,
      "Ad": a.name,
      "Aciklama": a.description || "",
      "Kategori": CATEGORY_LABELS[a.category] || a.category,
      "Tur": a.type,
      "Konum": a.location || "",
      "Departman": a.department || "",
      "Sahip": a.owner?.name || "",
      "Sahip Email": a.owner?.email || "",
      "Sorumlu": a.custodian?.name || "",
      "Gizlilik (C)": a.confidentiality,
      "Butunluk (I)": a.integrity,
      "Erisilebilirlik (A)": a.availability,
      "Toplam Deger": a.assetValue || 0,
      "Kritiklik": CRITICALITY_LABELS[a.criticality] || a.criticality,
      "Siniflandirma": CLASSIFICATION_LABELS[a.classification] || a.classification,
      "Durum": STATUS_LABELS[a.status] || a.status,
      "Uretici": a.manufacturer || "",
      "Model": a.model || "",
      "Seri No": a.serialNumber || "",
      "Hostname": a.hostname || "",
      "IP Adresi": a.ipAddress || "",
      "MAC Adresi": a.macAddress || "",
      "Isletim Sistemi": a.operatingSystem || "",
      "Islemci": a.processor || "",
      "RAM": a.ram || "",
      "Disk": a.diskSize || "",
      "Barkod": a.barcode || "",
      "Garanti Bitis": a.warrantyEndDate ? new Date(a.warrantyEndDate).toLocaleDateString("tr-TR") : "",
      "Atanan Kisi": a.assignedTo || "",
      "Atanan Email": a.assignedToEmail || "",
      "Notlar": a.notes || "",
      "Olusturma Tarihi": new Date(a.createdAt).toLocaleDateString("tr-TR"),
    }))

    const ws1 = XLSX.utils.json_to_sheet(assetData)

    // Kolon genislikleri
    ws1["!cols"] = [
      { wch: 12 }, // Varlik No
      { wch: 30 }, // Ad
      { wch: 30 }, // Aciklama
      { wch: 12 }, // Kategori
      { wch: 15 }, // Tur
      { wch: 15 }, // Konum
      { wch: 15 }, // Departman
      { wch: 20 }, // Sahip
      { wch: 25 }, // Sahip Email
      { wch: 20 }, // Sorumlu
      { wch: 10 }, // C
      { wch: 10 }, // I
      { wch: 10 }, // A
      { wch: 10 }, // Toplam
      { wch: 10 }, // Kritiklik
      { wch: 12 }, // Siniflandirma
      { wch: 10 }, // Durum
      { wch: 15 }, // Uretici
      { wch: 15 }, // Model
      { wch: 15 }, // Seri No
      { wch: 15 }, // Hostname
      { wch: 15 }, // IP
      { wch: 18 }, // MAC
      { wch: 15 }, // OS
      { wch: 20 }, // CPU
      { wch: 10 }, // RAM
      { wch: 10 }, // Disk
      { wch: 15 }, // Barkod
      { wch: 12 }, // Garanti
      { wch: 20 }, // Atanan
      { wch: 25 }, // Atanan Email
      { wch: 30 }, // Notlar
      { wch: 12 }, // Olusturma
    ]

    // Istatistikler sayfasi
    const statsData = [
      { "Metrik": "Toplam Varlik", "Deger": assets.length },
      { "Metrik": "", "Deger": "" },
      { "Metrik": "--- Kategoriye Gore ---", "Deger": "" },
      ...Object.entries(CATEGORY_LABELS).map(([key, label]) => ({
        "Metrik": label,
        "Deger": assets.filter((a) => a.category === key).length,
      })),
      { "Metrik": "", "Deger": "" },
      { "Metrik": "--- Kritiklige Gore ---", "Deger": "" },
      ...Object.entries(CRITICALITY_LABELS).map(([key, label]) => ({
        "Metrik": label,
        "Deger": assets.filter((a) => a.criticality === key).length,
      })),
      { "Metrik": "", "Deger": "" },
      { "Metrik": "--- Duruma Gore ---", "Deger": "" },
      ...Object.entries(STATUS_LABELS).map(([key, label]) => ({
        "Metrik": label,
        "Deger": assets.filter((a) => a.status === key).length,
      })),
      { "Metrik": "", "Deger": "" },
      { "Metrik": "Gozden Gecirme Bekleyen", "Deger": assets.filter((a) => a.nextReviewDate && new Date(a.nextReviewDate) < new Date()).length },
    ]

    const ws2 = XLSX.utils.json_to_sheet(statsData)
    ws2["!cols"] = [{ wch: 25 }, { wch: 10 }]

    // Workbook olustur
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws1, "Varlik Envanteri")
    XLSX.utils.book_append_sheet(wb, ws2, "Istatistikler")

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" })
    const date = new Date().toISOString().split("T")[0]

    return new NextResponse(excelBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="ISO27001_Varlik_Envanteri_${date}.xlsx"`,
      },
    })
  } catch (error) {
    console.error("Varlik export hatasi:", error)
    return NextResponse.json({ error: "Export islemi basarisiz" }, { status: 500 })
  }
}

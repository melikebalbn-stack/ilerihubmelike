"use client"

// "Şemada Yeri Olmayan" kartına tıklanınca açılan liste modalı.
// Veri SUNUCUDAN gelir (org-chart GET → koltuksuzPersonel, yalnız hasFullAccess).
// Bu bileşen salt gösterim; fetch/hesap yapmaz.

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export interface KoltuksuzPersonel {
  id: string
  sicilNo: string | null
  adSoyad: string
  bolum: string
  gorev: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  personeller: KoltuksuzPersonel[]
}

export default function KoltuksuzPersonelModal({ open, onOpenChange, personeller }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Semada Yeri Olmayan Personel ({personeller.length})</DialogTitle>
          <DialogDescription>
            Aktif olup organizasyon semasinda koltugu bulunmayan personel. Bir pozisyon
            kutusundan &quot;Uye Ata&quot; ile elle baglanabilir.
          </DialogDescription>
        </DialogHeader>

        {personeller.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Tum aktif personelin semada yeri var.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto rounded-md border">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Sicil</TableHead>
                  <TableHead>Ad Soyad</TableHead>
                  <TableHead>Bolum</TableHead>
                  <TableHead>Gorev</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {personeller.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono">{p.sicilNo || "-"}</TableCell>
                    <TableCell className="font-medium">{p.adSoyad}</TableCell>
                    <TableCell className="text-muted-foreground">{p.bolum}</TableCell>
                    <TableCell>{p.gorev}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

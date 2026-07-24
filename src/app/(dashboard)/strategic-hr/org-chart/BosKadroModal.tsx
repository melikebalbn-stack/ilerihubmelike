"use client"

// "Boş Pozisyon" kartına tıklanınca açılan liste modalı. Veri page.tsx'te
// hesaplanan bosKadrolar dizisinden gelir (bosPozisyonSayisi ile AYNI filtre —
// tek kaynak, kopya mantık yok). Bu bileşen salt gösterim; fetch/hesap yapmaz.

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

export interface BosKadro {
  id: string
  bolum: string
  pozisyon: string
  acikKadro: number
  vekaletDurumu: boolean
  vekilAdi: string | null
}

interface BosKadroModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bosKadrolar: BosKadro[]
  toplamAcikKadro: number
}

export default function BosKadroModal({
  open,
  onOpenChange,
  bosKadrolar,
  toplamAcikKadro,
}: BosKadroModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{toplamAcikKadro} Açık Kadro</DialogTitle>
          <DialogDescription>Bölüm ve pozisyon bazında açık (boş) kadro listesi</DialogDescription>
        </DialogHeader>

        {bosKadrolar.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Açık kadro yok</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bölüm</TableHead>
                <TableHead>Pozisyon</TableHead>
                <TableHead className="text-center">Açık Kadro</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bosKadrolar.map((k) => (
                <TableRow key={k.id}>
                  <TableCell>{k.bolum}</TableCell>
                  <TableCell>{k.pozisyon}</TableCell>
                  <TableCell className="text-center">{k.acikKadro}</TableCell>
                  <TableCell>
                    {k.vekaletDurumu ? (
                      <span className="text-red-600 italic">Vekaleten: {k.vekilAdi || "(atanmadı)"}</span>
                    ) : (
                      <span className="text-amber-600">Boş</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  )
}

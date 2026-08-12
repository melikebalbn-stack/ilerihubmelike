'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DurumBadge } from './DurumBadge'
import { ONCELIK_META, PERIYOT_META } from './constants'
import { getAnaSorumluAdi, type YillikTakvimKaydiRow } from './types'

function tarih(value: string | null): string {
  return value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : '—'
}

export function YillikTakvimListView({ rows, onRowClick }: { rows: YillikTakvimKaydiRow[]; onRowClick: (id: string) => void }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Ana Konu</TableHead><TableHead>Süreç</TableHead><TableHead>Sorumlu</TableHead>
          <TableHead>Departman</TableHead><TableHead>Periyot</TableHead><TableHead>Öncelik</TableHead>
          <TableHead>Son Tarih</TableHead><TableHead>Durum</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.map(row => <TableRow key={row.id} className={`cursor-pointer ${row.iptalMi ? 'opacity-50' : ''}`} onClick={() => onRowClick(row.id)}>
            <TableCell className="font-medium">{row.anaKonu}</TableCell>
            <TableCell>{row.kisaBaslik || row.surec}</TableCell>
            <TableCell>{getAnaSorumluAdi(row)}</TableCell><TableCell>{row.department?.name ?? '—'}</TableCell>
            <TableCell>{PERIYOT_META[row.periyot]}</TableCell><TableCell>{ONCELIK_META[row.oncelik]}</TableCell>
            <TableCell>{tarih(row.nihaiSonTarih)}</TableCell><TableCell><DurumBadge durum={row.durum} /></TableCell>
          </TableRow>)}
        </TableBody>
      </Table>
    </div>
  )
}

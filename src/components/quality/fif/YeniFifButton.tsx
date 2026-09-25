'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * "Yeni FİF" — forma götürür, KAYIT AÇMAZ (FAZ B).
 * Eskiden burada POST vardı: butona basan herkes boş bir TASLAK ve bir kayıt
 * numarası yakıyordu. Kayıt artık formda "Kaydet" ile oluşur.
 */
export function YeniFifButton() {
  return (
    <Button asChild className="bg-[#1B4F72] hover:bg-[#1B4F72]/90 shrink-0">
      <Link href="/kalite/fif/yeni" className="inline-flex items-center gap-1">
        <Plus className="h-4 w-4 shrink-0" />
        Yeni FİF
      </Link>
    </Button>
  )
}

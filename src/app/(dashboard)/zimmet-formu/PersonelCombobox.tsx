'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cokluAlandaAra } from '@/lib/zimmet/arama'
import type { PersonelHit } from './useZimmetFormu'

interface PersonelComboboxProps {
  personelListesi: PersonelHit[]
  value: string
  onSelect: (personelId: string) => void
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
}

function altBaslik(p: PersonelHit): string {
  return [p.jobTitle, p.department, p.employeeId ? `Sicil: ${p.employeeId}` : null]
    .filter(Boolean)
    .join(' · ')
}

export function PersonelCombobox({
  personelListesi,
  value,
  onSelect,
  placeholder = 'Personel seçin',
  emptyText = 'Personel bulunamadı.',
  disabled = false,
  className,
}: PersonelComboboxProps) {
  const [open, setOpen] = useState(false)
  const [arama, setArama] = useState('')

  const secilen = personelListesi.find((p) => p.id === value)

  const filtrelenmis = useMemo(
    () =>
      personelListesi.filter((p) =>
        cokluAlandaAra([p.name, p.email, p.jobTitle, p.department, p.employeeId], arama)
      ),
    [personelListesi, arama]
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !secilen && 'text-muted-foreground',
            className
          )}
        >
          {secilen ? (
            <span className="flex items-center gap-2 truncate">
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{secilen.name ?? secilen.email}</span>
            </span>
          ) : (
            <span>{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="İsim, ünvan veya bölüm ile ara..."
            value={arama}
            onValueChange={setArama}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {filtrelenmis.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={() => {
                    onSelect(p.id)
                    setArama('')
                    setOpen(false)
                  }}
                  className="flex items-center gap-2"
                >
                  <Check className={cn('h-4 w-4', p.id === value ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate">{p.name ?? p.email}</span>
                    {altBaslik(p) && (
                      <span className="text-xs text-muted-foreground truncate">{altBaslik(p)}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

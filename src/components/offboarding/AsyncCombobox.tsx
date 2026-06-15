'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

/**
 * Generic async arama-seçici (shadcn Popover + Command).
 * user-search-combobox.tsx idiomuna birebir analog; debounce'lu fetch.
 *
 * T: en az { id: string } içeren kayıt tipi. Seçim parent'ta tutulur (value),
 * onSelect ile tüm kayıt geri verilir (örn. personel autofill için).
 */
interface AsyncComboboxProps<T extends { id: string }> {
  value: T | null
  onSelect: (item: T | null) => void
  fetcher: (query: string) => Promise<T[]>
  getPrimary: (item: T) => string
  getSecondary?: (item: T) => string | null
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
  className?: string
}

export function AsyncCombobox<T extends { id: string }>({
  value,
  onSelect,
  fetcher,
  getPrimary,
  getSecondary,
  placeholder = 'Seçin...',
  disabled = false,
  clearable = true,
  className,
}: AsyncComboboxProps<T>) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [items, setItems] = React.useState<T[]>([])
  const [loading, setLoading] = React.useState(false)
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null)

  const runFetch = React.useCallback(
    async (q: string) => {
      setLoading(true)
      try {
        const data = await fetcher(q)
        setItems(data)
      } catch {
        setItems([])
      } finally {
        setLoading(false)
      }
    },
    [fetcher],
  )

  React.useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runFetch(search), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, open, runFetch])

  React.useEffect(() => {
    if (open && items.length === 0) runFetch('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function handleSelect(item: T) {
    onSelect(item)
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground', className)}
        >
          <span className="truncate">{value ? getPrimary(value) : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder="Ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin opacity-50" />}
          </div>
          <CommandList>
            {!loading && items.length === 0 && <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>}
            <CommandGroup>
              {clearable && value && (
                <CommandItem onSelect={() => { onSelect(null); setOpen(false); setSearch('') }} className="text-muted-foreground">
                  Seçimi temizle
                </CommandItem>
              )}
              {items.map((item) => {
                const secondary = getSecondary?.(item)
                return (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => handleSelect(item)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Check className={cn('h-4 w-4', value?.id === item.id ? 'opacity-100' : 'opacity-0')} />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-medium truncate">{getPrimary(item)}</span>
                      {secondary && <span className="text-xs text-muted-foreground truncate">{secondary}</span>}
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

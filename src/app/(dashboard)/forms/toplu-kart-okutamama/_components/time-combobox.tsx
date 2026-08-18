"use client"

import * as React from "react"
import { Check, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const TIME_RE = /^\d{2}:\d{2}$/

/**
 * 00:00–23:55, 5 dakika adımlı saat seçenekleri.
 * `extra`: 5'e bölünmeyen MEVCUT değer (ör. "17:06") — düzenlemede veri kaybı
 * olmasın diye seçenek listesine enjekte edilir (sıralı yerine oturur).
 */
function buildOptions(extra?: string): string[] {
  const opts: string[] = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 5) {
      opts.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)
    }
  }
  if (extra && TIME_RE.test(extra) && !opts.includes(extra)) {
    opts.push(extra)
    opts.sort()
  }
  return opts
}

/**
 * Saat seçici — yazarak filtrelenen combobox. Backend'e daima "HH:mm" verir.
 * Filtre iki-noktasız normalize edilir: "09" → 09:xx, "173" → 17:3x, "17:3" → 17:3x.
 */
export function TimeCombobox({
  value,
  onChange,
  placeholder = "Saat",
  disabled,
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const options = React.useMemo(() => buildOptions(value), [value])

  // "17:3" veya "173" → "173"; seçeneğin HHmm hâliyle baştan eşleşir.
  const digits = query.replace(/\D/g, "")
  const filtered = digits
    ? options.filter((o) => o.replace(":", "").startsWith(digits))
    : options

  function pick(v: string) {
    onChange(v)
    setOpen(false)
    setQuery("")
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setQuery("")
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-[104px] justify-between font-normal", !value && "text-muted-foreground", className)}
        >
          {value || placeholder}
          <Clock className="ml-1 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[150px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Ara (ör. 173)" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>Eşleşme yok</CommandEmpty>
            <CommandGroup>
              {filtered.map((o) => (
                <CommandItem key={o} value={o} onSelect={() => pick(o)}>
                  <Check className={cn("mr-2 h-4 w-4", value === o ? "opacity-100" : "opacity-0")} />
                  {o}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Search, User, Loader2 } from 'lucide-react'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export type ADUser = {
  id: string
  name: string
  email: string
  department?: string | null
  jobTitle?: string | null
  username?: string
  employeeId?: string | null
  source?: 'ldap' | 'bluecollar' | 'db'
}

interface UserSearchComboboxProps {
  value?: string // email value
  onSelect: (user: ADUser | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function UserSearchCombobox({
  value,
  onSelect,
  placeholder = 'Kullanici secin...',
  disabled = false,
  className,
}: UserSearchComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [users, setUsers] = React.useState<ADUser[]>([])
  const [loading, setLoading] = React.useState(false)
  const [selectedUser, setSelectedUser] = React.useState<ADUser | null>(null)
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null)

  // Fetch users on search change
  const fetchUsers = React.useCallback(async (searchTerm: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchTerm && searchTerm.length >= 2) {
        params.append('search', searchTerm)
      }
      const response = await fetch(`/api/users?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
    } catch (error) {
      console.error('Kullanicilar alinamadi:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search
  React.useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      if (open) {
        fetchUsers(search)
      }
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [search, open, fetchUsers])

  // Initial fetch when opened
  React.useEffect(() => {
    if (open && users.length === 0) {
      fetchUsers('')
    }
  }, [open, users.length, fetchUsers])

  // Find selected user from value
  React.useEffect(() => {
    if (value && users.length > 0) {
      const found = users.find(u => u.email === value)
      if (found) {
        setSelectedUser(found)
      }
    } else if (!value) {
      setSelectedUser(null)
    }
  }, [value, users])

  // Resolve user from value when users list is not yet loaded
  React.useEffect(() => {
    if (value && !selectedUser) {
      fetch(`/api/users?search=${encodeURIComponent(value)}`)
        .then(res => res.ok ? res.json() : [])
        .then((data: ADUser[]) => {
          const found = data.find(u => u.email === value)
          if (found) {
            setSelectedUser(found)
          }
        })
        .catch(() => {})
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (user: ADUser) => {
    setSelectedUser(user)
    onSelect(user)
    setOpen(false)
    setSearch('')
  }

  const handleClear = () => {
    setSelectedUser(null)
    onSelect(null)
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !selectedUser && 'text-muted-foreground',
            className
          )}
        >
          {selectedUser ? (
            <div className="flex items-center gap-2 truncate">
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{selectedUser.name}</span>
              {selectedUser.department && (
                <span className="text-xs text-muted-foreground truncate">
                  ({selectedUser.department})
                </span>
              )}
            </div>
          ) : (
            <span>{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder="Kullanici ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin opacity-50" />}
          </div>
          <CommandList>
            {!loading && users.length === 0 && (
              <CommandEmpty>
                {search.length > 0 && search.length < 2
                  ? 'En az 2 karakter girin...'
                  : 'Kullanici bulunamadi.'}
              </CommandEmpty>
            )}
            <CommandGroup>
              {selectedUser && (
                <CommandItem
                  onSelect={handleClear}
                  className="text-muted-foreground"
                >
                  <span className="text-sm">Secimi temizle</span>
                </CommandItem>
              )}
              {users.map((user) => (
                <CommandItem
                  key={user.id}
                  value={user.email}
                  onSelect={() => {
                    handleSelect(user)
                  }}
                  onClick={() => {
                    handleSelect(user)
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Check
                    className={cn(
                      'h-4 w-4',
                      selectedUser?.email === user.email
                        ? 'opacity-100'
                        : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-medium truncate">{user.name}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {user.source === 'bluecollar' ? (
                        <>
                          {user.employeeId && <span className="truncate">Sicil: {user.employeeId}</span>}
                          {user.department && (
                            <>
                              <span>-</span>
                              <span className="truncate">{user.department}</span>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="truncate">{user.email}</span>
                          {user.department && (
                            <>
                              <span>-</span>
                              <span className="truncate">{user.department}</span>
                            </>
                          )}
                        </>
                      )}
                    </div>
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

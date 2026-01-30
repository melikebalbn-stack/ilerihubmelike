"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Trash2, User as UserIcon, Loader2, Mail } from "lucide-react"
import { cn } from "@/lib/utils"

interface UserData {
  id: string
  name: string
  email: string | null
  jobTitle: string | null
  department: string | null
}

export interface Recipient {
  name: string
  email: string
  isFromAD?: boolean
}

interface RecipientInputProps {
  recipient: Recipient
  onChange: (recipient: Recipient) => void
  onRemove: () => void
  canRemove: boolean
}

export function RecipientInput({
  recipient,
  onChange,
  onRemove,
  canRemove
}: RecipientInputProps) {
  const [query, setQuery] = useState(recipient.name)
  const [suggestions, setSuggestions] = useState<UserData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setQuery(recipient.name)
  }, [recipient.name])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  async function searchUsers(searchQuery: string) {
    if (searchQuery.length < 2) {
      setSuggestions([])
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}&limit=10`)
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data.users || [])
      }
    } catch (err) {
      console.error("Kullanıcı arama hatası:", err)
    } finally {
      setIsLoading(false)
    }
  }

  function handleNameChange(value: string) {
    setQuery(value)
    onChange({ ...recipient, name: value, isFromAD: false })

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      searchUsers(value)
    }, 300)

    if (value.length >= 2) {
      setShowSuggestions(true)
    } else {
      setShowSuggestions(false)
    }
  }

  function handleSelectUser(user: UserData) {
    setQuery(user.name || "")
    onChange({
      name: user.name || "",
      email: user.email || "",
      isFromAD: true
    })
    setShowSuggestions(false)
    setSuggestions([])
  }

  function handleEmailChange(value: string) {
    onChange({ ...recipient, email: value })
  }

  return (
    <div ref={wrapperRef} className="flex gap-2 relative">
      <div className="relative flex-1">
        <Input
          placeholder="Ad Soyad yazın..."
          value={query}
          onChange={(e) => handleNameChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true)
            }
          }}
          className={cn(
            "pr-8",
            recipient.isFromAD && "border-green-500 bg-green-50"
          )}
        />
        {isLoading && (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {recipient.isFromAD && !isLoading && (
          <UserIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
        )}

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
            {suggestions.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelectUser(user)}
                className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-3 border-b last:border-b-0"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0">
                  <UserIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user.email || "Email yok"}
                    {user.jobTitle && ` • ${user.jobTitle}`}
                  </p>
                </div>
              </button>
            ))}
            <div className="px-3 py-2 text-xs text-muted-foreground bg-gray-50 border-t">
              Listede yoksa manuel yazabilirsiniz
            </div>
          </div>
        )}
      </div>

      <div className="relative flex-1">
        <Mail className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="email@example.com"
          type="email"
          value={recipient.email}
          onChange={(e) => handleEmailChange(e.target.value)}
          className={cn(
            "pl-8",
            recipient.isFromAD && "border-green-500 bg-green-50"
          )}
          disabled={recipient.isFromAD}
        />
      </div>

      {canRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      )}
    </div>
  )
}

"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Trash2, User as UserIcon, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface UserData {
  id: string
  name: string
  email: string | null
  jobTitle: string | null
  department: string | null
}

interface Participant {
  name: string
  title: string
  company: "ILERI_GROUP" | "VISITED_COMPANY"
  isFromAD?: boolean
  userId?: string
}

interface ParticipantInputProps {
  participant: Participant
  onChange: (participant: Participant) => void
  onRemove: () => void
  canRemove: boolean
  placeholder?: string
  companyType: "ILERI_GROUP" | "VISITED_COMPANY"
}

export function ParticipantInput({
  participant,
  onChange,
  onRemove,
  canRemove,
  placeholder = "Ad Soyad",
  companyType
}: ParticipantInputProps) {
  const [query, setQuery] = useState(participant.name)
  const [suggestions, setSuggestions] = useState<UserData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // İleri Group için AD araması yap, dış firma için arama yapma
  const shouldSearchAD = companyType === "ILERI_GROUP"

  useEffect(() => {
    setQuery(participant.name)
  }, [participant.name])

  useEffect(() => {
    // Click outside to close suggestions
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  async function searchUsers(searchQuery: string) {
    if (!shouldSearchAD || searchQuery.length < 2) {
      setSuggestions([])
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}&limit=10`)
      if (res.ok) {
        const data = await res.json()
        console.log("AD Search results:", data.users?.length || 0, "users")
        setSuggestions(data.users || [])
      } else {
        console.error("AD Search failed:", res.status)
      }
    } catch (err) {
      console.error("Kullanıcı arama hatası:", err)
    } finally {
      setIsLoading(false)
    }
  }

  function handleInputChange(value: string) {
    setQuery(value)
    onChange({ ...participant, name: value, isFromAD: false, userId: undefined })

    // Debounced search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      searchUsers(value)
    }, 300)

    if (value.length >= 2 && shouldSearchAD) {
      setShowSuggestions(true)
    } else {
      setShowSuggestions(false)
    }
  }

  function handleSelectUser(user: UserData) {
    setQuery(user.name || "")
    onChange({
      ...participant,
      name: user.name || "",
      title: user.jobTitle || "",
      isFromAD: true,
      userId: user.id
    })
    setShowSuggestions(false)
    setSuggestions([])
  }

  function handleTitleChange(value: string) {
    onChange({ ...participant, title: value })
  }

  return (
    <div ref={wrapperRef} className="flex gap-2 relative">
      <div className="relative flex-1">
        <Input
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0 && shouldSearchAD) {
              setShowSuggestions(true)
            }
          }}
          className={cn(
            "pr-8",
            participant.isFromAD && "border-green-500 bg-green-50"
          )}
        />
        {isLoading && (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {participant.isFromAD && !isLoading && (
          <UserIcon className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
        )}

        {/* Suggestions dropdown */}
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
                    {user.jobTitle || "Unvan belirtilmemiş"}
                    {user.department && ` • ${user.department}`}
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

      <Input
        placeholder="Unvan"
        value={participant.title}
        onChange={(e) => handleTitleChange(e.target.value)}
        className={cn(
          "flex-1",
          participant.isFromAD && "border-green-500 bg-green-50"
        )}
        disabled={participant.isFromAD && !!participant.title}
      />

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

// Dış firma katılımcıları için basit input (AD araması yok)
export function ExternalParticipantInput({
  participant,
  onChange,
  onRemove,
  canRemove
}: Omit<ParticipantInputProps, 'companyType' | 'placeholder'>) {
  return (
    <div className="flex gap-2">
      <Input
        placeholder="Ad Soyad"
        value={participant.name}
        onChange={(e) => onChange({ ...participant, name: e.target.value })}
        className="flex-1"
      />
      <Input
        placeholder="Unvan"
        value={participant.title}
        onChange={(e) => onChange({ ...participant, title: e.target.value })}
        className="flex-1"
      />
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

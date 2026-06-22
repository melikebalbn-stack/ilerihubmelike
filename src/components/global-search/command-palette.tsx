'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  Search,
  ClipboardList,
  Megaphone,
  Lightbulb,
  Wrench,
  Users,
  Calendar,
  Settings,
  Moon,
  Sun,
  Monitor,
  Home,
  BarChart2,
  X,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent } from '@/components/ui/dialog'

interface SearchResult {
  id: string
  title: string
  subtitle?: string
  type: 'task' | 'announcement' | 'suggestion' | 'user' | 'device'
  url: string
  icon?: string
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ClipboardList,
  Megaphone,
  Lightbulb,
  Wrench,
  Users,
}

const quickActions = [
  { id: 'dashboard', label: 'Dashboard', icon: Home, url: '/dashboard' },
  { id: 'tasks', label: 'Gorevler', icon: ClipboardList, url: '/tasks' },
  { id: 'calibration', label: 'Kalibrasyon', icon: Wrench, url: '/calibration' },
  { id: 'suggestions', label: 'Oneriler', icon: Lightbulb, url: '/suggestions' },
  { id: 'announcements', label: 'Duyurular', icon: Megaphone, url: '/announcements' },
]

const themeOptions = [
  { id: 'light', label: 'Acik Tema', icon: Sun, theme: 'light' },
  { id: 'dark', label: 'Koyu Tema', icon: Moon, theme: 'dark' },
  { id: 'system', label: 'Sistem', icon: Monitor, theme: 'system' },
]

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const { setTheme, theme } = useTheme()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!query || query.length < 2) {
      setResults([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    debounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        if (response.ok) {
          const data = await response.json()
          setResults(data.results)
        }
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query])

  // Get all items for display
  const getAllItems = useCallback(() => {
    const items: Array<{
      id: string
      label: string
      icon: React.ComponentType<{ className?: string }>
      action: () => void
      type: string
      subtitle?: string
    }> = []

    // If there's a query, show search results
    if (query.length >= 2 && results.length > 0) {
      results.forEach(result => {
        const IconComponent = result.icon ? iconMap[result.icon] || Search : Search
        items.push({
          id: result.id,
          label: result.title,
          subtitle: result.subtitle,
          icon: IconComponent,
          type: result.type,
          action: () => {
            router.push(result.url)
            onClose()
          },
        })
      })
    }

    // Quick actions (always shown when no query)
    if (!query) {
      quickActions.forEach(action => {
        items.push({
          id: action.id,
          label: action.label,
          icon: action.icon,
          type: 'quick',
          action: () => {
            router.push(action.url)
            onClose()
          },
        })
      })

      // Theme options
      themeOptions.forEach(option => {
        items.push({
          id: option.id,
          label: option.label,
          icon: option.icon,
          type: 'theme',
          subtitle: theme === option.theme ? 'Aktif' : undefined,
          action: () => {
            setTheme(option.theme)
            onClose()
          },
        })
      })
    }

    return items
  }, [query, results, router, onClose, setTheme, theme])

  const items = getAllItems()

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % Math.max(items.length, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + items.length) % Math.max(items.length, 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (items[selectedIndex]) {
        items[selectedIndex].action()
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }, [items, selectedIndex, onClose])

  // Reset selected index when items change
  useEffect(() => {
    setSelectedIndex(0)
  }, [query, results.length])

  const typeLabels: Record<string, string> = {
    task: 'Gorev',
    announcement: 'Duyuru',
    suggestion: 'Oneri',
    device: 'Cihaz',
    user: 'Kullanici',
    quick: 'Hizli Erisim',
    theme: 'Tema',
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center border-b px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ara veya komut yaz..."
            className="flex-1 h-12 px-3 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {query && !isLoading && (
            <button onClick={() => setQuery('')} className="p-1 hover:bg-muted rounded">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 && query.length >= 2 && !isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Sonuc bulunamadi</p>
            </div>
          ) : (
            <div className="py-2">
              {/* Group by type */}
              {Object.entries(
                items.reduce((acc, item) => {
                  if (!acc[item.type]) acc[item.type] = []
                  acc[item.type].push(item)
                  return acc
                }, {} as Record<string, typeof items>)
              ).map(([type, typeItems]) => (
                <div key={type}>
                  <div className="px-4 py-1.5 text-xs font-medium text-muted-foreground uppercase">
                    {typeLabels[type] || type}
                  </div>
                  {typeItems.map((item, idx) => {
                    const globalIndex = items.indexOf(item)
                    const Icon = item.icon
                    return (
                      <button
                        key={item.id}
                        onClick={item.action}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                          selectedIndex === globalIndex
                            ? 'bg-accent text-accent-foreground'
                            : 'hover:bg-muted'
                        )}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <div className="flex-1 text-left">
                          <span className="font-medium">{item.label}</span>
                          {item.subtitle && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {item.subtitle}
                            </span>
                          )}
                        </div>
                        {selectedIndex === globalIndex && (
                          <kbd className="text-xs text-muted-foreground">Enter</kbd>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted">↑↓</kbd>
              gezin
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted">Enter</kbd>
              sec
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted">Esc</kbd>
              kapat
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

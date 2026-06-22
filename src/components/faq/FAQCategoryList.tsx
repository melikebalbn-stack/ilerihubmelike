'use client'

import { cn } from '@/lib/utils'
import {
  HelpCircle,
  FileText,
  Settings,
  Users,
  Shield,
  Briefcase,
  Wrench,
  MessageSquare,
  BookOpen,
  LucideIcon,
} from 'lucide-react'

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  faqCount: number
}

interface FAQCategoryListProps {
  categories: Category[]
  selectedCategory: string | null
  onSelectCategory: (categoryId: string | null) => void
}

// İkon map'i
const iconMap: Record<string, LucideIcon> = {
  HelpCircle,
  FileText,
  Settings,
  Users,
  Shield,
  Briefcase,
  Wrench,
  MessageSquare,
  BookOpen,
}

function getIcon(iconName: string | null): LucideIcon {
  if (!iconName) return HelpCircle
  return iconMap[iconName] || HelpCircle
}

export function FAQCategoryList({
  categories,
  selectedCategory,
  onSelectCategory,
}: FAQCategoryListProps) {
  const totalCount = categories.reduce((sum, cat) => sum + cat.faqCount, 0)

  return (
    <div className="space-y-1">
      {/* Tümü */}
      <button
        onClick={() => onSelectCategory(null)}
        className={cn(
          'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          selectedCategory === null
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        <HelpCircle className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Tümü</span>
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full',
          selectedCategory === null
            ? 'bg-primary-foreground/20 text-primary-foreground'
            : 'bg-muted text-muted-foreground'
        )}>
          {totalCount}
        </span>
      </button>

      {/* Kategoriler */}
      {categories.map((category) => {
        const Icon = getIcon(category.icon)
        const isSelected = selectedCategory === category.id

        return (
          <button
            key={category.id}
            onClick={() => onSelectCategory(category.id)}
            className={cn(
              'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isSelected
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left truncate">{category.name}</span>
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full',
              isSelected
                ? 'bg-primary-foreground/20 text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            )}>
              {category.faqCount}
            </span>
          </button>
        )
      })}
    </div>
  )
}

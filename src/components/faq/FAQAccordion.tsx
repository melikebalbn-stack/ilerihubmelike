'use client'

import { useState } from 'react'
import { ChevronDown, Eye, Edit, Trash2, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FAQFeedback } from './FAQFeedback'

interface FAQ {
  id: string
  question: string
  answer: string
  tags: string[]
  viewCount: number
  helpfulCount: number
  notHelpfulCount: number
  isPublished: boolean
  sortOrder: number
  categoryId: string
}

interface FAQAccordionProps {
  faqs: FAQ[]
  isAdmin?: boolean
  onEdit?: (faq: FAQ) => void
  onDelete?: (faq: FAQ) => void
}

export function FAQAccordion({ faqs, isAdmin, onEdit, onDelete }: FAQAccordionProps) {
  const [openId, setOpenId] = useState<string | null>(null)

  const toggleOpen = (id: string) => {
    setOpenId(openId === id ? null : id)
  }

  if (faqs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Bu kategoride henüz SSS bulunmuyor.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {faqs.map((faq) => {
        const isOpen = openId === faq.id

        return (
          <div
            key={faq.id}
            className={cn(
              'rounded-lg border bg-card transition-all',
              isOpen && 'ring-2 ring-primary/20'
            )}
          >
            {/* Soru Başlığı */}
            <button
              onClick={() => toggleOpen(faq.id)}
              className="w-full flex items-start gap-3 p-4 text-left"
            >
              <ChevronDown
                className={cn(
                  'h-5 w-5 shrink-0 text-muted-foreground transition-transform mt-0.5',
                  isOpen && 'rotate-180'
                )}
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium pr-4">{faq.question}</h3>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    {faq.viewCount}
                  </span>
                  {faq.tags.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Tag className="h-3.5 w-3.5" />
                      {faq.tags.slice(0, 3).join(', ')}
                      {faq.tags.length > 3 && ` +${faq.tags.length - 3}`}
                    </span>
                  )}
                  {!faq.isPublished && isAdmin && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                      Taslak
                    </span>
                  )}
                </div>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit?.(faq)
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete?.(faq)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </button>

            {/* Cevap İçeriği */}
            {isOpen && (
              <div className="px-4 pb-4 border-t">
                <div
                  className="prose prose-sm max-w-none pt-4"
                  dangerouslySetInnerHTML={{ __html: faq.answer }}
                />

                {/* Feedback */}
                <FAQFeedback
                  faqId={faq.id}
                  helpfulCount={faq.helpfulCount}
                  notHelpfulCount={faq.notHelpfulCount}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

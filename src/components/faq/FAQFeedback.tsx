'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface FAQFeedbackProps {
  faqId: string
  helpfulCount: number
  notHelpfulCount: number
  initialVote?: boolean | null
}

export function FAQFeedback({
  faqId,
  helpfulCount: initialHelpful,
  notHelpfulCount: initialNotHelpful,
  initialVote = null,
}: FAQFeedbackProps) {
  const [vote, setVote] = useState<boolean | null>(initialVote)
  const [helpfulCount, setHelpfulCount] = useState(initialHelpful)
  const [notHelpfulCount, setNotHelpfulCount] = useState(initialNotHelpful)
  const [loading, setLoading] = useState(false)

  const handleVote = async (helpful: boolean) => {
    if (loading) return

    setLoading(true)

    try {
      const res = await fetch(`/api/faq/${faqId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ helpful }),
      })

      if (!res.ok) {
        throw new Error('Oy kaydedilemedi')
      }

      // Sayaçları güncelle
      if (vote === null) {
        // İlk oy
        if (helpful) {
          setHelpfulCount((c) => c + 1)
        } else {
          setNotHelpfulCount((c) => c + 1)
        }
      } else if (vote !== helpful) {
        // Oy değiştirme
        if (helpful) {
          setHelpfulCount((c) => c + 1)
          setNotHelpfulCount((c) => Math.max(0, c - 1))
        } else {
          setHelpfulCount((c) => Math.max(0, c - 1))
          setNotHelpfulCount((c) => c + 1)
        }
      }

      setVote(helpful)
      toast.success('Geri bildiriminiz kaydedildi')
    } catch {
      toast.error('Bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-4 pt-3 border-t">
      <span className="text-sm text-muted-foreground">Bu faydalı oldu mu?</span>
      <div className="flex items-center gap-2">
        <Button
          variant={vote === true ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleVote(true)}
          disabled={loading}
          className={cn(
            'gap-1.5',
            vote === true && 'bg-green-600 hover:bg-green-700'
          )}
        >
          {loading && vote !== true ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ThumbsUp className="h-4 w-4" />
          )}
          <span>{helpfulCount}</span>
        </Button>
        <Button
          variant={vote === false ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleVote(false)}
          disabled={loading}
          className={cn(
            'gap-1.5',
            vote === false && 'bg-red-600 hover:bg-red-700'
          )}
        >
          {loading && vote !== false ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ThumbsDown className="h-4 w-4" />
          )}
          <span>{notHelpfulCount}</span>
        </Button>
      </div>
    </div>
  )
}

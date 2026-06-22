'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect as Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface Category {
  id: string
  name: string
}

interface FAQ {
  id: string
  question: string
  answer: string
  categoryId: string
  tags: string[]
  sortOrder: number
  isPublished: boolean
}

interface FAQFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  faq?: FAQ | null
  categories: Category[]
  onSuccess: () => void
}

export function FAQForm({
  open,
  onOpenChange,
  faq,
  categories,
  onSuccess,
}: FAQFormProps) {
  const [loading, setLoading] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [isPublished, setIsPublished] = useState(false)

  const isEdit = !!faq

  // Form'u doldurmak için
  useEffect(() => {
    if (faq) {
      setQuestion(faq.question)
      setAnswer(faq.answer)
      setCategoryId(faq.categoryId)
      setTags(faq.tags)
      setSortOrder(faq.sortOrder)
      setIsPublished(faq.isPublished)
    } else {
      setQuestion('')
      setAnswer('')
      setCategoryId(categories[0]?.id || '')
      setTags([])
      setSortOrder(0)
      setIsPublished(false)
    }
  }, [faq, categories])

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!question.trim() || !answer.trim() || !categoryId) {
      toast.error('Soru, cevap ve kategori zorunludur')
      return
    }

    setLoading(true)

    try {
      const url = isEdit ? `/api/faq/${faq.id}` : '/api/faq'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          answer: answer.trim(),
          categoryId,
          tags,
          sortOrder,
          isPublished,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Bir hata oluştu')
      }

      toast.success(isEdit ? 'SSS güncellendi' : 'SSS eklendi')
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'SSS Düzenle' : 'Yeni SSS Ekle'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Kategori */}
          <div className="space-y-2">
            <Label htmlFor="category">Kategori</Label>
            <Select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              <option value="">Kategori seçin</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Soru */}
          <div className="space-y-2">
            <Label htmlFor="question">Soru</Label>
            <Input
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Sıkça sorulan soru..."
              required
            />
          </div>

          {/* Cevap */}
          <div className="space-y-2">
            <Label htmlFor="answer">Cevap (HTML destekli)</Label>
            <Textarea
              id="answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Detaylı cevap... HTML etiketleri kullanabilirsiniz."
              rows={6}
              required
            />
            <p className="text-xs text-muted-foreground">
              HTML etiketleri kullanabilirsiniz: &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;strong&gt;, &lt;a&gt; vb.
            </p>
          </div>

          {/* Etiketler */}
          <div className="space-y-2">
            <Label>Etiketler</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Etiket ekle..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddTag()
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={handleAddTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Sıralama */}
          <div className="space-y-2">
            <Label htmlFor="sortOrder">Sıralama</Label>
            <Input
              id="sortOrder"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
              min={0}
            />
            <p className="text-xs text-muted-foreground">
              Küçük sayılar önce gösterilir
            </p>
          </div>

          {/* Yayın Durumu */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Yayınla</Label>
              <p className="text-xs text-muted-foreground">
                Yayınlanmamış SSS&apos;ler sadece yöneticilere görünür
              </p>
            </div>
            <Switch checked={isPublished} onCheckedChange={setIsPublished} />
          </div>

          {/* Butonlar */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              İptal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? 'Güncelle' : 'Ekle'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

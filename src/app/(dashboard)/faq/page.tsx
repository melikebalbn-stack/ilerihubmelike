'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  HelpCircle,
  Loader2,
  Plus,
  Eye,
  ThumbsUp,
  AlertCircle,
  SortAsc,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { NativeSelect as Select } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { FAQSearch } from '@/components/faq/FAQSearch'
import { FAQCategoryList } from '@/components/faq/FAQCategoryList'
import { FAQAccordion } from '@/components/faq/FAQAccordion'
import { FAQForm } from '@/components/faq/FAQForm'
import { toast } from 'sonner'

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  faqCount: number
}

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

interface GroupedFAQ {
  category: {
    id: string
    name: string
    slug: string
    icon: string | null
  }
  faqs: FAQ[]
}

export default function FAQPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [categories, setCategories] = useState<Category[]>([])
  const [grouped, setGrouped] = useState<GroupedFAQ[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtreler
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'sortOrder' | 'viewCount' | 'helpfulCount'>('sortOrder')

  // Admin modals
  const [formOpen, setFormOpen] = useState(false)
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingFaq, setDeletingFaq] = useState<FAQ | null>(null)

  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'HR_MANAGER'].includes(session?.user?.role || '')

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Kategorileri çek
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/faq/categories')
      if (!res.ok) throw new Error('Kategoriler yüklenemedi')
      const data = await res.json()
      setCategories(data)
    } catch (err) {
      console.error('Categories error:', err)
    }
  }, [])

  // FAQ'ları çek
  const fetchFAQs = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (selectedCategory) params.set('categoryId', selectedCategory)
      if (sortBy) params.set('sortBy', sortBy)
      if (isAdmin) params.set('includeUnpublished', 'true')

      const res = await fetch(`/api/faq?${params}`)
      if (!res.ok) throw new Error('SSS yüklenemedi')

      const data = await res.json()
      setGrouped(data.grouped)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, selectedCategory, sortBy, isAdmin])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchCategories()
      fetchFAQs()
    }
  }, [status, fetchCategories, fetchFAQs])

  // Düzenleme
  const handleEdit = (faq: FAQ) => {
    setEditingFaq(faq)
    setFormOpen(true)
  }

  // Silme
  const handleDelete = (faq: FAQ) => {
    setDeletingFaq(faq)
    setDeleteConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!deletingFaq) return

    try {
      const res = await fetch(`/api/faq/${deletingFaq.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Silinemedi')

      toast.success('SSS silindi')
      fetchFAQs()
    } catch {
      toast.error('Bir hata oluştu')
    } finally {
      setDeleteConfirmOpen(false)
      setDeletingFaq(null)
    }
  }

  // Yeni ekleme
  const handleAdd = () => {
    setEditingFaq(null)
    setFormOpen(true)
  }

  // Form başarılı
  const handleFormSuccess = () => {
    fetchFAQs()
    fetchCategories()
  }

  // Auth kontrolü
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    router.push('/auth/login')
    return null
  }

  // Toplam istatistikler
  const totalFAQs = grouped.reduce((sum, g) => sum + g.faqs.length, 0)
  const totalViews = grouped.reduce(
    (sum, g) => sum + g.faqs.reduce((s, f) => s + f.viewCount, 0),
    0
  )
  const totalHelpful = grouped.reduce(
    (sum, g) => sum + g.faqs.reduce((s, f) => s + f.helpfulCount, 0),
    0
  )

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HelpCircle className="h-6 w-6" />
            Sıkça Sorulan Sorular
          </h1>
          <p className="text-muted-foreground mt-1">
            İhtiyacınız olan bilgilere hızlıca ulaşın
          </p>
        </div>

        {isAdmin && (
          <Button onClick={handleAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Yeni SSS Ekle
          </Button>
        )}
      </div>

      {/* İstatistikler */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <HelpCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalFAQs}</p>
                <p className="text-sm text-muted-foreground">Toplam SSS</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Eye className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalViews}</p>
                <p className="text-sm text-muted-foreground">Görüntülenme</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <ThumbsUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalHelpful}</p>
                <p className="text-sm text-muted-foreground">Faydalı Bulundu</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ana içerik */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sol: Kategoriler */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="pt-4">
              <h2 className="font-semibold mb-3">Kategoriler</h2>
              <FAQCategoryList
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sağ: SSS Listesi */}
        <div className="lg:col-span-3 space-y-4">
          {/* Arama ve Sıralama */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <FAQSearch value={search} onChange={setSearch} />
            </div>
            <div className="flex items-center gap-2">
              <SortAsc className="h-4 w-4 text-muted-foreground" />
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="w-44"
              >
                <option value="sortOrder">Varsayılan Sıra</option>
                <option value="viewCount">En Çok Görüntülenen</option>
                <option value="helpfulCount">En Faydalı</option>
              </Select>
            </div>
          </div>

          {/* Hata */}
          {error && (
            <div className="flex items-center gap-2 p-4 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive">
              <AlertCircle className="h-5 w-5" />
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {/* SSS Listesi */}
          {!loading && !error && (
            <>
              {grouped.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <HelpCircle className="h-16 w-16 mb-4 opacity-30" />
                  <p className="text-lg">Henüz SSS eklenmemiş</p>
                  {isAdmin && (
                    <Button onClick={handleAdd} className="mt-4" variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      İlk SSS&apos;yi Ekle
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {grouped.map((group) => (
                    <div key={group.category.id}>
                      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        {group.category.name}
                        <span className="text-sm font-normal text-muted-foreground">
                          ({group.faqs.length})
                        </span>
                      </h2>
                      <FAQAccordion
                        faqs={group.faqs}
                        isAdmin={isAdmin}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* FAQ Form Modal */}
      <FAQForm
        open={formOpen}
        onOpenChange={setFormOpen}
        faq={editingFaq}
        categories={categories}
        onSuccess={handleFormSuccess}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>SSS&apos;yi Sil</AlertDialogTitle>
            <AlertDialogDescription>
              Bu SSS&apos;yi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

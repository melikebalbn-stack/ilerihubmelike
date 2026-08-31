'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronsUpDown, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { useHasPermission } from '@/components/auth/can'
import { cokluAlandaAra } from '@/lib/zimmet/arama'

type ZimmetTanimItem = { id: string; ad: string; aktif: boolean; sira: number }

const DIGER = 'Diğer'

interface TanimComboboxProps {
  // null = tür (kök) seviyesi, dolu = o tanımın alt-dalları.
  parentId: string | null
  value: string
  // `id`: gerçek bir ZimmetTanim satırı seçildiyse onun id'si (ör. bu türün
  // alt-dallarını sorgulamak için parentId olarak kullanılır) - sabit
  // seçenek/"Diğer" seçilince null.
  onValueChange: (ad: string, id: string | null) => void
  // Tür seviyesinde önüne eklenen sabit seçenekler (5 donanım türü) - DB'de
  // karşılığı yok, düzenlenemez/silinemez (ikon hiç gösterilmez).
  sabitSecenekler?: string[]
  // DB'den gelen listede olsa bile GÖSTERİLMEYECEK adlar - ör. "Yazılım" artık
  // `sabitSecenekler`de sabit olarak sunuluyor (bkz. useZimmetFormu.ts
  // SABIT_TUR_SECENEKLERI); aynı satır DB listesinde de varsa mükerrer
  // görünmesin diye burada süzülüyor.
  haricTutulacaklar?: string[]
  id?: string
  placeholder?: string
  aramaPlaceholder?: string
  ekleEtiketi?: string
  disabled?: boolean
  className?: string
}

// Tür (kök) ve alt-dal seçicisi - TEK bileşen, ikisi de aynı ZimmetTanim
// tablosundan besleniyor (parentId prop'uyla ayrışıyor). Sihirbazda
// (ZimmetFormuStep1) ve Düzenle dialogunda (ZimmetListesi) iki kez kullanılır.
// Yetkili kullanıcı (zimmet-formu.view) satır üstü kalem/çöp ile
// düzenleyip soft-delete edebiliyor, listenin altındaki "+ Yeni ... ekle" ile
// yeni tanım ekleyebiliyor. Yetkisiz kullanıcı sadece seçer. "sabitSecenekler"
// isimleri hiçbir zaman ikon göstermez.
// "Diğer" DB'de bir satır DEĞİL - sabit, en sonda, düzenlenemez/silinemez -
// seçilince dışarıda (bu bileşenin DIŞINDA, çağıran tarafta) serbest metin
// input'u açılıyor.
export function TanimCombobox({
  parentId,
  value,
  onValueChange,
  sabitSecenekler = [],
  haricTutulacaklar = [],
  id,
  placeholder = 'Seçin',
  aramaPlaceholder = 'Ara...',
  ekleEtiketi = 'Yeni ekle',
  disabled = false,
  className,
}: TanimComboboxProps) {
  const yonetebilir = useHasPermission('zimmet-formu.view')
  const [open, setOpen] = useState(false)
  const [arama, setArama] = useState('')
  const [liste, setListe] = useState<ZimmetTanimItem[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [islemYapiliyor, setIslemYapiliyor] = useState(false)

  const [duzenlenecek, setDuzenlenecek] = useState<ZimmetTanimItem | null>(null)
  const [duzenleAd, setDuzenleAd] = useState('')
  const [silinecek, setSilinecek] = useState<ZimmetTanimItem | null>(null)

  const [eklemeAcik, setEklemeAcik] = useState(false)
  const [yeniAd, setYeniAd] = useState('')

  const fetchListe = () => {
    setYukleniyor(true)
    const q = parentId ?? 'null'
    return fetch(`/api/zimmet-formu/tanim?parentId=${encodeURIComponent(q)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ZimmetTanimItem[]) => setListe(Array.isArray(data) ? data : []))
      .catch(() => setListe([]))
      .finally(() => setYukleniyor(false))
  }

  useEffect(() => {
    fetchListe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentId])

  const filtrelenmis = useMemo(
    () =>
      liste.filter((item) => !haricTutulacaklar.includes(item.ad) && cokluAlandaAra([item.ad], arama)),
    [liste, arama, haricTutulacaklar]
  )

  async function yeniEkle() {
    const ad = yeniAd.trim()
    if (!ad) return
    setIslemYapiliyor(true)
    try {
      const res = await fetch('/api/zimmet-formu/tanim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad, parentId }),
      })
      const veri = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(veri.error ?? 'Eklenemedi')
      toast.success('Eklendi')
      setYeniAd('')
      setEklemeAcik(false)
      await fetchListe()
      onValueChange(ad, veri.id ?? null)
      setArama('')
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Eklenemedi')
    } finally {
      setIslemYapiliyor(false)
    }
  }

  async function duzenlemeyiKaydet() {
    if (!duzenlenecek) return
    const ad = duzenleAd.trim()
    if (!ad) return
    setIslemYapiliyor(true)
    try {
      const res = await fetch(`/api/zimmet-formu/tanim/${duzenlenecek.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad }),
      })
      const veri = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(veri.error ?? 'Güncellenemedi')
      toast.success('Güncellendi')
      // Düzenlenen kayıt o an seçili olansa, seçimi yeni adla senkron tut.
      if (value === duzenlenecek.ad) onValueChange(ad, duzenlenecek.id)
      setDuzenlenecek(null)
      await fetchListe()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Güncellenemedi')
    } finally {
      setIslemYapiliyor(false)
    }
  }

  async function silmeyiOnayla() {
    if (!silinecek) return
    setIslemYapiliyor(true)
    try {
      const res = await fetch(`/api/zimmet-formu/tanim/${silinecek.id}`, { method: 'DELETE' })
      const veri = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(veri.error ?? 'Silinemedi')
      const cocukSayisi: number = veri.etkilenenCocukSayisi ?? 0
      toast.success(
        cocukSayisi > 0
          ? `"${silinecek.ad}" ve ${cocukSayisi} alt-dalı kaldırıldı`
          : `"${silinecek.ad}" kaldırıldı`
      )
      setSilinecek(null)
      await fetchListe()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Silinemedi')
    } finally {
      setIslemYapiliyor(false)
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              'w-full justify-between font-normal',
              !value && 'text-muted-foreground',
              className
            )}
          >
            <span className="truncate">{value || placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={aramaPlaceholder} value={arama} onValueChange={setArama} />
            <CommandList>
              {yukleniyor ? (
                <div className="py-6 text-center text-sm text-muted-foreground">Yükleniyor...</div>
              ) : (
                <>
                  <CommandEmpty>Bulunamadı.</CommandEmpty>
                  {sabitSecenekler.length > 0 && (
                    <CommandGroup>
                      {sabitSecenekler
                        .filter((ad) => cokluAlandaAra([ad], arama))
                        .map((ad) => (
                          <CommandItem
                            key={`sabit-${ad}`}
                            value={`sabit-${ad}`}
                            onSelect={() => {
                              onValueChange(ad, null)
                              setArama('')
                              setOpen(false)
                            }}
                          >
                            <Check
                              className={cn('h-4 w-4 mr-2', ad === value ? 'opacity-100' : 'opacity-0')}
                            />
                            {ad}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  )}
                  <CommandGroup>
                    {filtrelenmis.map((item) => {
                      return (
                        <CommandItem
                          key={item.id}
                          value={item.id}
                          onSelect={() => {
                            onValueChange(item.ad, item.id)
                            setArama('')
                            setOpen(false)
                          }}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <Check
                              className={cn(
                                'h-4 w-4 shrink-0',
                                item.ad === value ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <span className="truncate">{item.ad}</span>
                          </span>
                          {yonetebilir && (
                            <span className="flex items-center gap-0.5 shrink-0">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDuzenlenecek(item)
                                  setDuzenleAd(item.ad)
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSilinecek(item)
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                              </Button>
                            </span>
                          )}
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                  {yonetebilir && (
                    <CommandGroup>
                      {eklemeAcik ? (
                        <div
                          className="flex items-center gap-1.5 px-2 py-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Input
                            autoFocus
                            value={yeniAd}
                            onChange={(e) => setYeniAd(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                yeniEkle()
                              }
                              if (e.key === 'Escape') {
                                setEklemeAcik(false)
                                setYeniAd('')
                              }
                            }}
                            placeholder="Yeni ad"
                            className="h-8"
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="h-8"
                            onClick={yeniEkle}
                            disabled={!yeniAd.trim() || islemYapiliyor}
                          >
                            Ekle
                          </Button>
                        </div>
                      ) : (
                        <CommandItem onSelect={() => setEklemeAcik(true)} className="text-[#1B4F72]">
                          <Plus className="h-4 w-4 mr-2" />
                          {ekleEtiketi}
                        </CommandItem>
                      )}
                    </CommandGroup>
                  )}
                  <CommandGroup>
                    <CommandItem
                      value={DIGER}
                      onSelect={() => {
                        onValueChange(DIGER, null)
                        setArama('')
                        setOpen(false)
                      }}
                    >
                      <Check className={cn('h-4 w-4 mr-2', value === DIGER ? 'opacity-100' : 'opacity-0')} />
                      {DIGER}
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Düzenle */}
      <Dialog open={!!duzenlenecek} onOpenChange={(o) => !o && setDuzenlenecek(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Düzenle</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="tanim-duzenle-ad">Ad</Label>
            <Input
              id="tanim-duzenle-ad"
              value={duzenleAd}
              onChange={(e) => setDuzenleAd(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuzenlenecek(null)}>
              Vazgeç
            </Button>
            <Button onClick={duzenlemeyiKaydet} disabled={!duzenleAd.trim() || islemYapiliyor}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sil onayı */}
      <AlertDialog open={!!silinecek} onOpenChange={(o) => !o && setSilinecek(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kaldır</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{silinecek?.ad}&quot; artık listede görünmeyecek (kalıcı silinmez - geçmiş
              zimmet kayıtlarında bu ad görünmeye devam eder).
              {parentId === null &&
                ' Bu bir TÜR olduğu için alt-dalları da varsa hepsi birlikte kaldırılacak.'}{' '}
              Emin misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={silmeyiOnayla} disabled={islemYapiliyor}>
              Kaldır
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

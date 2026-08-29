'use client'

import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { EK_ALAN_KATALOG, varsayilanEkAlanlar, type EkAlanKey } from '@/lib/zimmet/ek-alanlar'
import { zorunluAlanlar } from '@/lib/zimmet/zorunlu-alanlar'
import { YAZILIM_KOK_ADI } from '@/lib/zimmet/tur'
import { PersonelCombobox } from './PersonelCombobox'
import { TanimCombobox } from './TanimCombobox'
import {
  SABIT_TUR_SECENEKLERI,
  turVeTurDigerNihai,
  type PersonelHit,
  type ZimmetFormuStep1Data,
} from './useZimmetFormu'

interface Props {
  data: ZimmetFormuStep1Data
  setField: <K extends keyof ZimmetFormuStep1Data>(field: K, value: ZimmetFormuStep1Data[K]) => void
  onSelectZimmetSahibi: (personelId: string) => void
  teslimEdenAdi: string
  personelListesi: PersonelHit[]
  personelYukleniyor: boolean
}

function RequiredMark() {
  return <span className="text-rose-500">*</span>
}

function OptionalMark() {
  return <span className="text-xs text-slate-400">(opsiyonel)</span>
}

export function ZimmetFormuStep1({
  data,
  setField,
  onSelectZimmetSahibi,
  teslimEdenAdi,
  personelListesi,
  personelYukleniyor,
}: Props) {
  // Kullanıcının "Alan ekle" ile elle açtığı alanlar (türün varsayılanı dışında).
  const [manuelEkAlanlar, setManuelEkAlanlar] = useState<Set<EkAlanKey>>(new Set())
  const [alanEkleAcik, setAlanEkleAcik] = useState(false)
  // Tür seçilince (Yazılım VEYA DB'den YENİ bir tür) alt-dal Combobox'ının
  // hangi parentId'yi sorgulayacağı - TanimCombobox'ın onValueChange'i seçilen
  // satırın gerçek id'sini geri verir (bkz. TanimCombobox.tsx). Sabit 5
  // donanım türünde id her zaman null - alt-dal Combobox'ı hiç render edilmez.
  const [turAilesiId, setTurAilesiId] = useState<string | null>(null)
  // Alt-dal Combobox'ının canlı seçimi - Wizard her zaman YENİ kayıt
  // oluşturur (prefill yok), bu yüzden hep boş başlar.
  const [altDalSecimi, setAltDalSecimi] = useState('')

  const { enumTur } = turVeTurDigerNihai(data.tur, data.turDiger)

  const varsayilanlar = useMemo(() => new Set(varsayilanEkAlanlar(enumTur)), [enumTur])

  // Türe göre değişen zorunlu alanlar (Seri No her zaman zorunlu - ayrı, sabit
  // - burada değil). src/lib/zimmet/zorunlu-alanlar.ts - sunucuyla AYNI tablo.
  const zorunluSet = useMemo(() => new Set<string>(zorunluAlanlar(enumTur)), [enumTur])

  function handleTurSecimi(ad: string, id: string | null) {
    if (ad === data.tur) return
    setField('tur', ad)
    setTurAilesiId(id)
    setAltDalSecimi('')
    setField('turDiger', '')
  }

  function handleAltDalSecimi(ad: string) {
    if (ad === altDalSecimi) return
    setAltDalSecimi(ad)
    setField('turDiger', ad === 'Diğer' ? '' : ad)
  }

  // Görünür alanlar = türün varsayılanı ∪ elle eklenenler ∪ zaten dolu olanlar
  // (tür değişince veya adımlar arası geçişte dolu bir alan aniden kaybolmasın).
  const gorunurAlanlar = useMemo(() => {
    const s = new Set<EkAlanKey>(varsayilanlar)
    manuelEkAlanlar.forEach((k) => s.add(k))
    EK_ALAN_KATALOG.forEach(({ key }) => {
      if (data[key].trim()) s.add(key)
    })
    return s
  }, [varsayilanlar, manuelEkAlanlar, data])

  const eklenebilirAlanlar = EK_ALAN_KATALOG.filter(({ key }) => !gorunurAlanlar.has(key))

  function alanEkle(key: EkAlanKey) {
    setManuelEkAlanlar((prev) => new Set(prev).add(key))
    setAlanEkleAcik(false)
  }

  function alanKaldir(key: EkAlanKey) {
    setManuelEkAlanlar((prev) => {
      const n = new Set(prev)
      n.delete(key)
      return n
    })
    setField(key, '')
  }

  // Alt zimmet sahibi, ana zimmet sahibiyle aynı bölümdeki personelle sınırlı
  // (kendisi hariç). altZimmetSahibi bir isim string'i olarak tutuluyor (FK
  // değil, mevcut schema alanı) - id'yi combobox'ın value'su için ismden geri
  // çözüyoruz.
  const aynıBolumdekiPersonel = data.departman
    ? personelListesi.filter((p) => p.department === data.departman && p.id !== data.zimmetSahibiId)
    : []
  const altZimmetSahibiId =
    aynıBolumdekiPersonel.find((p) => (p.name ?? p.email) === data.altZimmetSahibi)?.id ?? ''

  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="teslimEden">Teslim eden</Label>
          <Input id="teslimEden" value={teslimEdenAdi} disabled readOnly className="bg-slate-50 text-slate-600" />
          <Badge variant="secondary" className="font-normal">
            IT Sistem Geliştirme
          </Badge>
        </div>

        <div className="space-y-2">
          <Label htmlFor="zimmetSahibi">
            Zimmet sahibi <RequiredMark />
          </Label>
          <PersonelCombobox
            personelListesi={personelListesi}
            value={data.zimmetSahibiId}
            onSelect={onSelectZimmetSahibi}
            placeholder={personelYukleniyor ? 'Personel listesi yükleniyor...' : 'Personel seçin'}
            className={!data.zimmetSahibiId ? 'border-rose-300 ring-1 ring-rose-200' : ''}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="departman">Departman</Label>
          <Input
            id="departman"
            value={data.departman}
            readOnly
            placeholder="Zimmet sahibi seçilince otomatik dolar"
            className="bg-slate-50 text-slate-600"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="unvan">Ünvan</Label>
          <Input
            id="unvan"
            value={data.unvan}
            readOnly
            placeholder="Zimmet sahibi seçilince otomatik dolar"
            className="bg-slate-50 text-slate-600"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="altZimmetSahibi">
            Alt zimmet sahibi <OptionalMark />
          </Label>
          <PersonelCombobox
            personelListesi={aynıBolumdekiPersonel}
            value={altZimmetSahibiId}
            onSelect={(personelId) => {
              const secilen = personelListesi.find((p) => p.id === personelId)
              setField('altZimmetSahibi', secilen?.name ?? secilen?.email ?? '')
            }}
            placeholder={data.zimmetSahibiId ? 'Personel seçin' : 'Önce zimmet sahibi seçin'}
            emptyText="Bu bölümde başka personel yok."
            disabled={!data.zimmetSahibiId}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tur">
            Tür <RequiredMark />
          </Label>
          <TanimCombobox
            id="tur"
            parentId={null}
            value={data.tur}
            onValueChange={handleTurSecimi}
            sabitSecenekler={[...SABIT_TUR_SECENEKLERI]}
            korumaliAdlar={[YAZILIM_KOK_ADI]}
            placeholder="Tür seçin"
            aramaPlaceholder="Tür ara..."
            ekleEtiketi="Yeni tür ekle"
            className={!data.tur ? 'border-rose-300 ring-1 ring-rose-200' : ''}
          />
        </div>

        {turAilesiId && (
          <div className="space-y-2">
            <Label htmlFor="turDiger">
              {data.tur === YAZILIM_KOK_ADI ? 'Hangi yazılım?' : `${data.tur} - alt tür`}{' '}
              {data.tur === YAZILIM_KOK_ADI ? <RequiredMark /> : <OptionalMark />}
            </Label>
            <TanimCombobox
              id="turDiger"
              parentId={turAilesiId}
              value={altDalSecimi}
              onValueChange={handleAltDalSecimi}
              placeholder={data.tur === YAZILIM_KOK_ADI ? 'Yazılım seçin' : 'Alt tür seçin'}
              aramaPlaceholder="Ara..."
              ekleEtiketi="Yeni alt-dal ekle"
              className={
                data.tur === YAZILIM_KOK_ADI && !altDalSecimi
                  ? 'border-rose-300 ring-1 ring-rose-200'
                  : ''
              }
            />
            {altDalSecimi === 'Diğer' && (
              <Input
                value={data.turDiger}
                onChange={(e) => setField('turDiger', e.target.value)}
                placeholder={data.tur === YAZILIM_KOK_ADI ? 'Yazılımı yazın' : 'Alt türü yazın'}
                className={
                  data.tur === YAZILIM_KOK_ADI && !data.turDiger.trim()
                    ? 'border-rose-300 ring-1 ring-rose-200'
                    : ''
                }
              />
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="marka">
            Marka <OptionalMark />
          </Label>
          <Input
            id="marka"
            value={data.marka}
            onChange={(e) => setField('marka', e.target.value)}
            placeholder="örn. Lenovo, Apple, HP, Samsung"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="model">
            Model <OptionalMark />
          </Label>
          <Input
            id="model"
            value={data.model}
            onChange={(e) => setField('model', e.target.value)}
            placeholder="örn. Latitude 5440, iPhone 15"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="seriNumarasi">
            Seri numarası <RequiredMark />
          </Label>
          <Input
            id="seriNumarasi"
            value={data.seriNumarasi}
            onChange={(e) => setField('seriNumarasi', e.target.value)}
            className={!data.seriNumarasi.trim() ? 'border-rose-300 ring-1 ring-rose-200' : ''}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="aciklama">
            Açıklama <OptionalMark />
          </Label>
          <Input
            id="aciklama"
            value={data.aciklama}
            onChange={(e) => setField('aciklama', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ozellik">
            Özellik {zorunluSet.has('ozellik') ? <RequiredMark /> : <OptionalMark />}
          </Label>
          <Input
            id="ozellik"
            value={data.ozellik}
            onChange={(e) => setField('ozellik', e.target.value)}
            placeholder="Teknik detaylar"
            className={zorunluSet.has('ozellik') && !data.ozellik.trim() ? 'border-rose-300 ring-1 ring-rose-200' : ''}
          />
        </div>

        {EK_ALAN_KATALOG.filter(({ key }) => gorunurAlanlar.has(key)).map(({ key, label }) => {
          const gerekli = zorunluSet.has(key)
          return (
            <div className="space-y-2" key={key}>
              <div className="flex items-center justify-between">
                <Label htmlFor={key}>
                  {label} {gerekli ? <RequiredMark /> : <OptionalMark />}
                </Label>
                {!varsayilanlar.has(key) && (
                  <button
                    type="button"
                    onClick={() => alanKaldir(key)}
                    className="text-slate-400 hover:text-rose-500"
                    title="Alanı kaldır"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Input
                id={key}
                value={data[key]}
                onChange={(e) => setField(key, e.target.value)}
                className={gerekli && !data[key].trim() ? 'border-rose-300 ring-1 ring-rose-200' : ''}
              />
            </div>
          )
        })}

        {eklenebilirAlanlar.length > 0 && (
          <Popover open={alanEkleAcik} onOpenChange={setAlanEkleAcik}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Alan ekle
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-1" align="start">
              {eklenebilirAlanlar.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => alanEkle(key)}
                  className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-slate-100"
                >
                  {label}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        )}
      </CardContent>
    </Card>
  )
}

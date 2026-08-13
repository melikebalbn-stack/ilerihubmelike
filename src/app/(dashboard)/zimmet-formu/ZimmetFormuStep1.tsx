'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PersonelCombobox } from './PersonelCombobox'
import {
  ZIMMET_TUR_OPTIONS,
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
  const isBilgisayar = data.tur === 'Notebook Bilgisayar' || data.tur === 'Desktop Bilgisayar'
  const isCepTelefonu = data.tur === 'Cep Telefonu'
  const isYazici = data.tur === 'Yazıcı'
  const isElTerminali = data.tur === 'El Terminali'
  const isLisans = data.tur === 'Office 365' // ileride başka lisans türü eklenirse buraya eklenir
  // "Diğer" seçilince tür belirsiz olduğu için hangi özel alanın gerekebileceği
  // bilinmiyor - hiçbiri zorunlu olmadan hepsi görünür yapılıyor (bkz. aşağıdaki
  // || isDiger'ler). zimmetEksikZorunluAlanlar bu alanları içermiyor, değişmedi.
  const isDiger = data.tur === 'Diğer'

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
          <Select
            value={data.tur}
            onValueChange={(v) => setField('tur', v as ZimmetFormuStep1Data['tur'])}
          >
            <SelectTrigger
              id="tur"
              className={!data.tur ? 'border-rose-300 ring-1 ring-rose-200' : ''}
            >
              <SelectValue placeholder="Tür seçin" />
            </SelectTrigger>
            <SelectContent>
              {ZIMMET_TUR_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {data.tur === 'Diğer' && (
          <div className="space-y-2">
            <Label htmlFor="turDiger">Tür (serbest metin)</Label>
            <Input
              id="turDiger"
              value={data.turDiger}
              onChange={(e) => setField('turDiger', e.target.value)}
              placeholder="Türü yazın"
            />
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
            Açıklama <RequiredMark />
          </Label>
          <Input
            id="aciklama"
            value={data.aciklama}
            onChange={(e) => setField('aciklama', e.target.value)}
            className={!data.aciklama.trim() ? 'border-rose-300 ring-1 ring-rose-200' : ''}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ozellik">
            Özellik <OptionalMark />
          </Label>
          <Input
            id="ozellik"
            value={data.ozellik}
            onChange={(e) => setField('ozellik', e.target.value)}
            placeholder="Teknik detaylar"
          />
        </div>

        {(isBilgisayar || isDiger) && (
          <div className="space-y-2">
            <Label htmlFor="ram">
              RAM <OptionalMark />
            </Label>
            <Input
              id="ram"
              value={data.ram}
              onChange={(e) => setField('ram', e.target.value)}
              placeholder="örn. 16GB"
            />
          </div>
        )}

        {(isYazici || isDiger) && (
          <div className="space-y-2">
            <Label htmlFor="ipAdresi">
              IP adresi <OptionalMark />
            </Label>
            <Input
              id="ipAdresi"
              value={data.ipAdresi}
              onChange={(e) => setField('ipAdresi', e.target.value)}
              placeholder="örn. 192.168.1.50"
            />
          </div>
        )}

        {(isElTerminali || isDiger) && (
          <div className="space-y-2">
            <Label htmlFor="parcaNo">
              P/N <OptionalMark />
            </Label>
            <Input
              id="parcaNo"
              value={data.parcaNo}
              onChange={(e) => setField('parcaNo', e.target.value)}
            />
          </div>
        )}

        {(isLisans || isDiger) && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lisansBaslangic">
                Lisans başlangıç <OptionalMark />
              </Label>
              <Input
                id="lisansBaslangic"
                type="date"
                value={data.lisansBaslangic}
                onChange={(e) => setField('lisansBaslangic', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lisansBitis">
                Lisans bitiş <OptionalMark />
              </Label>
              <Input
                id="lisansBitis"
                type="date"
                value={data.lisansBitis}
                onChange={(e) => setField('lisansBitis', e.target.value)}
              />
            </div>
          </div>
        )}

        {(isBilgisayar || isDiger) && (
          <>
            <div className="space-y-2">
              <Label htmlFor="macAdresi">
                MAC adresi <OptionalMark />
              </Label>
              <Input
                id="macAdresi"
                value={data.macAdresi}
                onChange={(e) => setField('macAdresi', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pcAdi">
                PC adı <OptionalMark />
              </Label>
              <Input
                id="pcAdi"
                value={data.pcAdi}
                onChange={(e) => setField('pcAdi', e.target.value)}
              />
            </div>
          </>
        )}

        {(isCepTelefonu || isDiger) && (
          <div className="space-y-2">
            <Label htmlFor="imeiNumarasi">
              IMEI numarası <OptionalMark />
            </Label>
            <Input
              id="imeiNumarasi"
              value={data.imeiNumarasi}
              onChange={(e) => setField('imeiNumarasi', e.target.value)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

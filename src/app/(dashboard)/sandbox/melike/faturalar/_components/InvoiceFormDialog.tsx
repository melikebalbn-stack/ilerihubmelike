'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CompanyAutocomplete } from './CompanyAutocomplete'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

interface Department {
  id: string
  name: string
}

type Currency = 'TRY' | 'USD' | 'EUR'

const emptyForm = {
  invoiceDate: '',
  companyName: '',
  invoiceNumber: '',
  amount: '',
  currency: 'TRY' as Currency,
  departmentOrgUnitId: '', // '' = Genel
  note: '',
}

export function InvoiceFormDialog({ open, onOpenChange, onCreated }: Props) {
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [preview, setPreview] = useState<{ eur: number; rate: number } | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])

  useEffect(() => {
    if (!open) {
      setForm(emptyForm)
      setErrors({})
      setPreview(null)
      return
    }
    fetch('/api/sandbox/melike/faturalar/departments')
      .then((res) => (res.ok ? res.json() : { departments: [] }))
      .then((data) => setDepartments(data.departments ?? []))
      .catch(() => setDepartments([]))
  }, [open])

  useEffect(() => {
    const amountNum = parseFloat(form.amount.replace(',', '.'))
    if (!form.invoiceDate || !form.amount || isNaN(amountNum) || amountNum <= 0) {
      setPreview(null)
      return
    }
    const timeout = setTimeout(async () => {
      try {
        if (form.currency === 'EUR') {
          setPreview({ eur: amountNum, rate: 1 })
          return
        }
        const res = await fetch(
          `/api/sandbox/melike/faturalar/tcmb-rate?date=${form.invoiceDate}&currency=EUR`
        )
        if (!res.ok) return
        const eurData = await res.json()
        if (form.currency === 'TRY') {
          setPreview({ eur: amountNum / eurData.rate, rate: eurData.rate })
        } else {
          const usdRes = await fetch(
            `/api/sandbox/melike/faturalar/tcmb-rate?date=${form.invoiceDate}&currency=USD`
          )
          if (!usdRes.ok) return
          const usdData = await usdRes.json()
          const amountTRY = amountNum * usdData.rate
          setPreview({ eur: amountTRY / eurData.rate, rate: eurData.rate })
        }
      } catch {
        setPreview(null)
      }
    }, 400)
    return () => clearTimeout(timeout)
  }, [form.invoiceDate, form.amount, form.currency])

  function validate() {
    const e: Record<string, string> = {}
    if (!form.invoiceDate) e.invoiceDate = 'Tarih gerekli'
    if (!form.companyName.trim()) e.companyName = 'Firma adı gerekli'
    if (!form.invoiceNumber.trim()) e.invoiceNumber = 'Fatura no gerekli'
    const amountNum = parseFloat(form.amount.replace(',', '.'))
    if (!form.amount || isNaN(amountNum) || amountNum <= 0) e.amount = 'Geçerli bir tutar gir'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/sandbox/melike/faturalar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount.replace(',', '.')),
          departmentOrgUnitId: form.departmentOrgUnitId || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrors({ submit: data.error || 'Fatura kaydedilemedi' })
        return
      }
      onCreated()
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#1B4F72]">Yeni Fatura</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invoiceNumber">Fatura No</Label>
            <Input
              id="invoiceNumber"
              value={form.invoiceNumber}
              onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
              placeholder="ör. RF02026000000123"
            />
            {errors.invoiceNumber && <p className="text-xs text-destructive">{errors.invoiceNumber}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="companyName">Firma Adı</Label>
            <CompanyAutocomplete
              id="companyName"
              value={form.companyName}
              onChange={(v) => setForm({ ...form, companyName: v })}
              placeholder="3+ harf yaz, kayıtlı firmalar listelensin"
            />
            {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invoiceDate">Fatura Tarihi</Label>
            <Input
              id="invoiceDate"
              type="date"
              value={form.invoiceDate}
              onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
            />
            {errors.invoiceDate && <p className="text-xs text-destructive">{errors.invoiceDate}</p>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="amount">Tutar</Label>
              <Input
                id="amount"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
              />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Para Birimi</Label>
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v as Currency })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRY">TRY</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {preview && (
            <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              ≈ {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'EUR' }).format(preview.eur)}{' '}
              <span className="text-muted-foreground/70">(TCMB EUR kuru: {preview.rate.toFixed(4)})</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Bölüm</Label>
            <Select
              value={form.departmentOrgUnitId || 'GENEL'}
              onValueChange={(v) => setForm({ ...form, departmentOrgUnitId: v === 'GENEL' ? '' : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GENEL">Genel</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {errors.submit && <p className="text-xs text-destructive">{errors.submit}</p>}

          <Button
            className="w-full bg-[#1B4F72] hover:bg-[#163f5c]"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

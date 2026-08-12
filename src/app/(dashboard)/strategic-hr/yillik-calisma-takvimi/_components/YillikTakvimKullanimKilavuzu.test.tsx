import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Button } from '@/components/ui/button'
import { YillikTakvimKullanimKilavuzu } from './YillikTakvimKullanimKilavuzu'

function Harness() { const [open, setOpen] = useState(false); return <><Button onClick={() => setOpen(true)}>Kullanım Kılavuzu</Button><YillikTakvimKullanimKilavuzu open={open} onOpenChange={setOpen} /></> }
describe('Yıllık Takvim kullanım kılavuzu', () => {
  it('butonla açılır ve Kapat ile kapanır', async () => { const user = userEvent.setup(); render(<Harness />); await user.click(screen.getByRole('button', { name: 'Kullanım Kılavuzu' })); expect(screen.getByRole('dialog')).toBeInTheDocument(); await user.click(screen.getByRole('button', { name: 'Kapat' })); expect(screen.queryByRole('dialog')).not.toBeInTheDocument() })
  it('tamamlanmış kullanıcı özelliklerinin başlıklarını içerir', async () => { const user = userEvent.setup(); render(<Harness />); await user.click(screen.getByRole('button', { name: 'Kullanım Kılavuzu' })); for (const title of ['Özet kartları', 'Checklist kullanımı', 'Onay ve revizyon', 'Onay kararını geri alma', 'Sonraki dönemi oluşturma', 'Hatırlatma', 'Ekler ve kanıtlar', 'İşlem geçmişi', "Excel'e aktar"]) expect(screen.getByRole('button', { name: title })).toBeInTheDocument() })
  it('gelecek özellikleri aktif olarak anlatmaz ve teknik/internal bilgi içermez', async () => { const user = userEvent.setup(); render(<Harness />); await user.click(screen.getByRole('button', { name: 'Kullanım Kılavuzu' })); for (const trigger of screen.getByRole('dialog').querySelectorAll('button[aria-expanded="false"]')) await user.click(trigger); const text = screen.getByRole('dialog').textContent ?? ''; expect(text).toContain('henüz aktif değildir'); expect(text).not.toMatch(/sandbox|Prisma|schema|API route|permission key|storage path|\/api\//i) })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const recordFind = vi.fn(), recordCreate = vi.fn(), recordUpdate = vi.fn(), participantCreate = vi.fn()
const participantDelete = vi.fn(), participantUpsert = vi.fn(), userFind = vi.fn(), departmentFind = vi.fn(), auditCreate = vi.fn(), transaction = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: {
  yillikTakvimKaydi: { findUnique: (...args: unknown[]) => recordFind(...args) },
  $transaction: (...args: unknown[]) => transaction(...args),
} }))
import { cancelExternalYillikTakvim, upsertExternalYillikTakvim } from './external-source'

const tx = {
  user: { findFirst: userFind }, department: { findFirst: departmentFind },
  yillikTakvimKaydi: { findUnique: recordFind, create: recordCreate, update: recordUpdate },
  yillikTakvimKatilimci: { create: participantCreate, deleteMany: participantDelete, upsert: participantUpsert },
  yillikTakvimIslemGecmisi: { create: auditCreate },
}
const input = {
  sourceModule: 'EGITIM', sourceRecordId: 'training-42', actorUserId: 'actor-1', anaKonu: 'Eğitimler', surec: 'İSG Eğitimi',
  departmentId: 'department-1', anaSorumluUserId: 'owner-1', nihaiSonTarih: '2027-03-15T00:00:00.000Z' as const,
  aciklama: 'İlk açıklama', periyot: 'YILLIK' as const, kayitTuru: 'EGITIM' as const,
}
beforeEach(() => {
  vi.clearAllMocks(); transaction.mockImplementation(callback => callback(tx)); userFind.mockResolvedValue({ id: 'user' }); departmentFind.mockResolvedValue({ id: 'department-1' })
  recordCreate.mockResolvedValue({ id: 'record-1' }); recordUpdate.mockResolvedValue({ id: 'record-1' }); recordFind.mockResolvedValue(null)
})

describe('Yıllık Takvim dış kaynak servisi', () => {
  it('ilk çağrıda kaynak anahtarıyla kayıt, sorumlu ve güvenli audit oluşturur', async () => {
    await expect(upsertExternalYillikTakvim(input)).resolves.toEqual({ id: 'record-1', created: true })
    expect(recordCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ kaynakModul: 'EGITIM', kaynakKayitId: 'training-42', yil: 2027, aciklama: 'İlk açıklama' }) })
    expect(participantCreate).toHaveBeenCalled(); const audit = auditCreate.mock.calls[0][0].data
    expect(audit.islemTuru).toBe('DIS_KAYNAK_OLUSTUR'); expect(audit.yeniDeger).not.toContain('training-42'); expect(audit.yeniDeger).not.toContain('İlk açıklama')
  })

  it('aynı kaynak anahtarında yeni kayıt oluşturmaz ve yalnız whitelist alanlarını günceller', async () => {
    recordFind.mockResolvedValueOnce({ id: 'record-1' }).mockResolvedValueOnce({ durum: 'PLANLANDI' })
    await expect(upsertExternalYillikTakvim({ ...input, aciklama: 'Ezilmemeli' })).resolves.toEqual({ id: 'record-1', created: false })
    expect(recordCreate).not.toHaveBeenCalled(); const data = recordUpdate.mock.calls[0][0].data
    expect(data).not.toHaveProperty('aciklama'); expect(data).not.toHaveProperty('gerceklesmeDurumu'); expect(data).not.toHaveProperty('gerceklesmeTarihi')
    expect(data).not.toHaveProperty('checklist'); expect(data).not.toHaveProperty('onayAdimlari'); expect(data).not.toHaveProperty('ekler')
  })

  it('P2002 yarışında duplicate bırakmadan mevcut kaydı okuyup update eder', async () => {
    transaction.mockRejectedValueOnce({ code: 'P2002' }).mockImplementationOnce(callback => callback(tx))
    recordFind.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'raced-record' }).mockResolvedValueOnce({ durum: 'PLANLANDI' })
    await expect(upsertExternalYillikTakvim(input)).resolves.toEqual({ id: 'raced-record', created: false })
    expect(recordUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'raced-record' } }))
  })

  it('iptali soft-delete yapar ve tekrarı idempotent döner', async () => {
    recordFind.mockResolvedValue({ id: 'record-1', kaynakModul: 'EGITIM', iptalMi: false })
    await expect(cancelExternalYillikTakvim({ sourceModule: 'EGITIM', sourceRecordId: 'training-42', actorUserId: 'actor-1' })).resolves.toEqual({ id: 'record-1', alreadyCancelled: false })
    expect(recordUpdate).toHaveBeenCalledWith({ where: { id: 'record-1' }, data: { iptalMi: true, durum: 'IPTAL_EDILDI', updatedById: 'actor-1' } })
    expect(auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ islemTuru: 'DIS_KAYNAK_IPTAL' }) })
    vi.clearAllMocks(); recordFind.mockResolvedValue({ id: 'record-1', kaynakModul: 'EGITIM', iptalMi: true })
    await expect(cancelExternalYillikTakvim({ sourceModule: 'EGITIM', sourceRecordId: 'training-42', actorUserId: 'actor-1' })).resolves.toEqual({ id: 'record-1', alreadyCancelled: true })
    expect(transaction).not.toHaveBeenCalled()
  })

  it('kaynak anahtarı bulunmadığında manuel kayda dokunmaz', async () => {
    recordFind.mockResolvedValue(null)
    await expect(cancelExternalYillikTakvim({ sourceModule: 'EGITIM', sourceRecordId: 'missing', actorUserId: 'actor-1' })).resolves.toBeNull()
    expect(recordUpdate).not.toHaveBeenCalled()
  })

  it('pasif referansı mutation öncesi reddeder', async () => {
    userFind.mockResolvedValueOnce(null)
    await expect(upsertExternalYillikTakvim(input)).rejects.toThrow('aktif kullanıcı')
    expect(recordCreate).not.toHaveBeenCalled()
  })
})

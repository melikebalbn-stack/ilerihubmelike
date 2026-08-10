/**
 * durusSaniyeCanli — AÇIK duruş (bitis=null) now'a kadar sayılıyor mu (entegrasyon, dev DB, MM63).
 * İzole: kendi duruşumu eklemeden ÖNCE/SONRA ölçüp FARKA bakar (var olan duruşlardan etkilenmez).
 * Uzak 2030 penceresi + benzersiz yorum → gerçek veriyle karışmaz.
 */
import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { durusSaniyeCanli } from './oee-canli'

const MM63_ID = 'cmrl3of570007ybpeuv9x80bo'
const MARK = 'TEST-OEE-CANLI-DURUS-9400'
const BAS = new Date('2030-01-01T00:00:00Z')
const DURUS_BAS = new Date('2030-01-01T00:00:10Z')
const SIMDI = new Date('2030-01-01T00:01:00Z') // BAS+60sn; duruş 00:00:10→now = 50sn beklenir

afterAll(async () => {
  await prisma.iproMachineDowntime.deleteMany({ where: { yorum: MARK } })
  await prisma.$disconnect()
})

describe('durusSaniyeCanli', () => {
  it('açık duruş (bitis=null) pencere sonuna (now) kadar 50sn ekler', async () => {
    const oncesi = await durusSaniyeCanli(prisma, MM63_ID, BAS, SIMDI)
    await prisma.iproMachineDowntime.create({
      data: { tezgahId: MM63_ID, baslangic: DURUS_BAS, bitis: null, kaynak: 'TEST', yorum: MARK },
    })
    const sonrasi = await durusSaniyeCanli(prisma, MM63_ID, BAS, SIMDI)
    expect(sonrasi - oncesi).toBe(50)
  })
})

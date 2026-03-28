/**
 * Mevcut mavi yaka kullanicilari Akademi'ye toplu senkronize et.
 * Bir kerelik calistirilir: npx tsx scripts/sync-to-akademi.ts
 */

import { prisma } from '../src/lib/prisma'
import { bulkSyncToAkademi } from '../src/lib/akademi-sync'

async function main() {
    try {
        // Tum aktif mavi yaka kullanicilari cek
        const blueCollarUsers = await prisma.user.findMany({
            where: {
                isActive: true,
                employeeId: { not: null },
            },
        })

        console.log('Toplam mavi yaka:', blueCollarUsers.length)

        if (blueCollarUsers.length === 0) {
            console.log('Senkronize edilecek kullanici yok.')
            return
        }

        // Akademi'ye toplu gonder
        await bulkSyncToAkademi(blueCollarUsers, 'blue_collar', false)

        console.log('Toplu senkronizasyon tamamlandi.')
    } catch (err) {
        console.error('Hata:', err)
    }
}

main()

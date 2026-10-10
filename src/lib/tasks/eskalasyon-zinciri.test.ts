import { describe, it, expect } from 'vitest'
import { yoneticiZinciri, ustYonetimdeMi } from './eskalasyon-zinciri'
import type { LDAPUser } from '@/lib/ldap'

function u(p: Partial<LDAPUser> & { username: string }): LDAPUser {
  return {
    username: p.username,
    displayName: p.displayName ?? p.username,
    email: p.email ?? `${p.username}@ilerigroup.com`,
    department: p.department ?? null,
    title: p.title ?? null,
    distinguishedName: p.distinguishedName ?? `CN=${p.username},OU=Users,DC=ileri`,
    memberOf: p.memberOf ?? [],
    ou: p.ou ?? null,
    managerDN: p.managerDN ?? null,
    ipPhone: p.ipPhone ?? null,
    disabled: p.disabled ?? false,
  }
}

const calisan = u({ username: 'calisan', managerDN: 'CN=mudurYrd,OU=Users,DC=ileri' })
const mudurYrd = u({
  username: 'mudurYrd',
  distinguishedName: 'CN=mudurYrd,OU=Users,DC=ileri',
  managerDN: 'CN=mudur,OU=Users,DC=ileri',
})
const mudur = u({
  username: 'mudur',
  distinguishedName: 'CN=mudur,OU=Users,DC=ileri',
  managerDN: 'CN=patron,OU=Users,DC=ileri',
})
const patron = u({ username: 'patron', distinguishedName: 'CN=patron,OU=Users,DC=ileri' })

describe('yoneticiZinciri', () => {
  it('zinciri aşağıdan yukarı sıralar', () => {
    const z = yoneticiZinciri([calisan, mudurYrd, mudur, patron], calisan.email)
    expect(z.map((b) => b.email)).toEqual([mudurYrd.email, mudur.email, patron.email])
  })

  it('e-postası olmayan ara basamağı atlar, zinciri kesmez', () => {
    const epostasiz = { ...mudurYrd, email: null }
    const z = yoneticiZinciri([calisan, epostasiz, mudur, patron], calisan.email)
    expect(z.map((b) => b.email)).toEqual([mudur.email, patron.email])
  })

  it('devre dışı hesabı atlar', () => {
    const kapali = { ...mudurYrd, disabled: true }
    const z = yoneticiZinciri([calisan, kapali, mudur, patron], calisan.email)
    expect(z.map((b) => b.email)).toEqual([mudur.email, patron.email])
  })

  it('döngüde sonsuza gitmez', () => {
    const a = u({ username: 'a', distinguishedName: 'CN=a,DC=i', managerDN: 'CN=b,DC=i' })
    const b = u({ username: 'b', distinguishedName: 'CN=b,DC=i', managerDN: 'CN=a,DC=i' })
    const z = yoneticiZinciri([a, b], a.email)
    expect(z.map((x) => x.username ?? x.email)).toHaveLength(1)
    expect(z[0].email).toBe(b.email)
  })

  it('kişi LDAP’ta yoksa ya da yöneticisi yoksa boş döner', () => {
    expect(yoneticiZinciri([calisan], 'yok@ilerigroup.com')).toEqual([])
    expect(yoneticiZinciri([patron], patron.email)).toEqual([])
    expect(yoneticiZinciri([calisan, mudurYrd], null)).toEqual([])
  })

  it('zincir kopmuşsa bulunan yere kadar döner', () => {
    const z = yoneticiZinciri([calisan, mudurYrd], calisan.email)
    expect(z.map((x) => x.email)).toEqual([mudurYrd.email])
  })

  it('üst sınırı aşmaz', () => {
    const z = yoneticiZinciri([calisan, mudurYrd, mudur, patron], calisan.email, 2)
    expect(z).toHaveLength(2)
  })
})

describe('ustYonetimdeMi', () => {
  it('büyük/küçük harften bağımsız eşleşir', () => {
    const z = yoneticiZinciri([calisan, mudurYrd, mudur, patron], calisan.email)
    const son = z[z.length - 1]
    expect(ustYonetimdeMi(son, ['PATRON@ilerigroup.com'])).toBe(true)
    expect(ustYonetimdeMi(z[0], ['patron@ilerigroup.com'])).toBe(false)
  })
})

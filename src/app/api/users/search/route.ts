import { NextRequest, NextResponse } from "next/server"
import { searchLDAPUsers } from "@/lib/ldap"
import { requireSession } from "@/lib/auth/require-session"

// GET - Kullanıcı ara (Active Directory'den - tüm kullanıcılar)
export async function GET(request: NextRequest) {
  try {
    // PR-Y2.5-users: requireSession (LDAP arama, auth gate)
    const { error } = await requireSession()
    if (error) return error

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const limit = parseInt(searchParams.get('limit') || '10')

    console.log(`🔍 User search API called: query="${query}", limit=${limit}`)

    if (query.length < 2) {
      return NextResponse.json({ users: [] })
    }

    // LDAP'tan direkt arama yap (tüm AD kullanıcıları)
    const ldapUsers = await searchLDAPUsers(query)
    console.log(`📋 LDAP returned ${ldapUsers.length} users for query "${query}"`)

    // LDAP sonuçlarını API formatına dönüştür
    const users = ldapUsers.slice(0, limit).map(user => ({
      id: `ldap_${user.username}`,
      name: user.displayName,
      email: user.email,
      jobTitle: user.title,
      department: user.department,
    }))

    return NextResponse.json({ users })
  } catch (error) {
    console.error("Kullanıcı arama hatası:", error)
    return NextResponse.json({ error: "Arama yapılamadı" }, { status: 500 })
  }
}

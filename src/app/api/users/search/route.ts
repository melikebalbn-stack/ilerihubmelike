import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { searchLDAPUsers } from "@/lib/ldap"

// GET - Kullanıcı ara (Active Directory'den - tüm kullanıcılar)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
    }

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

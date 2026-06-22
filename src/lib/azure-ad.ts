// Azure AD / Microsoft Graph API Integration
// Active Directory'den kullanıcı bilgilerini çekmek için

interface AzureADUser {
  id: string
  displayName: string
  mail: string | null
  userPrincipalName: string
  jobTitle: string | null
  department: string | null
  officeLocation: string | null
  mobilePhone: string | null
}

interface GraphAPIResponse {
  value: AzureADUser[]
  '@odata.nextLink'?: string
}

// Access token almak için
async function getAccessToken(): Promise<string> {
  const tenantId = process.env.AZURE_AD_TENANT_ID
  const clientId = process.env.AZURE_AD_CLIENT_ID
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Azure AD credentials not configured')
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Token alma hatası:', error)
    throw new Error('Failed to get access token')
  }

  const data = await response.json()
  return data.access_token
}

// Tüm kullanıcıları çek
export async function getAllADUsers(): Promise<AzureADUser[]> {
  try {
    const accessToken = await getAccessToken()
    const graphEndpoint = process.env.GRAPH_API_ENDPOINT || 'https://graph.microsoft.com/v1.0'

    const allUsers: AzureADUser[] = []
    let nextLink: string | null = `${graphEndpoint}/users?$select=id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation,mobilePhone&$top=999`

    while (nextLink) {
      const response = await fetch(nextLink, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('Graph API hatası:', error)
        throw new Error('Failed to fetch users from Graph API')
      }

      const data: GraphAPIResponse = await response.json()
      allUsers.push(...data.value)
      nextLink = data['@odata.nextLink'] || null
    }

    // Sadece email adresi olanları filtrele ve sırala
    return allUsers
      .filter(user => user.mail || user.userPrincipalName)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'tr'))

  } catch (error) {
    console.error('AD kullanıcıları alınırken hata:', error)
    throw error
  }
}

// Belirli bir kullanıcıyı id ile getir
export async function getADUserById(userId: string): Promise<AzureADUser | null> {
  try {
    const accessToken = await getAccessToken()
    const graphEndpoint = process.env.GRAPH_API_ENDPOINT || 'https://graph.microsoft.com/v1.0'

    const response = await fetch(
      `${graphEndpoint}/users/${userId}?$select=id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation,mobilePhone`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error('Failed to fetch user')
    }

    return await response.json()
  } catch (error) {
    console.error('AD kullanıcısı alınırken hata:', error)
    return null
  }
}

// Kullanıcıları departmana göre filtrele
export async function getADUsersByDepartment(department: string): Promise<AzureADUser[]> {
  try {
    const allUsers = await getAllADUsers()
    return allUsers.filter(user =>
      user.department?.toLowerCase().includes(department.toLowerCase())
    )
  } catch (error) {
    console.error('Departman kullanıcıları alınırken hata:', error)
    return []
  }
}

// Kullanıcı ara (isim veya email ile)
export async function searchADUsers(query: string): Promise<AzureADUser[]> {
  try {
    const allUsers = await getAllADUsers()
    const searchTerm = query.toLowerCase()

    return allUsers.filter(user =>
      user.displayName.toLowerCase().includes(searchTerm) ||
      (user.mail?.toLowerCase().includes(searchTerm)) ||
      user.userPrincipalName.toLowerCase().includes(searchTerm)
    )
  } catch (error) {
    console.error('Kullanıcı arama hatası:', error)
    return []
  }
}

export type { AzureADUser }

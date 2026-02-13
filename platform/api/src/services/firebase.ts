import { createRemoteJWKSet, jwtVerify } from 'jose'

const FIREBASE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/metadata/jwk/securetoken@system.gserviceaccount.com'

let cachedJWKS: ReturnType<typeof createRemoteJWKSet> | null = null
let jwksCachedAt = 0
const JWKS_CACHE_TTL = 3600_000 // 1 hour

function getJWKS() {
  const now = Date.now()
  if (!cachedJWKS || now - jwksCachedAt > JWKS_CACHE_TTL) {
    cachedJWKS = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL))
    jwksCachedAt = now
  }
  return cachedJWKS
}

export interface FirebaseUser {
  userId: string // Firebase UID
  email?: string
  phone?: string
  loginMethod: string
}

export async function verifyFirebaseToken(
  token: string,
  projectId: string,
): Promise<FirebaseUser> {
  const jwks = getJWKS()

  const { payload } = await jwtVerify(token, jwks, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  })

  const userId = payload.sub
  if (!userId) {
    throw new Error('Missing sub claim in Firebase token')
  }

  const email = (payload as any).email as string | undefined
  const phone = (payload as any).phone_number as string | undefined
  const signInProvider =
    (payload as any).firebase?.sign_in_provider as string | undefined

  let loginMethod = 'unknown'
  if (signInProvider === 'google.com') loginMethod = 'google'
  else if (signInProvider === 'phone') loginMethod = 'phone'
  else if (signInProvider === 'password') loginMethod = 'email'
  else if (signInProvider === 'custom') loginMethod = 'custom'
  else if (signInProvider) loginMethod = signInProvider

  return { userId, email, phone, loginMethod }
}

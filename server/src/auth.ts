import { createRemoteJWKSet, jwtVerify } from 'jose'

export interface AuthenticatedUser {
  email: string
}

export interface AuthEnv {
  AUTH_MODE: string
  FIREBASE_PROJECT_ID?: string
}

// Googles nycklar för Firebase ID-token. jose cachar dem och hämtar om vid okänd kid.
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
)

/**
 * Firebase ID-token i Authorization: Bearer, verifierad mot Googles JWKS (RS256), issuer
 * och audience mot projektet. D1-datan ligger under e-postadressen, så bara en bekräftad
 * adress släpps in: annars kunde vem som helst registrera någon annans adress med lösenord
 * och läsa dennes pass.
 */
export async function authenticate(request: Request, env: AuthEnv): Promise<AuthenticatedUser> {
  if (env.AUTH_MODE === 'dev') return { email: 'local@beefcake.invalid' }

  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer /i, '')
  if (!token || !env.FIREBASE_PROJECT_ID) {
    throw new ApiError(401, 'unauthenticated', 'Logga in först.')
  }

  let payload
  try {
    ({ payload } = await jwtVerify(token, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
      audience: env.FIREBASE_PROJECT_ID,
      algorithms: ['RS256']
    }))
  } catch {
    throw new ApiError(401, 'invalid_token', 'Inloggningen har gått ut. Logga in igen.')
  }

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
  if (!email) throw new ApiError(403, 'missing_identity', 'Kontot saknar e-postadress.')
  if (payload.email_verified !== true) throw new ApiError(403, 'email_unverified', 'Bekräfta e-postadressen först.')
  return { email }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message)
  }
}

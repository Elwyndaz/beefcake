import { createRemoteJWKSet, jwtVerify } from 'jose'

export interface AuthenticatedUser {
  email: string
}

export interface AuthEnv {
  AUTH_MODE: string
  ACCESS_TEAM_DOMAIN?: string
  ACCESS_AUD?: string
}

export async function authenticate(request: Request, env: AuthEnv): Promise<AuthenticatedUser> {
  if (env.AUTH_MODE === 'dev') return { email: 'local@beefcake.invalid' }

  const token = request.headers.get('cf-access-jwt-assertion') ?? cookieValue(request.headers.get('cookie'), 'CF_Authorization')
  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    throw new ApiError(401, 'unauthenticated', 'Cloudflare Access authentication is required.')
  }

  const issuer = env.ACCESS_TEAM_DOMAIN.replace(/\/$/, '')
  try {
    const jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`))
    const { payload } = await jwtVerify(token, jwks, { issuer, audience: env.ACCESS_AUD })
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : ''
    if (!email) throw new ApiError(403, 'missing_identity', 'The Access token has no email identity.')
    return { email }
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(401, 'invalid_access_token', 'The Cloudflare Access token is invalid or expired.')
  }
}

function cookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return rest.join('=') || null
  }
  return null
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

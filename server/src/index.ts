import { authenticate, ApiError } from './auth'
import { validateSnapshot } from '../../src/lib/importValidation'

interface SnapshotRow {
  revision: number
  payload: string
  created_at: string
}

const MAX_PAYLOAD_BYTES = 5_000_000

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('origin')
    const headers = corsHeaders(origin, env.FRONTEND_ORIGINS)

    try {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
      if (origin && !isAllowedOrigin(origin, env.FRONTEND_ORIGINS)) {
        throw new ApiError(403, 'origin_not_allowed', 'The request origin is not allowed.')
      }

      const user = await authenticate(request, env)
      const url = new URL(request.url)

      if (url.pathname === '/api/health' && request.method === 'GET') {
        return json({ ok: true }, 200, headers)
      }
      if (url.pathname === '/api/snapshot' && request.method === 'GET') {
        return await readSnapshot(env.DB, user.email, headers)
      }
      if (url.pathname === '/api/snapshot' && request.method === 'POST') {
        return await writeSnapshot(request, env.DB, user.email, headers)
      }

      throw new ApiError(404, 'not_found', 'Route not found.')
    } catch (error) {
      return errorResponse(error, headers)
    }
  }
} satisfies ExportedHandler<Env>

async function readSnapshot(db: D1Database, owner: string, headers: Headers): Promise<Response> {
  const row = await db.prepare(
    'SELECT revision, payload, created_at FROM snapshots WHERE owner = ? ORDER BY revision DESC LIMIT 1'
  ).bind(owner).first<SnapshotRow>()

  if (!row) return json({ revision: 0, data: null }, 200, headers)
  return json({ revision: row.revision, data: JSON.parse(row.payload), updatedAt: row.created_at }, 200, headers)
}

async function writeSnapshot(request: Request, db: D1Database, owner: string, headers: Headers): Promise<Response> {
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > MAX_PAYLOAD_BYTES) throw new ApiError(413, 'payload_too_large', 'Snapshoten är för stor.')

  const rawBody = await request.text()
  if (new TextEncoder().encode(rawBody).byteLength > MAX_PAYLOAD_BYTES) {
    throw new ApiError(413, 'payload_too_large', 'Snapshoten är för stor.')
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    throw new ApiError(400, 'invalid_snapshot', 'Snapshoten har fel format.')
  }
  if (!isRecord(body) || typeof body.expectedRevision !== 'number') {
    throw new ApiError(400, 'invalid_snapshot', 'Snapshoten har fel format.')
  }
  // Samma domänvalidering som JSON-importen i klienten: D1 tar bara emot hela modellen
  let data: ReturnType<typeof validateSnapshot>
  try {
    data = validateSnapshot(body.data)
  } catch (error) {
    throw new ApiError(400, 'invalid_snapshot', safeMessage(error))
  }

  const payload = JSON.stringify(data)
  if (new TextEncoder().encode(payload).byteLength > MAX_PAYLOAD_BYTES) {
    throw new ApiError(413, 'payload_too_large', 'Snapshoten är för stor.')
  }

  const expectedRevision = body.expectedRevision
  const createdAt = new Date().toISOString()
  const result = await db.prepare(
    `INSERT INTO snapshots (owner, revision, payload, created_at)
     SELECT ?, ?, ?, ?
     WHERE (SELECT COALESCE(MAX(revision), 0) FROM snapshots WHERE owner = ?) = ?`
  ).bind(owner, expectedRevision + 1, payload, createdAt, owner, expectedRevision).run()

  if (!result.meta.changes) {
    const current = await db.prepare(
      'SELECT COALESCE(MAX(revision), 0) AS revision FROM snapshots WHERE owner = ?'
    ).bind(owner).first<{ revision: number }>()
    throw new ApiError(409, 'revision_conflict', `Servern har revision ${current?.revision ?? 0}. Läs in den först.`)
  }

  return json({ revision: expectedRevision + 1, updatedAt: createdAt }, 201, headers)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAllowedOrigin(origin: string, configured: string): boolean {
  return configured.split(',').map(value => value.trim()).filter(Boolean).includes(origin)
}

function corsHeaders(origin: string | null, configured: string): Headers {
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json'
  })
  if (origin && isAllowedOrigin(origin, configured)) headers.set('Access-Control-Allow-Origin', origin)
  return headers
}

function json(data: unknown, status: number, headers: Headers): Response {
  return new Response(JSON.stringify(data), { status, headers })
}

function errorResponse(error: unknown, headers: Headers): Response {
  const apiError = error instanceof ApiError
    ? error
    : new ApiError(500, 'internal_error', 'Ett oväntat serverfel inträffade.')
  if (!(error instanceof ApiError)) console.error(JSON.stringify({ event: 'request_failed', error: safeMessage(error) }))
  return json({ error: { code: apiError.code, message: apiError.message } }, apiError.status, headers)
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 500) : 'Unknown error'
}

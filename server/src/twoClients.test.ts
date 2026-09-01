/**
 * Två klienter mot samma D1, deterministiskt och utan nätverk. Klientens riktiga
 * dataService och cloudSyncService kör mot fake-indexeddb, Workerns riktiga
 * handler kör mot en D1-attrapp som bara kan de tre SQL-satserna i index.ts.
 * Testet ligger under server/ så att klientens tsc-projekt inte drar in Worker-typerna.
 */
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import worker from './index'

interface Row { owner: string; revision: number; payload: string; created_at: string }

// ponytail: strängmatchning på de tre satserna i index.ts, byt till sqlite om Workern får fler frågor
class FakeD1 {
  rows: Row[] = []

  prepare(sql: string) {
    const rows = this.rows
    const latest = (owner: string) => rows.filter(r => r.owner === owner).sort((a, b) => b.revision - a.revision)[0]
    return {
      bind: (...args: unknown[]) => ({
        first: async () => {
          const owner = String(args[0])
          if (sql.includes('SELECT revision, payload')) return latest(owner) ?? null
          if (sql.includes('AS revision')) return { revision: latest(owner)?.revision ?? 0 }
          throw new Error(`FakeD1 kan inte: ${sql}`)
        },
        run: async () => {
          if (!sql.includes('INSERT INTO snapshots')) throw new Error(`FakeD1 kan inte: ${sql}`)
          const [owner, revision, payload, createdAt, , expected] = args as [string, number, string, string, string, number]
          if ((latest(owner)?.revision ?? 0) !== expected) return { meta: { changes: 0 } }
          rows.push({ owner, revision, payload, created_at: createdAt })
          return { meta: { changes: 1 } }
        }
      })
    }
  }

  latestRevision(owner = 'local@beefcake.invalid'): number {
    return this.rows.filter(r => r.owner === owner).sort((a, b) => b.revision - a.revision)[0]?.revision ?? 0
  }

  latestSessionIds(owner = 'local@beefcake.invalid'): string[] {
    const row = this.rows.filter(r => r.owner === owner).sort((a, b) => b.revision - a.revision)[0]
    return row ? (JSON.parse(row.payload) as { sessions: { id: string }[] }).sessions.map(s => s.id) : []
  }
}

const db = new FakeD1()
const env = { DB: db, AUTH_MODE: 'dev', FRONTEND_ORIGINS: '' } as unknown as Parameters<typeof worker.fetch>[1]
const API = 'http://api.test'

type Client = {
  data: typeof import('../../src/services/dataService')
  sync: typeof import('../../src/services/cloudSyncService')
}

/** En klient är en egen IndexedDB plus egna modulinstanser (revision och synkkö bor i modulerna). */
async function newClient(): Promise<Client> {
  globalThis.indexedDB = new IDBFactory()
  vi.resetModules()
  const data = await import('../../src/services/dataService')
  const sync = await import('../../src/services/cloudSyncService')
  return { data, sync }
}

function apiFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  const { credentials: _credentials, ...rest } = init ?? {}
  return worker.fetch(new Request(url, rest), env)
}

async function sessionIds(client: Client): Promise<string[]> {
  return (await client.data.getAllSessions()).map(s => s.id)
}

beforeAll(() => {
  vi.stubEnv('VITE_BEEFCAKE_API_URL', API)
  vi.stubGlobal('fetch', apiFetch)
})

describe('två klienter mot D1', () => {
  it('serverradering mot stale cache, revisionskonflikt och fail-closed återhämtning', async () => {
    // Klient A startar mot tom D1: seedens pass blir revision 1
    const a = await newClient()
    await a.data.syncSeed()
    expect(db.latestRevision()).toBe(1)
    const seeded = await sessionIds(a)
    expect(seeded.length).toBeGreaterThan(0)

    // Klient B startar: D1 är sanningen, cachen fylls från servern
    const b = await newClient()
    await b.data.syncSeed()
    expect(await sessionIds(b)).toEqual(seeded)
    expect(db.latestRevision()).toBe(1)

    // A skapar ett pass och raderar ett gammalt, två revisioner till
    const created = await a.data.createSession('2026-09-01', 'custom', 'Testpass', [
      { exerciseId: 'x', exerciseName: 'Bänk', setEntries: [{ sets: 1, reps: 5, weight: 100 }] }
    ])
    await a.data.deleteSession(seeded[0])
    expect(db.latestRevision()).toBe(3)
    expect(db.latestSessionIds()).toContain(created.id)
    expect(db.latestSessionIds()).not.toContain(seeded[0])

    // B har fortfarande det raderade passet i cachen: en omstart får inte återuppliva det
    expect(await sessionIds(b)).toContain(seeded[0])
    await b.data.syncSeed()
    expect(await sessionIds(b)).not.toContain(seeded[0])
    expect(await sessionIds(b)).toContain(created.id)
    expect(db.latestRevision()).toBe(3)

    // Revisionskonflikt: A skriver igen, B försöker skriva på gammal revision
    await a.data.createSession('2026-09-02', 'custom', 'Pass från A', [])
    expect(db.latestRevision()).toBe(4)
    await expect(b.data.createSession('2026-09-02', 'custom', 'Pass från B', [])).rejects.toThrow('Serverkonflikt')
    expect(db.latestRevision()).toBe(4)
    expect(db.latestSessionIds()).not.toContain((await b.data.getAllSessions()).find(s => s.templateName === 'Pass från B')?.id)
    expect(b.sync.getCloudSyncError()).toContain('Serverkonflikt')

    // Fail-closed: en klient utan känd revision får inte skriva över serverdata
    const c = await newClient()
    await expect(c.data.createSession('2026-09-03', 'custom', 'Pass från C', [])).rejects.toThrow('lokala revisionen saknas')
    expect(db.latestRevision()).toBe(4)

    // Återhämtning: C läser in servern först, sedan går skrivningen igenom
    await c.data.syncSeed()
    expect((await sessionIds(c)).sort()).toEqual(db.latestSessionIds().sort())
    const fromC = await c.data.createSession('2026-09-03', 'custom', 'Pass från C', [])
    expect(db.latestRevision()).toBe(5)
    expect(db.latestSessionIds()).toContain(fromC.id)
  })

  it('Workern svarar 409 på en förlegad revision', async () => {
    const data = JSON.parse(db.rows[db.rows.length - 1].payload) as unknown
    const response = await apiFetch(`${API}/api/snapshot`, {
      method: 'POST',
      body: JSON.stringify({ expectedRevision: 0, data })
    })
    expect(response.status).toBe(409)
    expect(db.latestRevision()).toBe(5)
  })
})

import { describe, it, expect, beforeAll } from 'vitest'
import { getDb, migrate } from '../../netlify/functions/_db'

describe('database schema', () => {
  beforeAll(async () => {
    // Uses DATABASE_URL from .env.local — skip if not available
    if (!process.env.DATABASE_URL) {
      console.log('Skipping DB integration test: DATABASE_URL not set')
      return
    }
    await migrate()
  })

  it('creates tables without throwing', async () => {
    if (!process.env.DATABASE_URL) return
    const db = getDb()
    const bibs = await db.query.bibliographies.findMany()
    expect(Array.isArray(bibs)).toBe(true)
  })
})

export const config = { runtime: 'edge' }

import { getDb, migrate, savedSearches } from '../netlify/functions/_db'
import { eq, sql } from 'drizzle-orm'

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

export default async function handler(req: Request): Promise<Response> {
  await migrate()
  const db = getDb()

  if (req.method === 'GET') {
    const result = await db.execute(sql`
      SELECT id, name, params, created_at AS "createdAt",
             COALESCE(last_result_ids, '[]'::jsonb) AS "lastResultIds"
      FROM saved_searches
      ORDER BY created_at DESC
    `)
    return json(result.rows)
  }
  if (req.method === 'POST') {
    const { name, params } = await req.json()
    const [created] = await db.insert(savedSearches).values({ name, params }).returning()
    return json({ ...created, lastResultIds: [] }, 201)
  }
  if (req.method === 'PATCH') {
    const url = new URL(req.url)
    const id = parseInt(url.searchParams.get('id') ?? '0')
    if (!id || isNaN(id)) return json({ error: 'Invalid id' }, 400)

    const body = await req.json()
    const { lastResultIds } = body
    if (!Array.isArray(lastResultIds)) return json({ error: 'lastResultIds must be an array' }, 400)

    const result = await db.execute(sql`
      UPDATE saved_searches SET last_result_ids = ${JSON.stringify(lastResultIds)}::jsonb
      WHERE id = ${id} RETURNING id
    `)
    if (!result.rows.length) return new Response('Not Found', { status: 404 })
    return json({ id, lastResultIds })
  }
  if (req.method === 'DELETE') {
    const id = parseInt(new URL(req.url).searchParams.get('id') ?? '0')
    await db.delete(savedSearches).where(eq(savedSearches.id, id))
    return new Response(null, { status: 204 })
  }
  return new Response('Method Not Allowed', { status: 405 })
}

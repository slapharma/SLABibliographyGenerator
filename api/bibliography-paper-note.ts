export const config = { runtime: 'edge' }

import { sql } from 'drizzle-orm'
import { getDb, migrate } from '../netlify/functions/_db'

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

export default async function handler(req: Request): Promise<Response> {
  await migrate()
  const db = getDb()
  const url = new URL(req.url)
  const rowId = parseInt(url.searchParams.get('rowId') ?? '0')

  if (!rowId || isNaN(rowId)) return json({ error: 'Invalid rowId' }, 400)

  if (req.method === 'PATCH') {
    const body = await req.json()
    const { note } = body

    if (note === undefined || note === null) return json({ error: 'note is required' }, 400)
    if (typeof note !== 'string') return json({ error: 'note must be a string' }, 400)
    if (note.length > 2000) return json({ error: 'note exceeds 2000 characters' }, 400)

    const result = await db.execute(sql`
      UPDATE bibliography_papers SET note = ${note} WHERE id = ${rowId} RETURNING id
    `)

    if (!result.rows.length) return new Response('Not Found', { status: 404 })

    return json({ rowId, note })
  }

  return new Response('Method Not Allowed', { status: 405 })
}

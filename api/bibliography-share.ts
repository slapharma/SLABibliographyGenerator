export const config = { runtime: 'edge' }

import { sql } from 'drizzle-orm'
import { getDb, migrate } from '../netlify/functions/_db'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export default async function handler(req: Request): Promise<Response> {
  await migrate()
  const db = getDb()
  const url = new URL(req.url)
  const id = parseInt(url.searchParams.get('id') ?? '0')

  if (!id || isNaN(id)) return json({ error: 'Invalid id' }, 400)

  if (req.method === 'POST') {
    // Generate share token and enable sharing
    // First check if a token already exists (preserve it across enable/disable cycles)
    const existing = await db.execute(sql`
      SELECT share_token FROM bibliographies WHERE id = ${id}
    `)
    if (!existing.rows.length) return new Response('Not Found', { status: 404 })

    let token = (existing.rows[0] as any).share_token
    if (!token) {
      token = crypto.randomUUID()
      await db.execute(sql`
        UPDATE bibliographies SET share_token = ${token}, is_shared = true WHERE id = ${id}
      `)
    } else {
      await db.execute(sql`
        UPDATE bibliographies SET is_shared = true WHERE id = ${id}
      `)
    }

    const shareUrl = `${url.origin}/share/${token}`
    return json({ shareToken: token, shareUrl, isShared: true })
  }

  if (req.method === 'DELETE') {
    // Disable sharing but preserve the token for re-enabling
    const result = await db.execute(sql`
      UPDATE bibliographies SET is_shared = false WHERE id = ${id} RETURNING id
    `)
    if (!result.rows.length) return new Response('Not Found', { status: 404 })
    return json({ isShared: false })
  }

  return new Response('Method Not Allowed', { status: 405 })
}

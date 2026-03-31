export const config = { runtime: 'edge' }

import { sql } from 'drizzle-orm'
import { getDb, migrate } from '../netlify/functions/_db'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

export default async function handler(req: Request): Promise<Response> {
  await migrate()
  const db = getDb()
  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!token) return json({ error: 'token is required' }, 400)

  if (req.method === 'GET') {
    // Fetch bib by token — return 404 for both missing AND is_shared=false (prevents token enumeration)
    const bibs = await db.execute(sql`
      SELECT id, name, description, creator_name AS "creatorName",
             COALESCE(tags, '') AS tags, created_at AS "createdAt"
      FROM bibliographies
      WHERE share_token = ${token} AND is_shared = true
    `)
    if (!bibs.rows.length) return new Response('Not Found', { status: 404 })

    const bib = bibs.rows[0] as any
    const rows = await db.execute(sql`
      SELECT id, paper_data AS "paperData", added_at AS "addedAt"
      FROM bibliography_papers
      WHERE bibliography_id = ${bib.id}
      ORDER BY added_at ASC
    `)

    const papers = rows.rows.map((r: any) => ({
      rowId: r.id,
      paper: r.paperData,
      addedAt: r.addedAt,
      // note is intentionally excluded (notes are private)
    }))

    return json({ ...bib, papers })
  }

  return new Response('Method Not Allowed', { status: 405 })
}

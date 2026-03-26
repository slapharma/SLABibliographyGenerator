export const config = { runtime: 'edge' }

import { getDb, migrate, bibliographies } from '../netlify/functions/_db'
import { sql, eq } from 'drizzle-orm'

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

export default async function handler(req: Request): Promise<Response> {
  await migrate()
  const db = getDb()

  if (req.method === 'GET') {
    const result = await db.execute(sql`
      SELECT
        b.id,
        b.name,
        b.description,
        b.creator_name AS "creatorName",
        b.created_at AS "createdAt",
        b.updated_at AS "updatedAt",
        COUNT(bp.id)::int AS "paperCount"
      FROM bibliographies b
      LEFT JOIN bibliography_papers bp ON bp.bibliography_id = b.id
      GROUP BY b.id
      ORDER BY b.updated_at
    `)
    return json(result.rows)
  }

  if (req.method === 'POST') {
    const { name, description, creatorName } = await req.json()
    const [created] = await db.insert(bibliographies).values({ name, description, creatorName: creatorName ?? '' }).returning()
    return json(created, 201)
  }

  return new Response('Method Not Allowed', { status: 405 })
}

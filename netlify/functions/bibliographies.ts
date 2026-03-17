import type { Config } from '@netlify/functions'
import { getDb, migrate, bibliographies } from './_db'
import { sql } from 'drizzle-orm'

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

export default async (req: Request) => {
  await migrate()
  const db = getDb()

  if (req.method === 'GET') {
    const rows = await db
      .select({
        id: bibliographies.id,
        name: bibliographies.name,
        description: bibliographies.description,
        creatorName: bibliographies.creatorName,
        createdAt: bibliographies.createdAt,
        updatedAt: bibliographies.updatedAt,
        paperCount: sql<number>`(SELECT COUNT(*)::int FROM bibliography_papers WHERE bibliography_id = ${bibliographies.id})`,
      })
      .from(bibliographies)
      .orderBy(bibliographies.updatedAt)
    return json(rows)
  }

  if (req.method === 'POST') {
    const { name, description, creatorName } = await req.json()
    const [created] = await db.insert(bibliographies).values({ name, description, creatorName: creatorName ?? '' }).returning()
    return json(created, 201)
  }

  return new Response('Method Not Allowed', { status: 405 })
}

export const config: Config = { path: '/api/bibliographies' }

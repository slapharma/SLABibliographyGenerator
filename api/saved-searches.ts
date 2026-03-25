export const runtime = 'edge'

import { getDb, migrate, savedSearches } from '../netlify/functions/_db'
import { eq } from 'drizzle-orm'

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

export default async function handler(req: Request): Promise<Response> {
  await migrate()
  const db = getDb()

  if (req.method === 'GET') {
    const rows = await db.query.savedSearches.findMany({ orderBy: (t, { desc }) => [desc(t.createdAt)] })
    return json(rows)
  }
  if (req.method === 'POST') {
    const { name, params } = await req.json()
    const [created] = await db.insert(savedSearches).values({ name, params }).returning()
    return json(created, 201)
  }
  if (req.method === 'DELETE') {
    const id = parseInt(new URL(req.url).searchParams.get('id') ?? '0')
    await db.delete(savedSearches).where(eq(savedSearches.id, id))
    return new Response(null, { status: 204 })
  }
  return new Response('Method Not Allowed', { status: 405 })
}

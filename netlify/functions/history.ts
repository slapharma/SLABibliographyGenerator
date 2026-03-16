import type { Config } from '@netlify/functions'
import { getDb, migrate, searchHistory } from './_db'
import { eq } from 'drizzle-orm'

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

export default async (req: Request) => {
  await migrate()
  const db = getDb()

  if (req.method === 'GET') {
    const rows = await db.query.searchHistory.findMany({
      orderBy: (t, { desc }) => [desc(t.searchedAt)],
      limit: 100,
    })
    return json(rows)
  }
  if (req.method === 'DELETE') {
    const id = new URL(req.url).searchParams.get('id')
    if (id) {
      await db.delete(searchHistory).where(eq(searchHistory.id, parseInt(id)))
    } else {
      await db.delete(searchHistory)
    }
    return new Response(null, { status: 204 })
  }
  return new Response('Method Not Allowed', { status: 405 })
}

export const config: Config = { path: '/api/history' }

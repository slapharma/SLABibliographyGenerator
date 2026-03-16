import type { Config } from '@netlify/functions'
import { getDb, migrate, bibliographies, bibliographyPapers } from './_db'
import { eq } from 'drizzle-orm'

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

export default async (req: Request) => {
  await migrate()
  const db = getDb()
  const id = parseInt(new URL(req.url).searchParams.get('id') ?? '0')
  if (!id) return new Response('Missing id', { status: 400 })

  if (req.method === 'GET') {
    const bib = await db.query.bibliographies.findFirst({ where: eq(bibliographies.id, id) })
    if (!bib) return new Response('Not Found', { status: 404 })
    const rows = await db.query.bibliographyPapers.findMany({ where: eq(bibliographyPapers.bibliographyId, id) })
    const papers = rows.map(r => ({ rowId: r.id, paper: r.paperData }))
    return json({ ...bib, papers })
  }

  if (req.method === 'PATCH') {
    const { name, description } = await req.json()
    const [updated] = await db.update(bibliographies)
      .set({ name, description, updatedAt: new Date() })
      .where(eq(bibliographies.id, id))
      .returning()
    if (!updated) return new Response('Not Found', { status: 404 })
    return json(updated)
  }

  if (req.method === 'DELETE') {
    await db.delete(bibliographies).where(eq(bibliographies.id, id))
    return new Response(null, { status: 204 })
  }

  return new Response('Method Not Allowed', { status: 405 })
}

export const config: Config = { path: '/api/bibliography' }

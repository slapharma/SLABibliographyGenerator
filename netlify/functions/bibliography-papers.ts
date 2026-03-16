import type { Config } from '@netlify/functions'
import { getDb, migrate, bibliographyPapers, bibliographies } from './_db'
import { eq, and } from 'drizzle-orm'

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

export default async (req: Request) => {
  await migrate()
  const db = getDb()
  const url = new URL(req.url)

  if (req.method === 'POST') {
    const body = await req.json().catch(() => null)
    const { bibliographyId, paper } = body ?? {}
    if (!bibliographyId || typeof bibliographyId !== 'number' || !paper) {
      return new Response('Missing bibliographyId or paper', { status: 400 })
    }
    await db.update(bibliographies).set({ updatedAt: new Date() }).where(eq(bibliographies.id, bibliographyId))
    const [added] = await db.insert(bibliographyPapers)
      .values({ bibliographyId, paperData: paper })
      .returning()
    return json(added, 201)
  }

  if (req.method === 'DELETE') {
    const bibliographyId = parseInt(url.searchParams.get('bibliographyId') ?? '0')
    const paperId = parseInt(url.searchParams.get('paperId') ?? '0')
    await db.delete(bibliographyPapers)
      .where(and(eq(bibliographyPapers.bibliographyId, bibliographyId), eq(bibliographyPapers.id, paperId)))
    return new Response(null, { status: 204 })
  }

  return new Response('Method Not Allowed', { status: 405 })
}

export const config: Config = { path: '/api/bibliography-papers' }

export const config = { runtime: 'edge' }

import { getDb, migrate, bibliographyPapers, bibliographies } from '../netlify/functions/_db'
import { eq, and } from 'drizzle-orm'

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

export default async function handler(req: Request): Promise<Response> {
  await migrate()
  const db = getDb()
  const url = new URL(req.url)

  if (req.method === 'POST') {
    const body = await req.json().catch(() => null)
    const { bibliographyId, paper, note, searchParams } = body ?? {}
    if (!bibliographyId || typeof bibliographyId !== 'number' || !paper) {
      return new Response('Missing bibliographyId or paper', { status: 400 })
    }
    await db.update(bibliographies).set({ updatedAt: new Date() }).where(eq(bibliographies.id, bibliographyId))
    const [added] = await db.insert(bibliographyPapers)
      .values({ bibliographyId, paperData: paper, note: note ?? '', searchParams: searchParams ?? null })
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

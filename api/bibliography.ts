export const config = { runtime: 'edge' }

import { getDb, migrate, bibliographies, bibliographyPapers } from '../netlify/functions/_db'
import { eq, sql } from 'drizzle-orm'

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

export default async function handler(req: Request): Promise<Response> {
  await migrate()
  const db = getDb()
  const id = parseInt(new URL(req.url).searchParams.get('id') ?? '0')
  if (!id) return new Response('Missing id', { status: 400 })

  if (req.method === 'GET') {
    const bib = await db.query.bibliographies.findFirst({ where: eq(bibliographies.id, id) })
    if (!bib) return new Response('Not Found', { status: 404 })
    const rows = await db.query.bibliographyPapers.findMany({ where: eq(bibliographyPapers.bibliographyId, id) })
    const papers = rows.map(r => ({
      rowId: r.id,
      paper: r.paperData,
      note: (r as any).note ?? '',
      addedAt: r.addedAt!.toISOString(),
      searchParams: r.searchParams ?? undefined,
    }))
    return json({
      ...bib,
      tags: (bib as any).tags ?? '',
      shareToken: (bib as any).shareToken ?? null,
      isShared: (bib as any).isShared ?? false,
      papers,
    })
  }

  if (req.method === 'PATCH') {
    const body = await req.json()
    const { name, description, creatorName, tags } = body
    const [updated] = await db.update(bibliographies)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(creatorName !== undefined ? { creatorName } : {}),
        updatedAt: new Date(),
      })
      .where(eq(bibliographies.id, id))
      .returning()
    if (!updated) return new Response('Not Found', { status: 404 })
    // tags is stored via raw SQL since Drizzle schema doesn't have it yet
    if (tags !== undefined) {
      await db.execute(sql`UPDATE bibliographies SET tags = ${tags} WHERE id = ${id}`)
    }
    let currentTags = tags
    if (tags === undefined) {
      const result = await db.execute(sql`SELECT tags FROM bibliographies WHERE id = ${id}`)
      currentTags = (result.rows[0] as any)?.tags ?? ''
    }
    return json({ ...updated, tags: currentTags ?? '' })
  }

  if (req.method === 'DELETE') {
    await db.delete(bibliographies).where(eq(bibliographies.id, id))
    return new Response(null, { status: 204 })
  }

  return new Response('Method Not Allowed', { status: 405 })
}

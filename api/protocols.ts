// api/protocols.ts — Vercel Edge runtime
//
// CRUD for research protocols (PICO + inclusion criteria + extraction template).
//
//   GET  /api/protocols?bibliographyId=123   → list protocols for a bibliography
//   GET  /api/protocols?id=45                → fetch single protocol
//   POST /api/protocols                      → create
//   PUT  /api/protocols?id=45                → update
//   DELETE /api/protocols?id=45              → delete

export const config = { runtime: 'edge' }

import { eq } from 'drizzle-orm'
import { migrate, getDb, protocols } from '../netlify/functions/_db'

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

export default async function handler(req: Request): Promise<Response> {
  await migrate()
  const db = getDb()
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const bibliographyId = url.searchParams.get('bibliographyId')

  try {
    if (req.method === 'GET') {
      if (id) {
        const rows = await db.select().from(protocols).where(eq(protocols.id, Number(id)))
        if (!rows[0]) return json({ error: 'Not found' }, 404)
        return json(rows[0])
      }
      if (bibliographyId) {
        const rows = await db
          .select()
          .from(protocols)
          .where(eq(protocols.bibliographyId, Number(bibliographyId)))
        return json(rows)
      }
      return json({ error: 'id or bibliographyId required' }, 400)
    }

    if (req.method === 'POST') {
      const body = (await req.json()) as {
        bibliographyId: number
        picoQuestion: string
        inclusionCriteria: string
        extractionTemplate: unknown
      }
      if (!body.bibliographyId || !body.picoQuestion || !body.inclusionCriteria) {
        return json({ error: 'bibliographyId, picoQuestion, inclusionCriteria required' }, 400)
      }
      const [created] = await db
        .insert(protocols)
        .values({
          bibliographyId: body.bibliographyId,
          picoQuestion: body.picoQuestion,
          inclusionCriteria: body.inclusionCriteria,
          extractionTemplate: body.extractionTemplate ?? [],
        })
        .returning()
      return json(created, 201)
    }

    if (req.method === 'PUT') {
      if (!id) return json({ error: 'id required' }, 400)
      const body = (await req.json()) as Partial<{
        picoQuestion: string
        inclusionCriteria: string
        extractionTemplate: unknown
      }>
      const updates: Record<string, unknown> = { updatedAt: new Date() }
      if (body.picoQuestion != null) updates.picoQuestion = body.picoQuestion
      if (body.inclusionCriteria != null) updates.inclusionCriteria = body.inclusionCriteria
      if (body.extractionTemplate != null) updates.extractionTemplate = body.extractionTemplate
      const [updated] = await db
        .update(protocols)
        .set(updates)
        .where(eq(protocols.id, Number(id)))
        .returning()
      return json(updated)
    }

    if (req.method === 'DELETE') {
      if (!id) return json({ error: 'id required' }, 400)
      await db.delete(protocols).where(eq(protocols.id, Number(id)))
      return json({ success: true })
    }

    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    console.error('Protocols error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
}

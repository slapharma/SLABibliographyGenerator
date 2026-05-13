export const config = { runtime: 'edge' }

import { getDb, migrate, bibliographies, bibliographyPapers } from '../lib/_db'

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

interface ImportPaper {
  paper: any
  note?: string
  sheetName: string
}

interface ImportBody {
  name: string
  description?: string
  creatorName?: string
  tags?: string
  papers: ImportPaper[]
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  await migrate()
  const db = getDb()

  const body = await req.json().catch(() => null) as ImportBody | null
  if (!body?.name || !Array.isArray(body.papers)) {
    return new Response('Missing name or papers', { status: 400 })
  }

  const [created] = await db.insert(bibliographies).values({
    name: body.name,
    description: body.description ?? '',
    creatorName: body.creatorName ?? '',
  }).returning()

  if (body.papers.length > 0) {
    const rows = body.papers.map(p => ({
      bibliographyId: created.id,
      paperData: p.paper,
      note: p.note ?? '',
      searchParams: { source: 'xlsx-import', sheet: p.sheetName } as any,
    }))
    // Chunk inserts to stay within Neon HTTP request limits
    const CHUNK = 100
    for (let i = 0; i < rows.length; i += CHUNK) {
      await db.insert(bibliographyPapers).values(rows.slice(i, i + CHUNK))
    }
  }

  return json({ id: created.id, paperCount: body.papers.length }, 201)
}

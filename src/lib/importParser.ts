import * as XLSX from 'xlsx'
import type { Paper } from '../types'

export interface SheetRow {
  rowIndex: number
  raw: Record<string, string>
  paper: Paper | null
}

export interface ParsedSheet {
  name: string
  headers: string[]
  rows: SheetRow[]
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

function findCol(headers: string[], patterns: RegExp[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = norm(headers[i] ?? '')
    if (patterns.some(p => p.test(h))) return i
  }
  return -1
}

const splitAuthors = (s: string): string[] =>
  s.split(/\s*(?:,| and |;|&)\s*/).map(a => a.trim()).filter(Boolean)

function rowToPaper(sheetName: string, rowIndex: number, headers: string[], cells: string[]): Paper | null {
  const get = (i: number) => (i >= 0 && cells[i] != null ? String(cells[i]).trim() : '')

  const titleIdx = findCol(headers, [/^title$/, /^guidelines?/, /^studytitle$/, /^publication$/, /^formulation$/, /^source$/])
  const yearIdx = findCol(headers, [/^year$/, /dateregistered/, /^date$/])
  const authorIdx = findCol(headers, [/^authors?$/, /^authors$/, /sponsor/])
  const doiIdx = findCol(headers, [/doi/])
  const urlIdx = findCol(headers, [/^url$/, /website$/, /studyurl/, /link/])
  const sumIdx = findCol(headers, [/summary/, /abstract/, /description/, /keyoutcomes/])
  const journalIdx = findCol(headers, [/journal/, /^source\b/, /^source$/])
  const typeIdx = findCol(headers, [/publicationtype/, /studytype/, /^type$/])
  const noteIdx = findCol(headers, [/notes?$/, /comments?$/, /relevance/])

  const title = get(titleIdx)
  if (!title) return null

  const yearStr = get(yearIdx)
  const yearMatch = yearStr.match(/(\d{4})/)
  const year = yearMatch ? parseInt(yearMatch[1]) : undefined

  const authorStr = get(authorIdx)
  const authors = authorStr ? splitAuthors(authorStr) : []

  const doi = get(doiIdx).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim() || undefined
  const url = get(urlIdx) || (doi ? `https://doi.org/${doi}` : '#')

  const abstract = [get(sumIdx), get(noteIdx)].filter(Boolean).join(' — ') || undefined

  return {
    id: `imported:${sheetName.replace(/\s+/g, '_')}:${rowIndex}`,
    source: 'crossref',
    title,
    authors,
    journal: get(journalIdx) || undefined,
    year,
    doi,
    url,
    abstract,
    type: get(typeIdx) || undefined,
  }
}

export function parseWorkbook(arrayBuffer: ArrayBuffer): ParsedSheet[] {
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const result: ParsedSheet[] = []
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name]
    const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false, defval: '' })
    if (aoa.length === 0) continue
    const headers = (aoa[0] as any[]).map(c => (c == null ? '' : String(c).trim()))
    const rows: SheetRow[] = []
    for (let i = 1; i < aoa.length; i++) {
      const cells = (aoa[i] as any[]).map(c => (c == null ? '' : String(c)))
      if (cells.every(c => !c.trim())) continue
      const raw: Record<string, string> = {}
      headers.forEach((h, idx) => { raw[h || `col${idx}`] = cells[idx] ?? '' })
      rows.push({ rowIndex: i, raw, paper: rowToPaper(name, i, headers, cells) })
    }
    result.push({ name, headers, rows })
  }
  return result
}

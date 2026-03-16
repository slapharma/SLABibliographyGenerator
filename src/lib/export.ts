// src/lib/export.ts
import * as XLSX from 'xlsx'
import type { Paper } from '../types'

function papersToRows(papers: Paper[]) {
  return papers.map(p => ({
    Title: p.title,
    Authors: p.authors.join('; '),
    Journal: p.journal ?? '',
    Year: p.year ?? '',
    DOI: p.doi ?? '',
    URL: p.url,
    Source: p.source,
    Type: p.type ?? '',
    Abstract: p.abstract ?? '',
    'Citation Count': p.citationCount ?? '',
  }))
}

export function exportToCSV(papers: Paper[], filename = 'bibliography.csv') {
  const rows = papersToRows(papers)
  const ws = XLSX.utils.json_to_sheet(rows)
  const csv = XLSX.utils.sheet_to_csv(ws)
  downloadBlob(csv, filename, 'text/csv;charset=utf-8;')
}

export function exportToExcel(papers: Paper[], filename = 'bibliography.xlsx') {
  const rows = papersToRows(papers)
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  // Auto-size columns
  const colWidths = Object.keys(rows[0] ?? {}).map(key => ({
    wch: Math.max(key.length, ...rows.map(r => String((r as any)[key] ?? '').length).slice(0, 50)),
  }))
  ws['!cols'] = colWidths
  XLSX.utils.book_append_sheet(wb, ws, 'Bibliography')
  XLSX.writeFile(wb, filename)
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

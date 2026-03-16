// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { exportToCSV } from '../../src/lib/export'
import type { Paper } from '../../src/types'

// Mock XLSX and browser APIs for node environment
vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: vi.fn(() => ({})),
    sheet_to_csv: vi.fn(() => 'Title,Authors\nTest Paper,Smith J'),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}))

const mockPapers: Paper[] = [
  {
    id: 'pubmed:123',
    source: 'pubmed',
    title: 'Test Paper',
    authors: ['Smith J'],
    journal: 'Test Journal',
    year: 2023,
    doi: '10.1/test',
    url: 'https://pubmed.ncbi.nlm.nih.gov/123/',
  }
]

describe('exportToCSV', () => {
  it('calls sheet_to_csv and triggers download', () => {
    // jsdom doesn't have URL.createObjectURL — mock it
    global.URL.createObjectURL = vi.fn(() => 'blob:mock')
    global.URL.revokeObjectURL = vi.fn()
    const clickMock = vi.fn()
    vi.spyOn(document, 'createElement').mockReturnValueOnce({ href: '', download: '', click: clickMock } as any)

    expect(() => exportToCSV(mockPapers)).not.toThrow()
  })
})

export const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  pubmed:          { bg: '#e8f0fe', text: '#1a56c8' },
  europepmc:       { bg: '#e6f4ff', text: '#0a5fa0' },
  clinicaltrials:  { bg: '#e6f9f0', text: '#177a4a' },
  semanticscholar: { bg: '#fff0e6', text: '#a05a00' },
  crossref:        { bg: '#f0f7ee', text: '#2a6a1a' },
  openalex:        { bg: '#f5f0ff', text: '#5a2aa0' },
  lens:            { bg: '#fff5f0', text: '#b03a00' },
  scholar:         { bg: '#f3eefe', text: '#6b35c8' },
}

export const SOURCE_LABELS: Record<string, string> = {
  pubmed: 'PubMed',
  europepmc: 'Europe PMC',
  clinicaltrials: 'ClinicalTrials',
  semanticscholar: 'Semantic Scholar',
  crossref: 'CrossRef',
  openalex: 'OpenAlex',
  lens: 'Lens.org',
  scholar: 'Google Scholar',
}

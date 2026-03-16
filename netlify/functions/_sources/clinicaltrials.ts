import type { SearchParams, Paper } from './types'

export async function searchClinicalTrials(params: SearchParams): Promise<Paper[]> {
  const query = [params.indication, params.keywords].filter(Boolean).join(' ')
  const url = `https://clinicaltrials.gov/api/v2/studies?query.term=${encodeURIComponent(query)}&pageSize=1000&format=json`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return (data.studies ?? []).map((s: any): Paper => {
    const p = s.protocolSection
    const id = p?.identificationModule?.nctId ?? 'unknown'
    return {
      id: `clinicaltrials:${id}`,
      source: 'clinicaltrials',
      title: p?.identificationModule?.briefTitle ?? 'Unknown Trial',
      authors: [p?.contactsLocationsModule?.overallOfficials?.[0]?.name ?? 'Unknown PI'],
      journal: 'ClinicalTrials.gov',
      year: p?.statusModule?.startDateStruct?.date
        ? parseInt(p.statusModule.startDateStruct.date.slice(0, 4))
        : undefined,
      url: `https://clinicaltrials.gov/study/${id}`,
      abstract: p?.descriptionModule?.briefSummary,
      type: p?.designModule?.studyType,
    }
  })
}

# Phase 1 Testing Guide: Screening MVP

This guide walks through testing the Protocol-Driven Research Engine Phase 1 implementation (screening MVP).

## Overview

Phase 1 implements a complete screening pipeline:
1. User defines a research protocol (PICO + inclusion criteria)
2. System searches 6 literature sources in parallel
3. Batch screening via Claude Haiku (50 papers per call)
4. User reviews decisions in QC dashboard
5. Audit trail captured for all decisions

**Estimated Cost:** ~$0.01 per paper screened (Haiku pricing: ~$0.80/1M tokens)

## Test Workflow

### Step 1: Create a Protocol

**Request:**
```bash
curl -X POST http://localhost:8888/api/protocols \
  -H "Content-Type: application/json" \
  -d '{
    "bibliographyId": 1,
    "picoQuestion": "In adults with Type 2 diabetes, does GLP-1 agonist therapy reduce cardiovascular mortality compared to standard care?",
    "inclusionCriteria": "Randomized controlled trials published 2015-2025, adult participants (18+), English language",
    "extractionTemplate": [
      {"name": "population", "label": "Population", "type": "textarea", "required": true},
      {"name": "intervention", "label": "Intervention", "type": "textarea", "required": true},
      {"name": "outcomes", "label": "Outcomes", "type": "textarea", "required": true},
      {"name": "study_design", "label": "Study Design", "type": "text", "required": true}
    ]
  }'
```

**Expected Response:**
```json
{
  "protocolId": 1,
  "status": "created",
  "picoQuestion": "In adults with Type 2 diabetes..."
}
```

### Step 2: Execute Search

The system will search all 6 sources (PubMed, EuropePMC, ClinicalTrials.gov, Semantic Scholar, CrossRef, Scopus).

**Expected Results:**
- 50-200 papers from each source
- Total ~500 papers across all sources
- Parallel execution: ~5-10 seconds

### Step 3: Batch Screening

Papers are screened in batches of 50 to Haiku with optimized prompting.

**Sample Batch Request:**
```json
{
  "protocolId": 1,
  "papers": [
    {
      "id": "pubmed:36789123",
      "title": "GLP-1 Agonists and Cardiovascular Outcomes",
      "abstract": "A randomized controlled trial examining...",
      "year": 2023,
      "authors": ["Smith J", "Johnson A"]
    },
    // ... 49 more papers
  ]
}
```

**Claude Haiku Response:**
```json
[
  {
    "paperId": "pubmed:36789123",
    "decision": "relevant",
    "reasoning": "Directly addresses GLP-1 agonist effects on cardiovascular outcomes in Type 2 diabetes patients.",
    "confidence": 0.95
  },
  {
    "paperId": "pubmed:36789124",
    "decision": "irrelevant",
    "reasoning": "Focuses on Type 1 diabetes, not applicable to inclusion criteria.",
    "confidence": 0.92
  },
  // ... 48 more results
]
```

**Cost Calculation:**
- ~10 batches × 50 papers = 500 papers
- ~1500 tokens per batch
- Haiku: $0.80/1M input tokens
- Cost: (10 × 1500 / 1,000,000) × $0.80 = ~$0.01-0.02

### Step 4: QC Dashboard Review

User reviews AI decisions and can:
- **Approve:** Accept AI decision
- **Reject:** Disagree with AI decision
- **Override:** Change AI decision manually
- **Add Note:** Document reasoning

**Low Confidence Papers (<0.6):**
- Flagged automatically for manual review
- Require user decision before export

### Step 5: Export Results

Screening results exported with:
- Full audit trail (every decision + reasoning)
- Confidence scores
- User overrides logged
- Ready for Phase 2 (extraction)

## Expected Outcomes

**Metrics:**
- Screening throughput: 500-1000 papers/hour
- Accuracy: 85-95% (validated against expert review)
- Time savings: 80% vs manual screening
- Cost: ~$0.50 for 500 papers

**Quality Gates:**
- Papers with confidence <0.6: requires manual review
- User can override any AI decision
- All decisions logged with full audit trail

## Confidence Scoring

Claude Haiku provides confidence scores (0.0-1.0):

| Confidence | Interpretation | Action |
|------------|-----------------|--------|
| 0.9-1.0 | High certainty | Auto-approved by default |
| 0.7-0.9 | Good certainty | Review recommended |
| 0.6-0.7 | Borderline | Manual review suggested |
| <0.6 | Low certainty | Manual review required |

**Example Borderline Case:**
```json
{
  "paperId": "pubmed:36789125",
  "decision": "relevant",
  "reasoning": "Abstract mentions 'cardiovascular outcomes' but unclear if primary endpoint. Author is known expert in field.",
  "confidence": 0.58
}
```

## Testing Checklist

- [ ] Protocol creation via API succeeds
- [ ] Search execution returns papers from all 6 sources
- [ ] Screening batches process without errors
- [ ] Confidence scores distributed across full range (0.0-1.0)
- [ ] Low-confidence papers flagged in dashboard
- [ ] QC dashboard UI renders correctly
- [ ] User can approve/reject/override decisions
- [ ] Notes persist for audit trail
- [ ] Cost estimates accurate within 10%
- [ ] Audit log captures all decisions with reasoning

## Cost Verification

**Phase 1 End-to-End Cost:**

For 500 papers:
```
Screening: 10 batches × $0.0015/batch = $0.015
Estimated total: ~$0.03-0.05 per protocol
```

For 5000 papers:
```
Screening: 100 batches × $0.0015/batch = $0.15
Estimated total: ~$0.15-0.20 per protocol
```

## Next Steps (Phase 2)

Once screening is complete and approved:
1. Retrieve full-text PDFs for included papers
2. Extract structured data using Claude Haiku
3. Quality assessment via risk-of-bias scoring
4. Generate evidence tables

**Expected Phase 2 Cost:** +$0.15 for extraction + quality assessment

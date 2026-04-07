# Protocol-Driven Research Engine Design Specification

**Date:** 2026-04-07
**Project:** SLA Bibliography Generator
**Scope:** End-to-end automated systematic literature review pipeline with AI-powered screening, extraction, and synthesis
**Target Users:** Pharma evidence teams, health economics/HTA organizations
**Primary Differentiator:** Automation & AI reduce manual effort by 70-90% while maintaining full regulatory audit trail

---

## 1. Executive Summary

Transform the SLA Bibliography Generator from a **search & collection tool** into a **Protocol-Driven Research Engine** — an intelligent assistant that automates the systematic review workflow end-to-end.

**User Journey:**
1. Upload research protocol (PICO question, inclusion criteria, extraction template)
2. System executes: search → screen → extract → assess → synthesize
3. User reviews AI decisions in unified QC dashboard
4. Export regulatory-ready evidence report

**Key Outcomes:**
- **80% time savings** in screening (auto-classify relevance)
- **Full audit trail** (every decision logged with reasoning for regulators)
- **Defensible evidence synthesis** (transparent, traceable, reproducible)

---

## 2. System Architecture

### 2.1 Core Pipeline

```
Protocol Upload
      ↓
Search Executor (6 sources, parallel)
      ↓
Screening Engine (Claude AI)
      ↓
Full-Text Retrieval (PDF fetch & cache)
      ↓
Extraction Engine (Claude AI)
      ↓
Quality Assessment Engine (Claude AI)
      ↓
Synthesis Engine (Claude AI)
      ↓
Audit Log (Traceability)
      ↓
QC Dashboard (User review & approval)
      ↓
Export (PRISMA flow, evidence tables, PDF report)
```

### 2.2 Technology Stack

- **Frontend:** React 18 + TypeScript (existing)
- **Backend:** Netlify Edge Functions (existing)
- **AI:** Claude API (new — Haiku for screening/extraction, Sonnet for synthesis)
- **Database:** Neon PostgreSQL (existing)
- **PDF Processing:** PDF-parse library (new) for text extraction
- **Caching:** Redis or in-memory for PDF cache during extraction

### 2.3 Data Model Extensions

**Protocol Table**
```sql
CREATE TABLE protocols (
  id UUID PRIMARY KEY,
  bibliography_id UUID REFERENCES bibliographies,
  pico_question TEXT,
  inclusion_criteria TEXT,
  extraction_template JSONB,  -- user-defined fields
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Pipeline Execution Table**
```sql
CREATE TABLE pipeline_executions (
  id UUID PRIMARY KEY,
  protocol_id UUID REFERENCES protocols,
  status ENUM ('searching', 'screening', 'extracting', 'assessing', 'synthesizing', 'complete', 'failed'),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  total_papers INTEGER,
  included_count INTEGER,
  excluded_count INTEGER,
  error_message TEXT
);
```

**Audit Log Table**
```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  execution_id UUID REFERENCES pipeline_executions,
  paper_id VARCHAR,
  stage VARCHAR,  -- 'screening' | 'extraction' | 'quality_assessment'
  decision JSONB,  -- full Claude response + reasoning
  user_override BOOLEAN DEFAULT false,
  override_reason TEXT,
  created_at TIMESTAMP
);
```

---

## 3. User Workflow

### 3.1 Phase 1: Protocol Definition

**User Actions:**
1. Click "New Protocol" → modal opens
2. Fill in:
   - PICO question: "In heart failure patients, do ACE inhibitors reduce mortality vs. ARBs?"
   - Inclusion criteria: "RCTs, adults, published 2015-2025, English"
   - Data extraction fields: (multi-select from template or custom)
     - Primary outcome
     - Sample size
     - Follow-up duration
     - Study design
     - Risk of bias assessment
3. Save protocol → generates unique URL for sharing/reuse

**System Response:**
- Validates protocol completeness
- Stores in `protocols` table
- Ready for search execution

### 3.2 Phase 2: Automated Execution

**User Actions:**
1. Click "Run Protocol" → system initiates pipeline
2. User sees progress UI:
   ```
   ⏳ Searching 6 sources... (2-3 min)
   ⏳ Screening 320 papers... (5-10 min)
   ✅ Retrieved 45 full texts (2 min)
   ⏳ Extracting data from 45 papers... (10-15 min)
   ⏳ Quality assessment... (3-5 min)
   ⏳ Generating synthesis... (2-3 min)
   ```
3. Email notification when complete

**System Actions:**
- Executes 6-source search using existing adapters
- Logs execution start in `pipeline_executions` table
- Streams screening results to dashboard in real-time

### 3.3 Phase 3: QC Dashboard

**Screening QC View:**
- List of papers: title, abstract, screening decision, confidence score
- User can: approve, toggle Include/Exclude, add notes
- Bulk actions: "Approve all high-confidence, review low-confidence"
- Stats: "45 papers included, 275 excluded, 2 pending review"

**Extraction QC View:**
- Extracted data table (rows = papers, cols = fields)
- Low-confidence extractions highlighted (< 0.70 confidence)
- Click cell → shows PDF snippet showing source location
- User can: approve, edit, mark as "requires manual review"
- Flag missing data: "⚠️ 3 papers missing primary outcome"

**Quality Assessment QC View:**
- Risk of bias summary table
- Outlier detection: flags studies with unusual values
- User reviews and approves quality scores

### 3.4 Phase 4: Export

**Available Exports:**

1. **PRISMA Flow Diagram** (auto-generated)
   ```
   Identified: 320 records
   Screened: 320
   Excluded: 275
   Full-text: 45
   Included: 40
   ```

2. **Evidence Summary Table**
   - Columns: Author/Year, Design, N, Primary Outcome, Effect Size, Risk of Bias
   - Ready to paste into Word/PowerPoint
   - Includes source snippets for every extracted value

3. **Risk of Bias Summary**
   - Visual RoB traffic-light table
   - Summary scores per domain

4. **PDF Report**
   - Title page
   - PRISMA checklist
   - Flow diagram
   - Evidence tables
   - Quality summary
   - Methods (extracted from protocol)

---

## 4. Core Components (AI Engines)

### 4.1 Screening Engine

**Purpose:** Classify papers as Include/Exclude based on inclusion criteria
**Input:** Title, abstract, inclusion criteria
**Model:** Claude Haiku (cost-optimized)
**Batching:** 50 papers per API call

**Prompt Template:**
```
You are a systematic review expert. Classify this paper as INCLUDE or EXCLUDE.

Inclusion Criteria:
{inclusion_criteria}

Paper Title: {title}
Abstract: {abstract}

Respond in JSON:
{
  "decision": "INCLUDE" or "EXCLUDE",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation"
}
```

**Output & Storage:**
- Decision + confidence logged to `audit_log` table
- Screening view displays with reasoning visible
- User can override; override logged with reason

**Cost Optimization:**
- Batch 50 papers → ~$0.05 per 50 papers (Haiku pricing)
- Screening 500 papers ~$0.50 total

### 4.2 Extraction Engine

**Purpose:** Pull structured data from full-text PDFs
**Input:** PDF text, extraction template, field definitions
**Model:** Claude Haiku (cost-optimized)
**Processing:** One paper at a time (PDF too large for batch)

**Workflow:**
1. Fetch PDF (store in temporary Redis cache)
2. Extract text using pdf-parse library
3. Chunk text into sections: abstract, methods, results, discussion
4. Call Claude for each field in extraction template:
   ```
   Extract: {field_name}
   Definition: {field_definition}
   From text: {relevant_section}
   Return: {"value": "...", "confidence": 0.0-1.0, "source_snippet": "..."}
   ```
5. Log extraction result + confidence to `audit_log`
6. Clean up PDF from cache

**Output & Storage:**
- Extracted data stored in `pipeline_executions.extracted_data` (JSONB)
- Extraction QC view shows with confidence scores
- Low-confidence extractions flagged for manual review

**Cost Optimization:**
- Haiku at ~$0.0005 per 1K tokens
- Average paper extraction: 2-3K tokens → ~$0.001-0.002 per paper
- 50 papers: ~$0.05-0.10 total

### 4.3 Quality Assessment Engine

**Purpose:** Generate risk of bias and study quality scores
**Input:** Study design, methods section, sample characteristics
**Model:** Claude Haiku

**Assessment Domains:**
- Allocation concealment (selection bias)
- Blinding (performance/detection bias)
- Attrition/completeness (attrition bias)
- Selective reporting (reporting bias)
- Other bias (domain-specific)

**Output Format:**
```json
{
  "rob_scores": {
    "allocation_concealment": { "risk": "low", "reasoning": "..." },
    "blinding": { "risk": "high", "reasoning": "..." },
    ...
  },
  "overall_quality": 7,  // 0-10 scale
  "concerns": ["Small sample size", "Short follow-up"]
}
```

### 4.4 Synthesis Engine

**Purpose:** Generate evidence summaries, comparison tables, key findings
**Input:** All extracted data from included papers
**Model:** Claude Sonnet (higher capability for synthesis)

**Outputs:**
1. **Evidence Profile:**
   - Key question
   - Number of studies/participants
   - Summary of evidence by outcome
   - Certainty of evidence assessment (GRADE-style)

2. **Key Findings Summary:**
   - 2-3 paragraph narrative synthesis
   - Highlights differences between subgroups if applicable
   - Notes limitations and uncertainties

3. **Comparison Table:**
   - Auto-formatted evidence table
   - Ready for regulatory submission

---

## 5. Data Flow & Processing

### 5.1 Search Execution (Existing)
- Reuse existing 6-source search adapters
- Input: indication, keywords, date range, country, bibliographyType
- Output: 200-500 papers with title/abstract
- Time: 2-3 minutes

### 5.2 Screening (New)
- Input: 200-500 papers
- Process: Batch Claude calls (50 papers per batch)
- Filtering: Auto-exclude clear rejects, keep borderline for QC review
- Output: 20-80 papers marked for full-text retrieval
- Time: 5-10 minutes
- Cost: ~$0.50

### 5.3 Full-Text Retrieval (New)
- Input: 20-80 papers (DOI, PubMed ID, URL)
- Process:
  - Try DOI resolver → PubMed API → direct URL
  - Fetch PDF, store in Redis cache (TTL: 1 hour)
  - Fall back to plain text if PDF unavailable
- Output: PDF + cached text for extraction
- Time: 2 minutes

### 5.4 Extraction (New)
- Input: 20-80 PDFs + extraction template
- Process:
  - Extract text from PDF using pdf-parse
  - Chunk by section (abstract, methods, results)
  - Call Claude for each field in template
  - Confidence scoring per field
- Output: Structured JSON for each paper
- Time: 10-15 minutes
- Cost: ~$0.05-0.10

### 5.5 Quality Assessment (New)
- Input: Study design + methods text
- Process: Claude evaluates bias domains
- Output: RoB scores + quality summary
- Time: 3-5 minutes
- Cost: ~$0.03

### 5.6 Synthesis (New)
- Input: All extracted data + study characteristics
- Process: Claude generates narrative + tables
- Output: Evidence profile, comparison tables
- Time: 2-3 minutes
- Cost: ~$0.05 (Sonnet pricing)

### 5.7 Audit Logging (New)
- Every decision (screening, extraction, QC) logged to `audit_log` table
- Includes: stage, decision, Claude reasoning, timestamp, user overrides
- Purpose: Full regulatory traceability

---

## 6. Error Handling & Quality Control

### 6.1 Paper-Level QC

**Screening QC:**
- Display AI reasoning alongside decision
- User can toggle Include/Exclude
- Override logged with reason

**Extraction QC:**
- Highlight low-confidence extractions (< 0.70)
- Show PDF snippet showing source location
- Allow manual correction
- Flag missing required fields

**Quality Assessment QC:**
- Review RoB scores
- Approve or adjust quality ratings
- Outlier detection: flag unusual values

### 6.2 Batch-Level QC

**Pre-Export Validation:**
- Check all required fields populated
- Flag studies with missing critical data
- Generate "data completeness" report
- Allow user to exclude incomplete studies before export

**PRISMA Compliance:**
- Auto-generate PRISMA checklist based on protocol
- Flag missing items (e.g., if no blinding mentioned, flag potential bias)

### 6.3 Error Recovery

**PDF Retrieval Failures:**
- Log failed papers
- Allow user to manually upload PDF or mark "unable to retrieve"
- Continue pipeline with other papers

**Low-Confidence Extraction:**
- If confidence < 0.50 on critical field, require manual entry before export
- Offer user choice: "Extract from PDF yourself or exclude paper"

**Claude API Failures:**
- Retry logic: exponential backoff, max 3 attempts
- If persistent failure: flag paper for manual extraction
- Log error to audit trail for transparency

---

## 7. Phasing & MVP Strategy

### Phase 1: Screening MVP (Weeks 1-4)

**Deliverable:** Search → Auto-screen → QC dashboard → Export screening results

**Features:**
- Protocol template (simplified: just PICO + inclusion criteria)
- 6-source search (existing)
- Claude screening (50-paper batches)
- Screening QC dashboard (approve/reject decisions)
- Export: PRISMA flow diagram + included papers list

**User Value:** "We screened 500 papers, included 45" in 20 minutes (vs 10+ hours manual)

**Effort:** 2-3 engineers, 4 weeks

**Cost per Run:** ~$0.50

### Phase 2: Extraction & QC (Weeks 5-10)

**Deliverable:** Full-text retrieval → Extraction → Quality assessment → QC dashboard

**Features:**
- Auto-fetch PDFs (DOI + PubMed API)
- Claude extraction (user-defined field templates)
- Quality assessment (RoB + quality scores)
- Extraction QC dashboard (side-by-side PDF viewing)
- Data completeness validation

**User Value:** "We extracted data from 45 papers" in 20 minutes (vs 8-10 hours manual)

**Effort:** 2 engineers, 6 weeks

**Cost per Run:** ~$0.15 (extraction + quality)

### Phase 3: Synthesis & Regulatory Export (Weeks 11-14)

**Deliverable:** Auto-synthesis → PRISMA compliance → PDF report generation

**Features:**
- Claude evidence synthesis (narrative + tables)
- Auto-PRISMA flow diagram
- Risk of bias visualization
- PDF report generator (title, PRISMA checklist, flow, tables, summary)
- Audit trail export (for regulatory submission)

**User Value:** "We have a complete, regulatory-ready evidence report" (vs 5-10 hours manual synthesis)

**Effort:** 1-2 engineers, 4 weeks

**Cost per Run:** ~$0.20 (synthesis + export)

### Total MVP Cost Per Protocol Run
- Phase 1: ~$0.50
- Phase 1+2: ~$0.65
- Phase 1+2+3: ~$0.85

**At scale (100 protocols/month):** ~$85/month in API costs — negligible for pharma customers.

---

## 8. UI/UX Specifications

### 8.1 New Pages

**Protocol Manager Page** (`/protocols`)
- List all protocols (for current bibliography)
- Create new protocol (modal with form)
- Clone existing protocol
- Each row shows: Name, PICO question, Last run, Status

**Protocol Detail Page** (`/protocols/:id`)
- View/edit protocol
- Tab: "Definition" (PICO, criteria, extraction template)
- Tab: "Executions" (list of past runs with status/timestamps)

**Pipeline Execution Page** (`/protocols/:id/executions/:executionId`)
- Real-time progress UI (searching → screening → extracting)
- Email notification link when complete

**QC Dashboard** (`/protocols/:id/executions/:executionId/qc`)
- Tab: "Screening" (approve/reject papers)
- Tab: "Extraction" (approve/edit/flag extracted data)
- Tab: "Quality" (review RoB scores)
- Export button (when QC complete)

### 8.2 Component Changes

**Existing SearchForm:**
- Add "Save to Protocol" button (convert search to protocol)
- Show protocol templates dropdown

**Existing BibliographyDetailPage:**
- Add "Manage Protocols" section
- Show protocol execution history

---

## 9. Database Schema Changes

See Section 2.3 (Data Model Extensions) for full SQL.

**New Tables:**
- `protocols` (research protocol definitions)
- `pipeline_executions` (one per protocol run)
- `audit_log` (decisions + reasoning at every stage)

**Migration Strategy:**
- Add tables via Netlify DB migrations
- No changes to existing `papers` or `bibliographies` tables
- Backwards compatible

---

## 10. Testing Strategy

### Unit Tests
- Screening engine prompts (mock Claude, verify output format)
- Extraction field parsing (mock PDFs, verify field extraction)
- Quality assessment logic
- PRISMA flow diagram generation

### Integration Tests
- End-to-end pipeline (5-paper test set)
- QC dashboard user overrides
- PDF retrieval (mock API)
- Export generation

### E2E Tests (User Workflows)
- Upload protocol → run search → screen → QC → export
- Clone protocol, run again
- Test error handling (PDF retrieval failure, low-confidence extraction)

---

## 11. Success Criteria

**Functional:**
- ✅ End-to-end pipeline runs for 50+ papers in < 30 minutes
- ✅ Screening accuracy ≥ 90% (measured against manual gold standard)
- ✅ Extracted data completeness ≥ 95%
- ✅ All decisions logged with reasoning (100% audit trail)

**User:**
- ✅ 70% time savings vs manual screening (measured in user study)
- ✅ Users feel confident in auto-decisions (NPS ≥ 8/10)
- ✅ Regulatory feedback: "Audit trail is defensible"

**Commercial:**
- ✅ Pharma pilot customers adopt protocol-based workflow
- ✅ HTA customers request it for regulatory submissions
- ✅ Competitive differentiation clear vs Covidence/DistillerSR

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Claude hallucinations in extraction | Low-confidence flagging + QC dashboard + manual override |
| PDF parsing failures | Fallback to plain-text extraction; allow manual upload |
| Slow full-text retrieval | Parallel DOI/PubMed lookups; cache PDFs |
| User overload in QC (50+ papers) | Bulk approve/filter by confidence; flagging low-confidence only |
| Regulatory pushback on AI decisions | Full audit trail + reasoning transparency |
| Cost scaling with large protocols (500+ papers) | Optimize batching; use Haiku for screening/extraction |

---

## 13. Future Enhancements (Post-MVP)

- Multi-language support (auto-translate non-English papers)
- Subgroup analysis detection (auto-flag papers reporting subgroups)
- Network meta-analysis data preparation
- GRADE certainty of evidence assessment
- Integration with protocol registries (PROSPERO auto-import)
- API for external tools (Covidence, RevMan export)

---

## 14. Deployment & Operations

**Environment Variables Needed:**
- `CLAUDE_API_KEY` (existing)
- `SEMANTIC_SCHOLAR_KEY` (existing)
- `REDIS_URL` (new — for PDF cache)

**Infrastructure:**
- Redis instance (temporary PDF cache)
- Database migrations (Netlify DB)
- Increase function timeout: 15 minutes (vs current 10)

**Monitoring:**
- Log Claude API usage per protocol
- Track QC override rate (high rate = low AI confidence)
- Monitor PDF retrieval success rate

---

## Appendix: Example Protocol

```json
{
  "pico_question": "In patients with heart failure, do ACE inhibitors reduce all-cause mortality compared to ARBs?",
  "inclusion_criteria": "Randomized controlled trials; adults (≥18 years); published 2010-2026; English; follow-up ≥6 months",
  "extraction_template": [
    "primary_outcome",
    "sample_size",
    "follow_up_duration_months",
    "study_design",
    "population_mean_age",
    "drug_class",
    "comparator_class",
    "primary_effect_measure",
    "effect_size",
    "confidence_interval_lower",
    "confidence_interval_upper"
  ],
  "bibliography_type": "clinical"
}
```

---

**Document Version:** 1.0
**Status:** Design Review Ready
**Next Step:** Spec review → User approval → Implementation planning

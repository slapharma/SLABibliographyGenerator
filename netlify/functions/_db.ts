// netlify/functions/_db.ts
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { pgTable, serial, text, integer, timestamp, jsonb, varchar, decimal } from 'drizzle-orm/pg-core'

// ── Schema ───────────────────────────────────────────────
export const bibliographies = pgTable('bibliographies', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  creatorName: text('creator_name').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const bibliographyPapers = pgTable('bibliography_papers', {
  id: serial('id').primaryKey(),
  bibliographyId: integer('bibliography_id').notNull().references(() => bibliographies.id, { onDelete: 'cascade' }),
  paperData: jsonb('paper_data').notNull(),
  addedAt: timestamp('added_at').defaultNow().notNull(),
  note: text('note').notNull().default(''),
  searchParams: jsonb('search_params'),
})

export const savedSearches = pgTable('saved_searches', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  params: jsonb('params').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const searchHistory = pgTable('search_history', {
  id: serial('id').primaryKey(),
  params: jsonb('params').notNull(),
  resultCount: integer('result_count').notNull().default(0),
  searchedAt: timestamp('searched_at').defaultNow().notNull(),
})

export const protocols = pgTable('protocols', {
  id: serial('id').primaryKey(),
  bibliographyId: integer('bibliography_id').notNull().references(() => bibliographies.id, { onDelete: 'cascade' }),
  picoQuestion: text('pico_question').notNull(),
  inclusionCriteria: text('inclusion_criteria').notNull(),
  extractionTemplate: jsonb('extraction_template').notNull(), // user-defined fields
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const pipelineExecutions = pgTable('pipeline_executions', {
  id: serial('id').primaryKey(),
  protocolId: integer('protocol_id').notNull().references(() => protocols.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('searching'), // 'searching' | 'screening' | 'extracting' | 'assessing' | 'synthesizing' | 'complete' | 'failed'
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  totalPapers: integer('total_papers').notNull().default(0),
  includedCount: integer('included_count').notNull().default(0),
  excludedCount: integer('excluded_count').notNull().default(0),
  errorMessage: text('error_message'),
})

export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  executionId: integer('execution_id').notNull().references(() => pipelineExecutions.id, { onDelete: 'cascade' }),
  paperId: varchar('paper_id').notNull(),
  stage: varchar('stage').notNull(), // 'screening' | 'extraction' | 'quality_assessment'
  decision: jsonb('decision').notNull(), // full Claude response + reasoning
  userDecision: text('user_decision'), // 'approved' | 'rejected' | 'manual_override'
  userNote: text('user_note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ── Phase 2: Extraction + Quality Assessment ────────────
export const extractionResults = pgTable('extraction_results', {
  id: serial('id').primaryKey(),
  executionId: integer('execution_id').notNull().references(() => pipelineExecutions.id, { onDelete: 'cascade' }),
  paperId: varchar('paper_id').notNull(),
  fieldName: varchar('field_name').notNull(),
  extractedValue: jsonb('extracted_value'),
  rawText: text('raw_text'),
  confidence: decimal('confidence', { precision: 3, scale: 2 }),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const qualityAssessments = pgTable('quality_assessments', {
  id: serial('id').primaryKey(),
  executionId: integer('execution_id').notNull().references(() => pipelineExecutions.id, { onDelete: 'cascade' }),
  paperId: varchar('paper_id').notNull(),
  biasDomainSelection: varchar('bias_domain_selection', { length: 16 }),
  biasDomainPerformance: varchar('bias_domain_performance', { length: 16 }),
  biasDomainDetection: varchar('bias_domain_detection', { length: 16 }),
  biasDomainAttrition: varchar('bias_domain_attrition', { length: 16 }),
  biasDomainReporting: varchar('bias_domain_reporting', { length: 16 }),
  biasReasoning: jsonb('bias_reasoning'),
  overallQuality: integer('overall_quality'),
  assessmentReasoning: text('assessment_reasoning'),
  claudeModel: varchar('claude_model', { length: 64 }),
  userDecision: text('user_decision'),
  userOverrideReasoning: text('user_override_reasoning'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

const schema = { bibliographies, bibliographyPapers, savedSearches, searchHistory, protocols, pipelineExecutions, auditLog, extractionResults, qualityAssessments }

// ── Client ───────────────────────────────────────────────
let _db: ReturnType<typeof drizzle> | null = null

export function getDb() {
  if (!_db) {
    const sql = neon(process.env.DATABASE_URL!)
    _db = drizzle(sql, { schema })
  }
  return _db
}

// ── Migrations (run once per cold start) ─────────────────
let _migrated = false

export async function migrate() {
  if (_migrated) return
  const db = getDb()
  // Neon HTTP driver does not support multiple statements in one execute() call
  // — each CREATE TABLE must be a separate round-trip
  await db.execute(`
    CREATE TABLE IF NOT EXISTS bibliographies (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS bibliography_papers (
      id SERIAL PRIMARY KEY,
      bibliography_id INTEGER NOT NULL REFERENCES bibliographies(id) ON DELETE CASCADE,
      paper_data JSONB NOT NULL,
      added_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS saved_searches (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      params JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS search_history (
      id SERIAL PRIMARY KEY,
      params JSONB NOT NULL,
      result_count INTEGER NOT NULL DEFAULT 0,
      searched_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `)
  await db.execute(`
    ALTER TABLE bibliographies ADD COLUMN IF NOT EXISTS creator_name TEXT NOT NULL DEFAULT '';
  `)
  await db.execute(`ALTER TABLE bibliography_papers ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT ''`)
  await db.execute(`ALTER TABLE bibliographies ADD COLUMN IF NOT EXISTS tags TEXT NOT NULL DEFAULT ''`)
  await db.execute(`ALTER TABLE bibliographies ADD COLUMN IF NOT EXISTS share_token TEXT`)
  await db.execute(`ALTER TABLE bibliographies ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT false`)
  await db.execute(`ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS last_result_ids JSONB NOT NULL DEFAULT '[]'`)
  await db.execute(`ALTER TABLE bibliography_papers ADD COLUMN IF NOT EXISTS search_params JSONB`)

  // ── Protocol-Driven Research Engine Tables ──────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS protocols (
      id SERIAL PRIMARY KEY,
      bibliography_id INTEGER NOT NULL REFERENCES bibliographies(id) ON DELETE CASCADE,
      pico_question TEXT NOT NULL,
      inclusion_criteria TEXT NOT NULL,
      extraction_template JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS pipeline_executions (
      id SERIAL PRIMARY KEY,
      protocol_id INTEGER NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'searching',
      started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      completed_at TIMESTAMPTZ,
      total_papers INTEGER NOT NULL DEFAULT 0,
      included_count INTEGER NOT NULL DEFAULT 0,
      excluded_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      execution_id INTEGER NOT NULL REFERENCES pipeline_executions(id) ON DELETE CASCADE,
      paper_id VARCHAR NOT NULL,
      stage VARCHAR NOT NULL,
      decision JSONB NOT NULL,
      user_decision TEXT,
      user_note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `)
  // ── Phase 2: extraction + quality assessment ────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS extraction_results (
      id SERIAL PRIMARY KEY,
      execution_id INTEGER NOT NULL REFERENCES pipeline_executions(id) ON DELETE CASCADE,
      paper_id VARCHAR NOT NULL,
      field_name VARCHAR NOT NULL,
      extracted_value JSONB,
      raw_text TEXT,
      confidence DECIMAL(3,2),
      error_message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS quality_assessments (
      id SERIAL PRIMARY KEY,
      execution_id INTEGER NOT NULL REFERENCES pipeline_executions(id) ON DELETE CASCADE,
      paper_id VARCHAR NOT NULL,
      bias_domain_selection VARCHAR(16),
      bias_domain_performance VARCHAR(16),
      bias_domain_detection VARCHAR(16),
      bias_domain_attrition VARCHAR(16),
      bias_domain_reporting VARCHAR(16),
      bias_reasoning JSONB,
      overall_quality INTEGER,
      assessment_reasoning TEXT,
      claude_model VARCHAR(64),
      user_decision TEXT,
      user_override_reasoning TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `)
  _migrated = true
}

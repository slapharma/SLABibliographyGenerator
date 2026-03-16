// netlify/functions/_db.ts
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { pgTable, serial, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core'

// ── Schema ───────────────────────────────────────────────
export const bibliographies = pgTable('bibliographies', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const bibliographyPapers = pgTable('bibliography_papers', {
  id: serial('id').primaryKey(),
  bibliographyId: integer('bibliography_id').notNull().references(() => bibliographies.id, { onDelete: 'cascade' }),
  paperData: jsonb('paper_data').notNull(),
  addedAt: timestamp('added_at').defaultNow().notNull(),
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

const schema = { bibliographies, bibliographyPapers, savedSearches, searchHistory }

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
  await db.execute(`
    CREATE TABLE IF NOT EXISTS bibliographies (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS bibliography_papers (
      id SERIAL PRIMARY KEY,
      bibliography_id INTEGER NOT NULL REFERENCES bibliographies(id) ON DELETE CASCADE,
      paper_data JSONB NOT NULL,
      added_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS saved_searches (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      params JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS search_history (
      id SERIAL PRIMARY KEY,
      params JSONB NOT NULL,
      result_count INTEGER NOT NULL DEFAULT 0,
      searched_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
  `)
  _migrated = true
}

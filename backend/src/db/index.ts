/**
 * SQLite Database Layer using better-sqlite3
 */
import Database from 'better-sqlite3';
import path from 'path';
import { ReviewSession, SessionSummary } from '../types';

const DB_PATH = path.join(process.cwd(), 'data', 'reviews.db');

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS review_sessions (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    language TEXT,
    review_json TEXT,
    score INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_created_at ON review_sessions(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_score ON review_sessions(score);
`);

export interface SessionRecord {
  id: string;
  code: string;
  language: string | null;
  review_json: string | null;
  score: number | null;
  created_at: string;
  updated_at: string;
}

export function createSession(code: string, language?: string): SessionRecord {
  const id = crypto.randomUUID();
  const stmt = db.prepare(`
    INSERT INTO review_sessions (id, code, language, created_at, updated_at)
    VALUES (?, ?, ?, datetime('now'), datetime('now'))
  `);
  stmt.run(id, code, language || null);
  return getSessionById(id)!;
}

export function getSessionById(id: string): SessionRecord | null {
  const stmt = db.prepare('SELECT * FROM review_sessions WHERE id = ?');
  return stmt.get(id) as SessionRecord | null;
}

export function updateSessionReview(
  id: string,
  reviewJson: string,
  score: number
): SessionRecord | null {
  const stmt = db.prepare(`
    UPDATE review_sessions
    SET review_json = ?, score = ?, updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(reviewJson, score, id);
  return getSessionById(id);
}

export function deleteSession(id: string): boolean {
  const stmt = db.prepare('DELETE FROM review_sessions WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function getAllSessions(limit = 50): SessionRecord[] {
  const stmt = db.prepare(`
    SELECT * FROM review_sessions
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(limit) as SessionRecord[];
}

export function recordToSession(record: SessionRecord): ReviewSession {
  return {
    id: record.id,
    code: record.code,
    language: record.language || undefined,
    review: record.review_json ? JSON.parse(record.review_json) : null,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export function recordToSummary(record: SessionRecord): SessionSummary {
  return {
    id: record.id,
    language: record.language || undefined,
    score: record.score || undefined,
    createdAt: record.created_at,
  };
}

// Close database connection on process exit
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  db.close();
  process.exit(0);
});

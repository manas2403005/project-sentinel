import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), '..', 'docs', 'sentinel.db');

function initializeDatabase(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_name TEXT NOT NULL,
      bug_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      description TEXT,
      timestamp TEXT NOT NULL,
      resolved_at TEXT
    )
  `);
}

export async function GET() {
  try {
    const db = new Database(DB_PATH);
    initializeDatabase(db);
    const incidents = db.prepare('SELECT * FROM incidents ORDER BY timestamp DESC').all();
    db.close();
    return NextResponse.json(incidents);
  } catch (error) {
    console.error('Failed to fetch incidents:', error);
    return NextResponse.json({ error: 'Failed to fetch incidents' }, { status: 500 });
  }
}
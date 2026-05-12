import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), '..', 'docs', 'sentinel.db');

function initializeDatabase(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unknown',
      last_checked TEXT,
      incident_count INTEGER DEFAULT 0
    )
  `);

  const insertService = db.prepare(`
    INSERT OR IGNORE INTO services (id, name, status, incident_count)
    VALUES (?, ?, 'healthy', 0)
  `);
  insertService.run('sms-service', 'sms-service');
  insertService.run('payment-service', 'payment-service');
}

export async function GET() {
  try {
    const db = new Database(DB_PATH);
    initializeDatabase(db);
    const services = db.prepare('SELECT * FROM services').all() as Array<{id: string; name: string; status: string; last_checked: string; incident_count: number}>;

    // Check each service for active incidents and override status to critical if needed
    for (const service of services) {
      const activeIncident = db.prepare(
        "SELECT id FROM incidents WHERE service_name = ? AND status = 'active'"
      ).get(service.id);

      if (activeIncident) {
        service.status = 'critical';
      }
    }

    db.close();
    return NextResponse.json(services);
  } catch (error) {
    console.error('Failed to fetch services:', error);
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), '..', 'docs', 'sentinel.db');
const LOG_PATH = path.join(process.cwd(), '..', 'docs', 'incident-history.log');

interface Incident {
  id: number;
  service_name: string;
  bug_type: string;
  status: string;
  description: string;
  timestamp: string;
  resolved_at: string | null;
}

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

function parseLogFile(): Incident[] {
  const incidents: Incident[] = [];
  try {
    if (fs.existsSync(LOG_PATH)) {
      const content = fs.readFileSync(LOG_PATH, 'utf-8');
      const lines = content.split('\n');
      let id = 1000;
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('##') || trimmed.startsWith('(') || trimmed.startsWith('-')) {
          continue;
        }
        const parts = trimmed.split('|').map(p => p.trim());
        if (parts.length >= 5) {
          const timestamp = parts[0];
          const service = parts[1];
          const bugType = parts[2];
          const status = parts[3];
          const description = parts.slice(4).join(' | ');
          if (timestamp.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/) && service && bugType && status) {
            incidents.push({
              id: id++,
              service_name: service,
              bug_type: bugType,
              status: status.toLowerCase(),
              description: description,
              timestamp: timestamp,
              resolved_at: status.toLowerCase() === 'applied' ? null : timestamp
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to parse log file:', error);
  }
  return incidents;
}

export async function GET() {
  try {
    const db = new Database(DB_PATH);
    initializeDatabase(db);
    const dbIncidents = db.prepare('SELECT * FROM incidents ORDER BY timestamp DESC').all() as Incident[];
    db.close();

    const logIncidents = parseLogFile();

    const allIncidents = [...dbIncidents, ...logIncidents];
    allIncidents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const seen = new Set<string>();
    const uniqueIncidents = allIncidents.filter(incident => {
      const key = `${incident.timestamp}-${incident.service_name}-${incident.bug_type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json(uniqueIncidents);
  } catch (error) {
    console.error('Failed to fetch incidents:', error);
    // Return mock data for demo mode when DB not available
    const today = new Date().toISOString().split('T')[0];
    return NextResponse.json([
      { id: 1, service_name: 'sms-service', bug_type: 'Database connection timeout', status: 'resolved', description: 'Connection pool exhausted - increased pool size', timestamp: `${today}T08:30:00Z`, resolved_at: `${today}T08:35:00Z` },
      { id: 2, service_name: 'payment-service', bug_type: 'Memory leak in worker process', status: 'resolved', description: 'Fixed memory leak in message queue consumer', timestamp: `${today}T10:15:00Z`, resolved_at: `${today}T10:22:00Z` },
      { id: 3, service_name: 'sms-service', bug_type: 'Rate limiter misconfiguration', status: 'resolved', description: 'Adjusted rate limits for burst traffic', timestamp: `${today}T14:45:00Z`, resolved_at: `${today}T14:50:00Z` }
    ], { headers: { 'x-demo-mode': 'true' } });
  }
}
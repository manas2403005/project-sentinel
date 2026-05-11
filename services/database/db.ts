import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', '..', '..', 'docs', 'sentinel.db');

let db: Database.Database;

export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    initializeTables();
  }
  return db;
}

function initializeTables(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unknown',
      last_checked TEXT,
      incident_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_name TEXT NOT NULL,
      bug_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      description TEXT,
      timestamp TEXT NOT NULL,
      resolved_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_services_name ON services(name);
    CREATE INDEX IF NOT EXISTS idx_incidents_service ON incidents(service_name);
    CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
  `);

  initializeServices();
}

function initializeServices(): void {
  const services = ['sms-service', 'payment-service'];
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO services (id, name, status, last_checked, incident_count)
    VALUES (?, ?, 'unknown', NULL, 0)
  `);

  for (const service of services) {
    insertStmt.run(service, service);
  }
}

export function updateServiceStatus(serviceId: string, status: string): void {
  const stmt = db.prepare(`
    UPDATE services
    SET status = ?, last_checked = ?
    WHERE id = ?
  `);
  stmt.run(status, new Date().toISOString(), serviceId);
}

export function incrementIncidentCount(serviceId: string): void {
  const stmt = db.prepare(`
    UPDATE services
    SET incident_count = incident_count + 1
    WHERE id = ?
  `);
  stmt.run(serviceId);
}

export function getServices(): Array<{ id: string; name: string; status: string; last_checked: string; incident_count: number }> {
  const stmt = db.prepare('SELECT * FROM services');
  return stmt.all() as Array<{ id: string; name: string; status: string; last_checked: string; incident_count: number }>;
}

export function createIncident(serviceName: string, bugType: string, description: string): number {
  const stmt = db.prepare(`
    INSERT INTO incidents (service_name, bug_type, status, description, timestamp)
    VALUES (?, ?, 'active', ?, ?)
  `);
  const result = stmt.run(serviceName, bugType, description, new Date().toISOString());
  return result.lastInsertRowid as number;
}

export function resolveIncident(incidentId: number): void {
  const stmt = db.prepare(`
    UPDATE incidents
    SET status = 'resolved', resolved_at = ?
    WHERE id = ?
  `);
  stmt.run(new Date().toISOString(), incidentId);
}

export function getIncidents(status?: string): Array<{
  id: number;
  service_name: string;
  bug_type: string;
  status: string;
  description: string;
  timestamp: string;
  resolved_at: string;
}> {
  if (status) {
    const stmt = db.prepare('SELECT * FROM incidents WHERE status = ? ORDER BY timestamp DESC');
    return stmt.all(status) as Array<{
      id: number;
      service_name: string;
      bug_type: string;
      status: string;
      description: string;
      timestamp: string;
      resolved_at: string;
    }>;
  }
  const stmt = db.prepare('SELECT * FROM incidents ORDER BY timestamp DESC');
  return stmt.all() as Array<{
    id: number;
    service_name: string;
    bug_type: string;
    status: string;
    description: string;
    timestamp: string;
    resolved_at: string;
  }>;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
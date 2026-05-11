import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';

const app = express();
const PORT = 3001;
const SERVICE_ID = 'sms-service';

const DB_PATH = path.join(__dirname, '..', '..', 'docs', 'sentinel.db');

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

let db: Database.Database;

function initializeDatabase(): void {
  db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unknown',
      last_checked TEXT,
      incident_count INTEGER DEFAULT 0
    )
  `);
  db.exec(`
    INSERT OR IGNORE INTO services (id, name, status, incident_count)
    VALUES ('${SERVICE_ID}', '${SERVICE_ID}', 'healthy', 0)
  `);
}

function updateHealthStatus(status: string): void {
  const stmt = db.prepare(`
    UPDATE services
    SET status = ?, last_checked = ?
    WHERE id = ?
  `);
  stmt.run(status, new Date().toISOString(), SERVICE_ID);
}

function reportHealth(): void {
  updateHealthStatus('healthy');
}

app.get('/health', (req, res) => {
  reportHealth();
  res.json({ status: 'healthy' });
});

initializeDatabase();

setInterval(reportHealth, 5000);

app.listen(PORT, () => {
  console.log(`SMS service running on port ${PORT}`);
});
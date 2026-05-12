import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = 3001;
const SERVICE_ID = 'sms-service';

const DB_PATH = path.join(__dirname, '..', '..', '..', 'docs', 'sentinel.db');
const LOG_DIR = path.join(__dirname, 'logs');
const ERROR_LOG_PATH = path.join(LOG_DIR, 'error.log');

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function logError(message: string, error?: unknown): void {
  ensureLogDir();
  const timestamp = new Date().toISOString();
  const errorDetail = error instanceof Error ? `${error.message}\n${error.stack}` : String(error || 'Unknown error');
  const logEntry = `[${timestamp}] ERROR: ${message}${error ? `\n${errorDetail}` : ''}\n`;
  fs.appendFileSync(ERROR_LOG_PATH, logEntry);
}

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
  try {
    reportHealth();
    res.json({ status: 'healthy' });
  } catch (error) {
    logError('Health check failed', error);
    updateHealthStatus('unhealthy');
    res.status(503).json({ status: 'unhealthy', error: 'Health check failed' });
  }
});

initializeDatabase();

setInterval(reportHealth, 5000);

app.listen(PORT, () => {
  console.log(`SMS service running on port ${PORT}`);
});
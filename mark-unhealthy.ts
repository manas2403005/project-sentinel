import Database from 'better-sqlite3';

const db = new Database('docs/sentinel.db');
db.prepare("UPDATE services SET status = 'unreachable' WHERE id = 'sms-service'").run();
console.log('SMS service marked as unhealthy - sentinel agent will detect it');
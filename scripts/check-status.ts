import Database from 'better-sqlite3';

const db = new Database('docs/sentinel.db');
console.log('=== SERVICES ===');
console.log(JSON.stringify(db.prepare('SELECT * FROM services').all(), null, 2));
console.log('\n=== ACTIVE INCIDENTS ===');
console.log(JSON.stringify(db.prepare("SELECT * FROM incidents WHERE status='active'").all(), null, 2));
db.close();
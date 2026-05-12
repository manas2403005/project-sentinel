import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync, exec } from 'child_process';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVICES = ['sms-service', 'payment-service'];
const BUG_TYPES = ['syntax-error', 'wrong-port', 'missing-dependency', 'logic-error', 'corrupt-config', 'crash-loop'];

const INCIDENT_LOG = path.join(process.cwd(), 'docs', 'incident-history.log');
const DB_PATH = path.join(process.cwd(), 'docs', 'sentinel.db');

const SERVICE_PORTS: Record<string, number> = {
  'sms-service': 3001,
  'payment-service': 3002
};

interface Bug {
  name: string;
  description: string;
  apply: (servicePath: string) => void;
}

const bugs: Record<string, Bug> = {
  'syntax-error': {
    name: 'Syntax Error',
    description: 'Added invalid character to index.ts',
    apply: (servicePath: string) => {
      const indexPath = path.join(servicePath, 'index.ts');
      let content = fs.readFileSync(indexPath, 'utf-8');
      // Add random invalid character after a random line
      const lines = content.split('\n');
      const randomLine = Math.floor(Math.random() * lines.length);
      lines[randomLine] += ' @@INVALID@@';
      fs.writeFileSync(indexPath, lines.join('\n'));
    }
  },
  'wrong-port': {
    name: 'Wrong Port',
    description: 'Changed port to random wrong value',
    apply: (servicePath: string) => {
      const indexPath = path.join(servicePath, 'index.ts');
      let content = fs.readFileSync(indexPath, 'utf-8');
      // Change port to a random wrong port (not 3001 or 3002)
      const wrongPorts = [3003, 3004, 3005, 8080, 8888, 4000, 5000];
      const wrongPort = wrongPorts[Math.floor(Math.random() * wrongPorts.length)];
      content = content.replace(/const PORT = \d+/, `const PORT = ${wrongPort}`);
      fs.writeFileSync(indexPath, content);
    }
  },
  'missing-dependency': {
    name: 'Missing Dependency',
    description: 'Removed random line from package.json',
    apply: (servicePath: string) => {
      const pkgPath = path.join(servicePath, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = Object.keys(pkg.dependencies);
      if (deps.length > 0) {
        const randomDep = deps[Math.floor(Math.random() * deps.length)];
        delete pkg.dependencies[randomDep];
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
        // Run npm install to actually remove the package from node_modules
        console.log(`   Running npm install to remove ${randomDep}...`);
        execSync('npm install', { cwd: servicePath, stdio: 'pipe' });
      }
    }
  },
  'logic-error': {
    name: 'Logic Error',
    description: 'Changed /health to return "broken"',
    apply: (servicePath: string) => {
      const indexPath = path.join(servicePath, 'index.ts');
      let content = fs.readFileSync(indexPath, 'utf-8');
      content = content.replace(/status: 'healthy'/, "status: 'broken'");
      fs.writeFileSync(indexPath, content);
    }
  },
  'corrupt-config': {
    name: 'Corrupt Config',
    description: 'Broke tsconfig.json',
    apply: (servicePath: string) => {
      const tsconfigPath = path.join(servicePath, 'tsconfig.json');
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
      // Remove required fields to break the config
      delete tsconfig.compilerOptions.module;
      delete tsconfig.compilerOptions.outDir;
      fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
    }
  },
  'crash-loop': {
    name: 'Crash Loop',
    description: 'Service throws unhandled error on startup',
    apply: (servicePath: string) => {
      const indexPath = path.join(servicePath, 'index.ts');
      let content = fs.readFileSync(indexPath, 'utf-8');
      // Add unhandled error throw at the top of the file
      const crashCode = `\n// Chaos Monkey: Crash loop bug - throws unhandled error\nthrow new Error('CHAOS MONKEY: Service crashed on startup!');\n`;
      // Insert after the imports
      const importEnd = content.indexOf('\n', content.lastIndexOf('import'));
      content = content.slice(0, importEnd + 1) + crashCode + content.slice(importEnd + 1);
      fs.writeFileSync(indexPath, content);
    }
  }
};

function logIncident(service: string, bugType: string, description: string): void {
  const timestamp = new Date().toISOString();
  const entry = `${timestamp} | ${service} | ${bugType} | APPLIED | ${description}\n`;

  fs.appendFileSync(INCIDENT_LOG, entry);
  console.log(`\n📝 Logged to ${INCIDENT_LOG}`);
}

function killServiceProcess(serviceId: string): void {
  const port = SERVICE_PORTS[serviceId];
  console.log(`   Killing process on port ${port}...`);

  try {
    // Use netstat to find the PID on the port
    const output = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf-8' });
    const lines = output.trim().split('\n');

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0' && !isNaN(parseInt(pid))) {
        try {
          execSync(`taskkill //F //PID ${pid}`, { stdio: 'ignore' });
          console.log(`   Killed process ${pid}`);
        } catch (e) {
          // Process may already be dead
        }
      }
    }
  } catch (e) {
    // No process found on port - that's fine
  }
}

function markServiceCritical(serviceId: string, bugType: string, description: string): void {
  console.log(`   Marking ${serviceId} as CRITICAL in database...`);
  const db = new Database(DB_PATH);

  // Update service status to critical
  db.prepare('UPDATE services SET status = ?, last_checked = ? WHERE id = ?')
    .run('critical', new Date().toISOString(), serviceId);

  // Insert a new incident record
  db.prepare(`
    INSERT INTO incidents (service_name, bug_type, status, description, timestamp)
    VALUES (?, ?, 'active', ?, ?)
  `).run(serviceId, bugType, description, new Date().toISOString());

  db.close();
  console.log(`   Inserted incident record for ${serviceId}`);
}

function main(): void {
  const service = SERVICES[Math.floor(Math.random() * SERVICES.length)];
  const bugType = BUG_TYPES[Math.floor(Math.random() * BUG_TYPES.length)];

  const servicePath = path.join(__dirname, '..', 'services', service);
  const bug = bugs[bugType];

  console.log(`\n🎲 Selected service: ${service}`);
  console.log(`🎲 Selected bug: ${bugType}`);

  // Apply the bug to the service files
  bug.apply(servicePath);

  // Rebuild TypeScript so broken code is compiled to dist/
  console.log(`   Rebuilding TypeScript...`);
  execSync('npx tsc', { cwd: servicePath, stdio: 'pipe' });

  // Kill the service process so it restarts with broken code
  killServiceProcess(service);

  // Mark service as critical in database
  markServiceCritical(service, bugType, bug.description);

  logIncident(service, bugType, bug.description);

  console.log(`\n💥 CHAOS UNLEASHED: ${bug.name} in ${service}\n`);
  console.log(`The service has been sabotaged! Dashboard shows CRITICAL.`);
}

main();
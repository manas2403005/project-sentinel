import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVICES = ['sms-service', 'payment-service'];
const BUG_TYPES = ['syntax-error', 'wrong-port', 'missing-dependency', 'logic-error', 'corrupt-config'];

const INCIDENT_LOG = path.join(__dirname, '..', 'docs', 'incident-history.log');

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
  }
};

function logIncident(service: string, bugType: string, description: string): void {
  const timestamp = new Date().toISOString();
  const entry = `${timestamp} | ${service} | ${bugType} | APPLIED | ${description}\n`;

  fs.appendFileSync(INCIDENT_LOG, entry);
  console.log(`\n📝 Logged to ${INCIDENT_LOG}`);
}

function main(): void {
  const service = SERVICES[Math.floor(Math.random() * SERVICES.length)];
  const bugType = BUG_TYPES[Math.floor(Math.random() * BUG_TYPES.length)];

  const servicePath = path.join(__dirname, '..', 'services', service);
  const bug = bugs[bugType];

  console.log(`\n🎲 Selected service: ${service}`);
  console.log(`🎲 Selected bug: ${bugType}`);

  bug.apply(servicePath);

  logIncident(service, bugType, bug.description);

  console.log(`\n💥 CHAOS UNLEASHED: ${bug.name} in ${service}\n`);
  console.log(`The service has been sabotaged! Check /health endpoint to confirm.`);
}

main();
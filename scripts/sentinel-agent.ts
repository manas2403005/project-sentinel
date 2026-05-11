import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(process.cwd(), 'docs', 'sentinel.db');
const INCIDENT_LOG = path.join(process.cwd(), 'docs', 'incident-history.log');

const SERVICE_PORTS: Record<string, number> = {
  'sms-service': 3001,
  'payment-service': 3002
};

const SERVICE_PATHS: Record<string, string> = {
  'sms-service': path.join(__dirname, '..', 'services', 'sms-service'),
  'payment-service': path.join(__dirname, '..', 'services', 'payment-service')
};

interface AgentState {
  status: 'active' | 'healing' | 'idle';
  lastCheck: string;
  lastHeal: string | null;
  currentFix: string | null;
}

let agentState: AgentState = {
  status: 'active',
  lastCheck: new Date().toISOString(),
  lastHeal: null,
  currentFix: null,
};

let db: Database.Database;

async function restartService(serviceId: string): Promise<boolean> {
  const port = SERVICE_PORTS[serviceId];
  const servicePath = SERVICE_PATHS[serviceId];

  try {
    // Kill the process on the specific port using netstat and taskkill
    console.log(`🔄 Restarting ${serviceId} on port ${port}...`);

    // Find and kill process on the port
    const { stdout } = await execAsync(`netstat -ano | grep ":${port}" | findstr LISTENING`);
    const lines = stdout.trim().split('\n');
    if (lines.length > 0 && lines[0]) {
      const pid = lines[0].split(/\s+/)[4];
      if (pid && pid !== '0') {
        try {
          await execAsync(`taskkill //F //PID ${pid}`);
          console.log(`🔄 Killed old process ${pid}`);
        } catch (e) {
          // Process may already be dead
        }
      }
    }

    // Wait a moment for port to be released
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Start the service again
    execSync('node dist/index.js', { cwd: servicePath, detached: true, stdio: 'ignore' });
    console.log(`🔄 Started ${serviceId}`);

    // Wait for service to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    return true;
  } catch (error) {
    console.error(`🔄 Failed to restart ${serviceId}:`, error);
    return false;
  }
}

function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
  }
  return db;
}

function logIncident(message: string): void {
  const timestamp = new Date().toISOString();
  const entry = `${timestamp} | AUTO-HEALER | auto-healing | APPLIED | ${message}\n`;
  fs.appendFileSync(INCIDENT_LOG, entry);
}

function getUnhealthyServicesFromDB(): Array<{ id: string; name: string; status: string }> {
  const database = getDatabase();
  return database.prepare(
    "SELECT id, name, status FROM services WHERE status IN ('critical', 'unreachable', 'broken')"
  ).all() as Array<{ id: string; name: string; status: string }>;
}

function updateServiceStatus(serviceId: string, status: string): void {
  const database = getDatabase();
  database.prepare(
    "UPDATE services SET status = ?, last_checked = ? WHERE id = ?"
  ).run(status, new Date().toISOString(), serviceId);
}

function recordIncident(serviceName: string, bugType: string, description: string): void {
  const database = getDatabase();
  database.prepare(
    "INSERT INTO incidents (service_name, bug_type, status, description, timestamp) VALUES (?, ?, 'active', ?, ?)"
  ).run(serviceName, bugType, description, new Date().toISOString());
}

function resolveIncident(serviceName: string): void {
  const database = getDatabase();
  database.prepare(
    "UPDATE incidents SET status = 'resolved', resolved_at = ? WHERE service_name = ? AND status = 'active'"
  ).run(new Date().toISOString(), serviceName);
}

async function checkHealthEndpoint(serviceId: string): Promise<{ healthy: boolean; status?: string; error?: string }> {
  const port = SERVICE_PORTS[serviceId];
  if (!port) {
    return { healthy: false, error: 'Unknown service port' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`http://localhost:${port}/health`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { healthy: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json() as { status: string };
    return { healthy: data.status === 'healthy', status: data.status };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Connection refused';
    return { healthy: false, error: errorMessage };
  }
}

async function fixService(serviceId: string): Promise<boolean> {
  console.log(`🔧 SENTINEL AGENT: Starting auto-heal for ${serviceId}`);

  agentState.status = 'healing';
  agentState.currentFix = serviceId;

  updateServiceStatus(serviceId, 'healing');
  logIncident(`AUTO-HEALING TRIGGERED for ${serviceId}`);

  try {
    const servicePath = path.join(__dirname, '..', 'services', serviceId);
    const indexPath = path.join(servicePath, 'index.ts');

    let content = fs.readFileSync(indexPath, 'utf-8');
    let fixed = false;
    const issues: string[] = [];

    // Check for invalid characters (syntax errors)
    if (content.includes('@@INVALID@@') || content.includes('@@')) {
      content = content.replace(/@@[A-Z]+@@/g, '');
      issues.push('Removed invalid syntax markers');
      fixed = true;
    }

    // Check for broken health status
    if (content.includes("status: 'broken'") || content.includes('status: "broken"')) {
      content = content.replace(/status: ['"]broken['"]/g, "status: 'healthy'");
      issues.push('Fixed health status to healthy');
      fixed = true;
    }

    // Check for wrong port
    const portMatch = content.match(/const PORT = (\d+)/);
    if (portMatch) {
      const port = parseInt(portMatch[1]);
      const expectedPort = SERVICE_PORTS[serviceId];
      if (port !== expectedPort) {
        content = content.replace(/const PORT = \d+/, `const PORT = ${expectedPort}`);
        issues.push(`Changed port from ${port} to ${expectedPort}`);
        fixed = true;
      }
    }

    // Check for crash-loop bug (unhandled error throw)
    if (content.includes('CHAOS MONKEY:') || content.includes('throw new Error(')) {
      // Remove the crash loop code
      content = content.replace(/\n*\/\/ Chaos Monkey:.*$/gm, '');
      content = content.replace(/throw new Error\('CHAOS MONKEY:.*'\);?/g, '');
      issues.push('Removed crash-loop error throw');
      fixed = true;
    }

    // Check package.json for missing dependencies
    const pkgPath = path.join(servicePath, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (!pkg.dependencies || !pkg.dependencies.express) {
        pkg.dependencies = pkg.dependencies || {};
        pkg.dependencies.express = '^4.18.2';
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
        issues.push('Re-added missing express dependency');
        fixed = true;
      }
    }

    // Check tsconfig.json
    const tsconfigPath = path.join(servicePath, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
      if (!tsconfig.compilerOptions || !tsconfig.compilerOptions.module) {
        tsconfig.compilerOptions = tsconfig.compilerOptions || {};
        tsconfig.compilerOptions.module = 'commonjs';
        tsconfig.compilerOptions.outDir = './dist';
        fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
        issues.push('Fixed corrupted tsconfig.json');
        fixed = true;
      }
    }

    if (fixed) {
      fs.writeFileSync(indexPath, content);
      console.log(`🔧 ${serviceId}: Fixed issues - ${issues.join(', ')}`);

      // Rebuild TypeScript
      console.log(`🔧 ${serviceId}: Rebuilding with tsc...`);
      execSync('npx tsc', { cwd: servicePath, stdio: 'pipe' });
      console.log(`🔧 ${serviceId}: TypeScript compiled successfully`);

      // Restart the service to pick up the fixed code
      console.log(`🔧 ${serviceId}: Restarting service...`);
      await restartService(serviceId);
    }

    // VERIFICATION: Only mark healthy AFTER confirming /health returns healthy
    console.log(`🔧 ${serviceId}: Verifying /health endpoint returns healthy...`);
    const healthCheck = await checkHealthEndpoint(serviceId);

    if (healthCheck.healthy) {
      updateServiceStatus(serviceId, 'healthy');
      resolveIncident(serviceId);

      agentState.lastHeal = new Date().toISOString();
      agentState.status = 'active';
      agentState.currentFix = null;

      logIncident(`Auto-heal SUCCESS for ${serviceId}: ${issues.join(', ')}`);
      console.log(`✅ SENTINEL AGENT: ${serviceId} verified healthy - marked as HEALTHY in DB`);
      return true;
    } else {
      // Health check still failing - keep as critical
      updateServiceStatus(serviceId, 'critical');
      agentState.status = 'active';
      agentState.currentFix = null;

      logIncident(`Auto-heal VERIFICATION FAILED for ${serviceId}: health returned ${healthCheck.status || healthCheck.error}`);
      console.log(`❌ SENTINEL AGENT: ${serviceId} health check still failing - kept as CRITICAL`);
      return false;
    }

  } catch (error) {
    console.error(`❌ SENTINEL AGENT: Failed to heal ${serviceId}`, error);

    updateServiceStatus(serviceId, 'critical');
    agentState.status = 'active';
    agentState.currentFix = null;

    logIncident(`Auto-heal FAILED for ${serviceId}: ${error}`);
    return false;
  }
}

async function runHealthCheck(): Promise<void> {
  agentState.lastCheck = new Date().toISOString();

  // Poll /health endpoints for ALL services and update DB if unhealthy
  console.log(`\n🔍 SENTINEL AGENT: Checking all service health endpoints...`);

  for (const [serviceId, port] of Object.entries(SERVICE_PORTS)) {
    const healthCheck = await checkHealthEndpoint(serviceId);
    const dbService = getDatabase().prepare('SELECT status FROM services WHERE id = ?').get(serviceId) as { status: string } | undefined;

    if (!healthCheck.healthy) {
      console.log(`⚠️ ${serviceId}: /health returns ${healthCheck.status || healthCheck.error} - marking as CRITICAL`);
      updateServiceStatus(serviceId, 'critical');
    } else if (dbService && dbService.status === 'healthy') {
      // Only update to healthy if DB already shows healthy (don't override critical)
      updateServiceStatus(serviceId, 'healthy');
    }
    // If DB shows critical/healing, don't override - process it below
  }

  // Also check DB for services marked as critical/unreachable (from chaos monkey)
  const unhealthyFromDB = getUnhealthyServicesFromDB();

  console.log(`\n🔍 SENTINEL AGENT: Checking DB for unhealthy services...`);

  if (unhealthyFromDB.length > 0) {
    console.log(`⚠️ SENTINEL AGENT: Found ${unhealthyFromDB.length} unhealthy service(s) in DB`);

    for (const service of unhealthyFromDB) {
      await fixService(service.id);
    }
  } else {
    console.log(`✅ SENTINEL AGENT: All services healthy at ${agentState.lastCheck}`);
  }
}

function getAgentState(): AgentState {
  return { ...agentState };
}

function startAgent(): void {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           🤖 SENTINEL AUTONOMOUS AGENT STARTED            ║
║                                                            ║
║  - Polling /health endpoints every 10 seconds             ║
║  - Checking database for critical services                  ║
║  - Verifying fixes before marking healthy                   ║
║  - Logging all actions to incident-history.log             ║
╚══════════════════════════════════════════════════════════════╝
  `);

  // Initial health check
  runHealthCheck();

  // Poll every 10 seconds
  setInterval(runHealthCheck, 10000);
}

// Export for API access
export { getAgentState, startAgent, agentState };

// Run if executed directly
startAgent();
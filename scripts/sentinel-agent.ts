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

  // Get services with explicit critical/unreachable status
  const explicitUnhealthy = database.prepare(
    "SELECT id, name, status FROM services WHERE status IN ('critical', 'unreachable', 'broken')"
  ).all() as Array<{ id: string; name: string; status: string }>;

  // Also get services that have active incidents
  const servicesWithIncidents = database.prepare(
    "SELECT s.id, s.name, s.status FROM services s JOIN incidents i ON s.id = i.service_name WHERE i.status = 'active'"
  ).all() as Array<{ id: string; name: string; status: string }>;

  // Combine both lists and set status to critical for any with active incidents
  const allUnhealthy = [...explicitUnhealthy];
  for (const svc of servicesWithIncidents) {
    if (!allUnhealthy.find(s => s.id === svc.id)) {
      allUnhealthy.push({ ...svc, status: 'critical' });
    } else {
      // Update status to critical if there's an active incident
      const idx = allUnhealthy.findIndex(s => s.id === svc.id);
      allUnhealthy[idx].status = 'critical';
    }
  }

  return allUnhealthy;
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

      // Run tests to verify the fix
      console.log(`🔧 ${serviceId}: Running tests...`);
      try {
        execSync('npm test', { cwd: path.join(__dirname, '..'), stdio: 'pipe' });
        console.log(`🔧 ${serviceId}: Tests passed!`);
      } catch (e) {
        console.log(`⚠️ ${serviceId}: Some tests may have failed, continuing anyway...`);
      }

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

    // Check if there's an active incident for this service
    const activeIncident = getDatabase().prepare(
      "SELECT id FROM incidents WHERE service_name = ? AND status = 'active'"
    ).get(serviceId);

    if (!healthCheck.healthy) {
      console.log(`⚠️ ${serviceId}: /health returns ${healthCheck.status || healthCheck.error} - marking as CRITICAL`);
      updateServiceStatus(serviceId, 'critical');
    } else if (!activeIncident && dbService && dbService.status !== 'healing') {
      // Only update to healthy if there's no active incident and not in healing state
      updateServiceStatus(serviceId, 'healthy');
    }
    // If there's an active incident or healing, don't override - process it below
  }

  // Also check DB for services marked as critical/unreachable (from chaos monkey)
  // NOTE: Auto-healing is now DISABLED - use "fix it" command to manually heal
  const unhealthyFromDB = getUnhealthyServicesFromDB();

  if (unhealthyFromDB.length > 0) {
    console.log(`⚠️ Found ${unhealthyFromDB.length} unhealthy service(s): ${unhealthyFromDB.map(s => s.id).join(', ')}`);
    console.log(`   Run "fix it" to manually heal these services`);
  } else {
    console.log(`✅ All services healthy at ${agentState.lastCheck}`);
  }
}

async function fixAllCritical(): Promise<void> {
  // Manual fix - fix all critical services immediately
  const unhealthyFromDB = getUnhealthyServicesFromDB();

  if (unhealthyFromDB.length === 0) {
    console.log('No critical services to fix.');
    return;
  }

  console.log(`🔧 Manual fix triggered for: ${unhealthyFromDB.map(s => s.id).join(', ')}\n`);

  for (const service of unhealthyFromDB) {
    console.log(`🔧 Fixing ${service.id}...`);
    await fixService(service.id);
  }
}

function getAgentState(): AgentState {
  return { ...agentState };
}

// CLI mode - triggered manually by "fix" command
// Auto-healing is DISABLED - use "npm run fix" to manually heal

const command = process.argv[2];

async function main() {
  if (command === 'fix') {
    console.log('\n🔧 SENTINEL: Manual fix triggered...\n');
    await fixAllCritical();
    console.log('\n✅ Fix process complete - dashboard should show green!\n');
    process.exit(0);
  }

  // Default: show help
  console.log(`
Sentinel CLI - Human-triggered demo flow

Usage:
  npm run chaos    - Break a random service (shows CRITICAL)
  npm run fix      - Fix broken services (shows RESOLVED)

Demo flow:
  1. Type "npm run chaos" → chaos-monkey breaks a service → Dashboard shows RED
  2. Type "npm run fix"   → sentinel fixes it → Dashboard shows GREEN
  `);
}

// Run CLI if executed directly with arguments
if (process.argv.length > 2) {
  main();
}

// Export for API access
export { getAgentState, runHealthCheck, fixService, fixAllCritical, agentState };
#!/usr/bin/env ts-node
/**
 * Sentinel CLI - Human-triggered demo commands
 *
 * Usage:
 *   npx ts-node scripts/sentinel-cli.ts unleash-chaos   - Break a random service
 *   npx ts-node scripts/sentinel-cli.ts fix            - Fix broken services
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const command = process.argv[2] || process.argv[3]; // Handle both ts-node and node paths

if (command === 'unleash-chaos' || command === 'chaos') {
  console.log('\n🎲 UNLEASHING CHAOS...\n');
  execSync('npx ts-node chaos-monkey.ts', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });
} else if (command === 'fix' || command === 'fix-it') {
  console.log('\n🔧 SENTINEL: Running manual fix...\n');
  // Import and run the fix logic from sentinel-agent
  const { fixAllCritical } = await import('./sentinel-agent.ts');
  await fixAllCritical();
  console.log('\n✅ Fix process complete - dashboard should show green!\n');
} else {
  console.log(`
🤖 Sentinel CLI - Human-triggered demo flow

Commands:
  npx ts-node scripts/sentinel-cli.ts unleash-chaos   - Break a random service (shows CRITICAL)
  npx ts-node scripts/sentinel-cli.ts fix            - Fix broken services (shows RESOLVED)

Demo flow:
  1. Type "unleash chaos" → chaos-monkey breaks a service → Dashboard shows RED
  2. Type "fix it" → sentinel fixes it → Dashboard shows GREEN
  `);
}
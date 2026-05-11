import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const SERVICE_DIR = path.resolve(PROJECT_ROOT, 'services', 'sms-service');

describe('sms-service', () => {
  describe('Health endpoint', () => {
    test('/health returns { status: "healthy" } - never "broken"', async () => {
      const response = await fetch('http://localhost:3001/health');
      const data = await response.json() as { status: string };

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.status).not.toBe('broken');
    });
  });

  describe('Service configuration', () => {
    test('package.json contains express as a dependency', () => {
      const packageJsonPath = path.join(SERVICE_DIR, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.dependencies).toBeDefined();
      expect(packageJson.dependencies.express).toBeDefined();
    });

    test('package.json express is a valid version string', () => {
      const packageJsonPath = path.join(SERVICE_DIR, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      expect(packageJson.dependencies.express).toMatch(/^\^?\d+\.\d+\.\d+/);
    });
  });

  describe('TypeScript compilation', () => {
    test('index.ts compiles without TypeScript errors', async () => {
      const result = await execAsync('npx tsc --noEmit', { cwd: SERVICE_DIR });
      const output = String(result.stdout) + String(result.stderr);
      expect(output).not.toContain('error TS');
    }, 30000);
  });
});
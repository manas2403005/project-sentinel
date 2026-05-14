import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), '..', 'docs', 'sentinel.db');

interface Service {
  id: string;
  status: string;
}

interface AgentState {
  status: 'active' | 'healing' | 'idle';
  lastCheck: string;
  lastHeal: string | null;
  currentFix: string | null;
}

function getAgentState(): AgentState {
  return {
    status: 'active',
    lastCheck: new Date().toISOString(),
    lastHeal: null,
    currentFix: null,
  };
}

export async function GET() {
  try {
    const db = new Database(DB_PATH);
    const services = db.prepare('SELECT id, status FROM services').all();
    db.close();

    const agentState = getAgentState();

    // Check if any service needs healing
    const servicesTyped = services as Service[];
    const needsHealing = servicesTyped.some(
      (s) => s.status === 'critical' || s.status === 'unreachable' || s.status === 'broken' || s.status === 'healing'
    );

    if (needsHealing) {
      const healingService = servicesTyped.find(
        (s) => s.status === 'healing'
      );
      if (healingService) {
        agentState.status = 'healing';
        agentState.currentFix = healingService.id;
      }
    }

    return NextResponse.json({
      ...agentState,
      servicesCount: servicesTyped.length,
      healthyCount: servicesTyped.filter((s) => s.status === 'healthy').length,
    });
  } catch (error) {
    console.error('Failed to fetch agent state:', error);
    // Return mock data for demo mode when DB not available
    return NextResponse.json({
      status: 'active',
      lastCheck: new Date().toISOString(),
      lastHeal: null,
      currentFix: null,
      servicesCount: 2,
      healthyCount: 2
    }, { headers: { 'x-demo-mode': 'true' } });
  }
}
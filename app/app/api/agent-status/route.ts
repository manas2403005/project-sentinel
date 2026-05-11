import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), '..', 'docs', 'sentinel.db');

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
    const needsHealing = services.some((s: any) =>
      s.status === 'critical' || s.status === 'unreachable' || s.status === 'broken' || s.status === 'healing'
    );

    if (needsHealing) {
      const healingService = services.find((s: any) =>
        s.status === 'healing'
      );
      if (healingService) {
        agentState.status = 'healing';
        agentState.currentFix = healingService.id;
      }
    }

    return NextResponse.json({
      ...agentState,
      servicesCount: (services as any[]).length,
      healthyCount: (services as any[]).filter((s: any) => s.status === 'healthy').length,
    });
  } catch (error) {
    return NextResponse.json({
      status: 'idle',
      lastCheck: new Date().toISOString(),
      lastHeal: null,
      currentFix: null,
      error: 'Failed to fetch agent state'
    }, { status: 500 });
  }
}
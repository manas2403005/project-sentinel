'use client';

import { useEffect, useState } from 'react';
import '../app.css';

interface ServiceStatus {
  id: string;
  name: string;
  status: 'healthy' | 'broken' | 'unknown' | 'healing' | 'critical';
  last_checked: string;
  incident_count: number;
}

interface Incident {
  id: number;
  service_name: string;
  bug_type: string;
  status: string;
  description: string;
  timestamp: string;
  resolved_at: string | null;
}

interface AgentState {
  status: 'active' | 'healing' | 'idle';
  lastCheck: string;
  lastHeal: string | null;
  currentFix: string | null;
}

function getStatusColor(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === 'applied' || normalized === 'active') return '#f85149';
  if (normalized === 'fixed' || normalized === 'auto-healed' || normalized === 'resolved') return '#3fb950';
  return '#8b949e';
}

function getStatusLabel(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === 'auto-healed') return 'AUTO-HEALED';
  if (normalized === 'applied') return 'APPLIED';
  return status.toUpperCase();
}

function isRecentResolved(status: string, timestamp: string): boolean {
  const normalized = status.toLowerCase();
  if (normalized !== 'fixed' && normalized !== 'auto-healed' && normalized !== 'resolved') return false;
  const incidentTime = new Date(timestamp).getTime();
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;
  return (now - incidentTime) <= twentyFourHours;
}

function AllIncidentsPanel({ incidentsData }: { incidentsData: Incident[] }) {
  const incidents = incidentsData || [];

  return (
    <div className="panel">
      <div className="panel-header">All Incidents ({incidents.length})</div>
      {incidents.length === 0 ? (
        <div className="no-data">No incidents in database</div>
      ) : (
        incidents.slice(0, 50).map((entry, idx) => (
          <div key={`${entry.id}-${idx}`} className="log-entry">
            <span className="log-timestamp">{new Date(entry.timestamp).toLocaleString()}</span>
            {' | '}{entry.service_name}
            {' | '}{entry.bug_type}
            {' | '}
            <span style={{ color: getStatusColor(entry.status), fontWeight: 'bold' }}>
              {getStatusLabel(entry.status)}
            </span>
            {entry.description && (' | ' + entry.description)}
          </div>
        ))
      )}
    </div>
  );
}

function RecentResolvedPanel({ incidents }: { incidents: Incident[] }) {
  const resolved = incidents.filter(i =>
    i.status === 'fixed' || i.status === 'auto-healed' || i.status === 'resolved'
  );

  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const recentResolved = resolved.filter(i => new Date(i.timestamp).getTime() >= sevenDaysAgo);

  const displayIncidents = recentResolved.length >= 3
    ? recentResolved.slice(0, 10)
    : resolved.slice(0, Math.max(3, recentResolved.length));

  return (
    <div className="panel">
      <div className="panel-header">Resolved by Claude (7d)</div>
      {displayIncidents.length === 0 ? (
        <div className="no-data">No resolved incidents</div>
      ) : (
        displayIncidents.map((incident) => (
          <div key={incident.id} className="resolved-item">
            <div>
              <span className="log-timestamp">[{new Date(incident.timestamp).toLocaleString()}]</span>
              {' '}<span style={{ color: '#3fb950' }}>{incident.service_name}</span>
            </div>
            <div style={{ fontSize: '12px', color: '#3fb950', marginTop: '4px' }}>
              {getStatusLabel(incident.status)}: {incident.description || incident.bug_type}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ActiveIncidentsPanel({ incidents }: { incidents: Incident[] }) {
  const activeIncidents = incidents.filter(i => i.status === 'active');

  return (
    <div className="panel">
      <div className="panel-header">Active Incidents</div>
      {activeIncidents.length === 0 ? (
        <div className="no-data">No active incidents</div>
      ) : (
        activeIncidents.map((incident) => (
          <div key={incident.id} className="incident-item">
            <span className="status-dot broken"></span>
            <strong>{incident.service_name}</strong>
            <div style={{ color: '#f85149', marginTop: '4px', fontSize: '12px' }}>
              {incident.bug_type}: {incident.description}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function Dashboard() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [agentState, setAgentState] = useState<AgentState>({ status: 'idle', lastCheck: '', lastHeal: null, currentFix: null });
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHealing = agentState.status === 'healing';

  useEffect(() => {
    async function loadData() {
      try {
        setError(null);
        const [servicesRes, incidentsRes, agentRes] = await Promise.all([
          fetch('/api/services'),
          fetch('/api/incidents'),
          fetch('/api/agent-status')
        ]);

        if (!servicesRes.ok || !incidentsRes.ok || !agentRes.ok) {
          throw new Error('API request failed');
        }

        const [servicesData, incidentsData, agentData] = await Promise.all([
          servicesRes.json(),
          incidentsRes.json(),
          agentRes.json()
        ]);

        setServices(Array.isArray(servicesData) ? servicesData : []);
        const incidentArray = Array.isArray(incidentsData) ? incidentsData : [];
        setIncidents(incidentArray);
        setAgentState(agentData || agentState);
        setLastUpdated(new Date());
        setMounted(true);
      } catch (error) {
        console.error('Failed to load data:', error);
        setError('Failed to connect to services. Is the database running?');
        setMounted(true);
      }
    }

    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <div className="header">
        <h1 className="title">🤖 Project Sentinel Dashboard</h1>
        {mounted && <span className="last-updated">Last updated: {lastUpdated.toLocaleTimeString()}</span>}
      </div>

      {error && (
        <div className="panel" style={{ backgroundColor: '#f8514933', border: '1px solid #f85149', marginBottom: '20px' }}>
          <div style={{ color: '#f85149', padding: '10px' }}>
            ⚠️ {error}
          </div>
        </div>
      )}

      <div className="agent-status-bar">
        <div className="agent-status">
          <span className={`pulse-dot ${isHealing ? 'orange' : 'green'}`}></span>
          <span className="agent-label">
            Sentinel Agent: {isHealing ? 'HEALING...' : agentState.status === 'idle' ? 'IDLE' : 'ACTIVE'}
          </span>
          {isHealing && agentState.currentFix && (
            <span className="healing-service">Fixing: {agentState.currentFix}</span>
          )}
        </div>
        {agentState.lastHeal && (
          <span className="last-heal">Last heal: {new Date(agentState.lastHeal).toLocaleString()}</span>
        )}
      </div>

      <div className="dashboard-grid">
        <ActiveIncidentsPanel incidents={incidents} />
        <RecentResolvedPanel incidents={incidents} />
        <div className="panel">
          <div className="panel-header">System Health</div>
          {services.map((service) => (
            <div key={service.id} className="service-item">
              <span className={`status-dot ${service.status === 'healthy' ? 'healthy' : service.status === 'healing' ? 'healing' : 'broken'}`}></span>
              <span style={{ fontWeight: 500 }}>{service.name}</span>
              <span className={`status-${service.status}`} style={{ float: 'right' }}>
                {service.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </div>

      <AllIncidentsPanel incidentsData={incidents} />
    </div>
  );
}
'use client';

import { useEffect, useState } from 'react';
import '../app.css';

interface ServiceHealth {
  name: string;
  url: string;
  status: 'healthy' | 'broken' | 'unknown';
  lastCheck: Date;
}

interface IncidentLog {
  timestamp: string;
  service: string;
  type: string;
  result: string;
  notes: string;
}

const SERVICES = [
  { name: 'sms-service', url: 'http://localhost:3001/health' },
  { name: 'payment-service', url: 'http://localhost:3002/health' },
];

const INCIDENT_LOG_PATH = '/docs/incident-history.log';

async function fetchHealth(url: string): Promise<{ status: string } | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return await response.json();
  } catch {
    return null;
  }
}

function parseIncidentLog(logContent: string): IncidentLog[] {
  const lines = logContent.split('\n');
  const incidents: IncidentLog[] = [];

  for (const line of lines) {
    const match = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*(FIXED|APPLIED)\s*\|\s*(.+)$/);
    if (match) {
      incidents.push({
        timestamp: match[1],
        service: match[2].trim(),
        type: match[3].trim(),
        result: match[4],
        notes: match[5].trim(),
      });
    }
  }

  return incidents;
}

export default function Dashboard() {
  const [services, setServices] = useState<ServiceHealth[]>([
    { name: 'sms-service', url: 'http://localhost:3001/health', status: 'unknown', lastCheck: new Date() },
    { name: 'payment-service', url: 'http://localhost:3002/health', status: 'unknown', lastCheck: new Date() },
  ]);
  const [incidentLog, setIncidentLog] = useState<IncidentLog[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    checkServices();
    fetchIncidentLog();

    const interval = setInterval(() => {
      checkServices();
      fetchIncidentLog();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const checkServices = async () => {
    const results = await Promise.all(
      SERVICES.map(async (service) => {
        const health = await fetchHealth(service.url);
        return {
          ...service,
          status: health?.status === 'healthy' ? 'healthy' : health?.status === 'broken' ? 'broken' : 'unknown',
          lastCheck: new Date(),
        };
      })
    );
    setServices(results);
    setLastUpdated(new Date());
  };

  const fetchIncidentLog = async () => {
    try {
      const response = await fetch(INCIDENT_LOG_PATH);
      const text = await response.text();
      setIncidentLog(parseIncidentLog(text));
    } catch {
      console.error('Failed to fetch incident log');
    }
  };

  useEffect(() => {
    checkServices();
    fetchIncidentLog();

    const interval = setInterval(() => {
      checkServices();
      fetchIncidentLog();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const activeIncidents = services.filter(s => s.status !== 'healthy');
  const resolvedIncidents = incidentLog.filter(i => i.result === 'FIXED');

  return (
    <div>
      <div className="header">
        <h1 className="title">🤖 Project Sentinel Dashboard</h1>
        {mounted && <span className="last-updated">Last updated: {lastUpdated.toLocaleTimeString()}</span>}
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">Active Incidents</div>
          {activeIncidents.length === 0 ? (
            <div className="no-data">No active incidents</div>
          ) : (
            activeIncidents.map((service) => (
              <div key={service.name} className="incident-item">
                <span className={`status-dot ${service.status === 'broken' ? 'broken' : ''}`}></span>
                <strong>{service.name}</strong>
                <div style={{ color: '#f85149', marginTop: '4px' }}>
                  {service.status === 'unknown' ? 'Service unreachable' : 'Status: broken'}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="panel">
          <div className="panel-header">Resolved by Claude</div>
          {resolvedIncidents.length === 0 ? (
            <div className="no-data">No resolved incidents yet</div>
          ) : (
            resolvedIncidents.slice(0, 10).map((incident, idx) => (
              <div key={idx} className="resolved-item">
                <div>
                  <span className="log-timestamp">[{new Date(incident.timestamp).toLocaleString()}]</span>
                  {' '}<span style={{ color: '#3fb950' }}>{incident.service}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '4px' }}>
                  {incident.notes}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="panel">
          <div className="panel-header">System Health</div>
          {services.map((service) => (
            <div key={service.name} className="service-item">
              <span className={`status-dot ${service.status === 'healthy' ? 'healthy' : service.status === 'broken' ? 'broken' : ''}`}></span>
              <span style={{ fontWeight: 500 }}>{service.name}</span>
              <span className={`status-${service.status}`} style={{ float: 'right' }}>
                {service.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">Incident History Log</div>
        {incidentLog.length === 0 ? (
          <div className="no-data">No log entries</div>
        ) : (
          incidentLog.slice(0, 20).map((entry, idx) => (
            <div key={idx} className="log-entry">
              <span className="log-timestamp">{entry.timestamp}</span>
              {' | '}{entry.service}
              {' | '}{entry.type}
              {' | '}
              <span className={entry.result === 'FIXED' ? 'log-fix' : ''}>{entry.result}</span>
              {' | '}{entry.notes}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
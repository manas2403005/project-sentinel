'use client';

import { useEffect, useState } from 'react';
import '../app.css';

interface ServiceStatus {
  id: string;
  name: string;
  status: 'healthy' | 'broken' | 'unknown';
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
  resolved_at: string;
}

export default function Dashboard() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [mounted, setMounted] = useState(false);

  const fetchFromAPI = async () => {
    try {
      const [servicesRes, incidentsRes] = await Promise.all([
        fetch('/api/services'),
        fetch('/api/incidents'),
      ]);

      if (servicesRes.ok) {
        const servicesData = await servicesRes.json();
        setServices(servicesData);
      }

      if (incidentsRes.ok) {
        const incidentsData = await incidentsRes.json();
        setIncidents(incidentsData);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchFromAPI();

    const interval = setInterval(fetchFromAPI, 5000);
    return () => clearInterval(interval);
  }, []);

  const activeIncidents = incidents.filter(i => i.status === 'active');
  const resolvedIncidents = incidents.filter(i => i.status === 'resolved');

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

        <div className="panel">
          <div className="panel-header">Resolved by Claude</div>
          {resolvedIncidents.length === 0 ? (
            <div className="no-data">No resolved incidents yet</div>
          ) : (
            resolvedIncidents.slice(0, 10).map((incident) => (
              <div key={incident.id} className="resolved-item">
                <div>
                  <span className="log-timestamp">[{new Date(incident.timestamp).toLocaleString()}]</span>
                  {' '}<span style={{ color: '#3fb950' }}>{incident.service_name}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '4px' }}>
                  {incident.bug_type}: {incident.description}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="panel">
          <div className="panel-header">System Health</div>
          {services.map((service) => (
            <div key={service.id} className="service-item">
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
        <div className="panel-header">All Incidents</div>
        {incidents.length === 0 ? (
          <div className="no-data">No incidents in database</div>
        ) : (
          incidents.slice(0, 20).map((entry) => (
            <div key={entry.id} className="log-entry">
              <span className="log-timestamp">{entry.timestamp}</span>
              {' | '}{entry.service_name}
              {' | '}{entry.bug_type}
              {' | '}
              <span className={entry.status === 'resolved' ? 'log-fix' : ''}>{entry.status.toUpperCase()}</span>
              {' | '}{entry.description}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
const API_BASE = 'http://localhost:3001';

export async function fetchServers() {
  const res = await fetch(`${API_BASE}/api/servers`);
  return res.json();
}

export async function fetchAlerts() {
  const res = await fetch(`${API_BASE}/api/alerts`);
  return res.json();
}

export async function acknowledgeAlert(id: string) {
  const res = await fetch(`${API_BASE}/api/alerts/${id}/ack`, { method: 'POST' });
  return res.json();
}

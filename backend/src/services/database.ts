import Database from 'better-sqlite3';
import { Server, Alert, MonitorData } from '../types/index.js';

const db = new Database('monitor.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    status TEXT DEFAULT 'offline',
    lastHeartbeat INTEGER,
    createdAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    serverId TEXT NOT NULL,
    type TEXT NOT NULL,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    data TEXT,
    acknowledged INTEGER DEFAULT 0,
    createdAt INTEGER,
    FOREIGN KEY (serverId) REFERENCES servers(id)
  );

  CREATE INDEX IF NOT EXISTS idx_alerts_serverId ON alerts(serverId);
  CREATE INDEX IF NOT EXISTS idx_alerts_createdAt ON alerts(createdAt);
`);

export const serverService = {
  create(server: Server): void {
    const stmt = db.prepare(`
      INSERT INTO servers (id, name, platform, status, lastHeartbeat, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(server.id, server.name, server.platform, server.status, server.lastHeartbeat, server.createdAt);
  },

  findAll(): Server[] {
    const stmt = db.prepare('SELECT * FROM servers ORDER BY createdAt DESC');
    return stmt.all() as Server[];
  },

  findById(id: string): Server | undefined {
    const stmt = db.prepare('SELECT * FROM servers WHERE id = ?');
    return stmt.get(id) as Server | undefined;
  },

  updateStatus(id: string, status: Server['status']): void {
    const stmt = db.prepare('UPDATE servers SET status = ?, lastHeartbeat = ? WHERE id = ?');
    stmt.run(status, Date.now(), id);
  },

  updateHeartbeat(id: string): void {
    const stmt = db.prepare('UPDATE servers SET lastHeartbeat = ?, status = ? WHERE id = ?');
    stmt.run(Date.now(), 'online', id);
  }
};

export const alertService = {
  create(alert: Alert): void {
    const stmt = db.prepare(`
      INSERT INTO alerts (id, serverId, type, level, message, data, acknowledged, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      alert.id,
      alert.serverId,
      alert.type,
      alert.level,
      alert.message,
      JSON.stringify(alert.data),
      alert.acknowledged ? 1 : 0,
      alert.createdAt
    );
  },

  findAll(limit = 100): Alert[] {
    const stmt = db.prepare('SELECT * FROM alerts ORDER BY createdAt DESC LIMIT ?');
    const rows = stmt.all(limit) as any[];
    return rows.map(row => ({
      ...row,
      data: JSON.parse(row.data || '{}'),
      acknowledged: row.acknowledged === 1
    }));
  },

  findByServerId(serverId: string): Alert[] {
    const stmt = db.prepare('SELECT * FROM alerts WHERE serverId = ? ORDER BY createdAt DESC');
    const rows = stmt.all(serverId) as any[];
    return rows.map(row => ({
      ...row,
      data: JSON.parse(row.data || '{}'),
      acknowledged: row.acknowledged === 1
    }));
  },

  acknowledge(id: string): void {
    const stmt = db.prepare('UPDATE alerts SET acknowledged = 1 WHERE id = ?');
    stmt.run(id);
  }
};

export const monitorService = {
  saveData(data: MonitorData): void {
    if (data.type === 'resource_alert' && data.data.resources) {
      const { cpu, memory, disk } = data.data.resources;
      const alerts: Alert[] = [];

      if (cpu > 90) {
        alerts.push({
          id: `alert-${data.serverId}-cpu-${Date.now()}`,
          serverId: data.serverId,
          type: 'resource_alert',
          level: 'critical',
          message: `CPU 使用率过高: ${cpu}%`,
          data: { metric: 'cpu', value: cpu },
          acknowledged: false,
          createdAt: Date.now()
        });
      }

      if (memory > 90) {
        alerts.push({
          id: `alert-${data.serverId}-memory-${Date.now()}`,
          serverId: data.serverId,
          type: 'resource_alert',
          level: 'critical',
          message: `内存使用率过高: ${memory}%`,
          data: { metric: 'memory', value: memory },
          acknowledged: false,
          createdAt: Date.now()
        });
      }

      for (const alert of alerts) {
        alertService.create(alert);
      }
    }
  }
};

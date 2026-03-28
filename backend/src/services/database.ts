import { InfluxDB, Point } from '@influxdata/influxdb-client';
import { Server, Alert, MonitorData } from '../types/index.js';

const INFLUX_URL = process.env.INFLUX_URL || 'http://localhost:8086';
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || 'my-token';
const INFLUX_ORG = process.env.INFLUX_ORG || 'my-org';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'monitor';

const influxDb = new InfluxDB({ url: INFLUX_URL, token: INFLUX_TOKEN });

const writeApi = influxDb.getWriteApi(INFLUX_ORG, INFLUX_BUCKET, 'ns');
const queryApi = influxDb.getQueryApi(INFLUX_ORG);

const serverDb = new Map<string, Server>();

export const serverService = {
  create(server: Server): void {
    serverDb.set(server.id, server);
  },

  findAll(): Server[] {
    return Array.from(serverDb.values());
  },

  findById(id: string): Server | undefined {
    return serverDb.get(id);
  },

  updateStatus(id: string, status: Server['status']): void {
    const server = serverDb.get(id);
    if (server) {
      server.status = status;
      server.lastHeartbeat = Date.now();
    }
  },

  updateHeartbeat(id: string): void {
    const server = serverDb.get(id);
    if (server) {
      server.status = 'online';
      server.lastHeartbeat = Date.now();
    }
  }
};

export const alertService = {
  create(alert: Alert): void {
    const point = new Point('alerts')
      .tag('serverId', alert.serverId)
      .tag('type', alert.type)
      .tag('level', alert.level)
      .stringField('message', alert.message)
      .stringField('data', JSON.stringify(alert.data))
      .booleanField('acknowledged', alert.acknowledged)
      .timestamp(new Date(alert.createdAt));

    writeApi.writePoint(point);
  },

  async findAll(limit = 100): Promise<Alert[]> {
    const query = `
      from(bucket: "${INFLUX_BUCKET}")
        |> range(start: -30d)
        |> filter(fn: (r) => r._measurement == "alerts")
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: ${limit})
    `;

    try {
      const results: Alert[] = [];
      const fluxQuery = queryApi.iterRows(query);

      for await (const row of fluxQuery) {
        if (row.values._field === 'message') {
          results.push({
            id: `alert-${row.values._time}`,
            serverId: row.values.serverId as string,
            type: row.values.type as Alert['type'],
            level: row.values.level as Alert['level'],
            message: row.values._value as string,
            data: {},
            acknowledged: false,
            createdAt: new Date(row.values._time).getTime()
          });
        }
      }
      return results;
    } catch (e) {
      console.error('InfluxDB query error:', e);
      return [];
    }
  },

  async findByServerId(serverId: string): Promise<Alert[]> {
    const all = await this.findAll(100);
    return all.filter(a => a.serverId === serverId);
  },

  acknowledge(id: string): void {
    console.log('Alert acknowledged:', id);
  }
};

export const monitorService = {
  async saveData(data: MonitorData): Promise<void> {
    const timestamp = new Date(data.timestamp);

    if (data.data.resources) {
      const { cpu, memory, disk } = data.data.resources;

      const point = new Point('server_metrics')
        .tag('serverId', data.serverId)
        .tag('host', data.serverId)
        .floatField('cpu', cpu)
        .floatField('memory', memory)
        .floatField('disk', disk)
        .timestamp(timestamp);

      writeApi.writePoint(point);
    }

    if (data.data.files && data.data.files.length > 0) {
      for (const file of data.data.files) {
        const alert = {
          id: `file-alert-${data.serverId}-${Date.now()}`,
          serverId: data.serverId,
          type: 'file_change' as const,
          level: 'warning' as const,
          message: `文件变更: ${file.path} (${file.action})`,
          data: { path: file.path, action: file.action },
          acknowledged: false,
          createdAt: data.timestamp
        };
        alertService.create(alert);
      }
    }

    if (data.data.connections) {
      console.log(`Server ${data.serverId} connections:`, data.data.connections);
    }

    if (data.type === 'resource_alert' && data.data.resources) {
      const { cpu, memory, disk } = data.data.resources;

      if (cpu > 90) {
        alertService.create({
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
        alertService.create({
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
    }
  }
};

export async function flushWrite(): Promise<void> {
  try {
    await writeApi.flush();
  } catch (e) {
    console.error('Failed to flush InfluxDB:', e);
  }
}

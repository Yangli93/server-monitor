export interface Server {
  id: string;
  name: string;
  platform: 'linux' | 'kylin' | 'windows' | 'macos';
  status: 'online' | 'offline' | 'warning';
  lastHeartbeat: number;
  createdAt: number;
}

export interface Alert {
  id: string;
  serverId: string;
  type: 'file_change' | 'connection_change' | 'resource_alert';
  level: 'info' | 'warning' | 'critical';
  message: string;
  data: Record<string, unknown>;
  acknowledged: boolean;
  createdAt: number;
}

export interface MonitorData {
  serverId: string;
  timestamp: number;
  type: string;
  data: {
    files?: FileChange[];
    connections?: Connection[];
    resources?: Resources;
  };
}

export interface FileChange {
  path: string;
  action: 'created' | 'modified' | 'deleted';
  oldHash?: string;
  newHash?: string;
}

export interface Connection {
  protocol: string;
  local: string;
  remote: string;
  state: string;
}

export interface Resources {
  cpu: number;
  memory: number;
  disk: number;
}

export interface ScriptConfig {
  platform: 'linux' | 'kylin' | 'windows' | 'macos';
  serverId: string;
  serverUrl: string;
  monitorFiles: boolean;
  monitorConnections: boolean;
  monitorResources: boolean;
  heartbeatInterval: number;
}

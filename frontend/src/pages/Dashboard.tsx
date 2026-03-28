import { useState, useEffect } from 'react';
import type { Server, Alert } from '../types';
import { fetchServers, fetchAlerts, acknowledgeAlert } from '../utils/api';
import { Server as ServerIcon, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export function Dashboard() {
  const [servers, setServers] = useState<Server[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [serversRes, alertsRes] = await Promise.all([fetchServers(), fetchAlerts()]);
        setServers(serversRes.servers || []);
        setAlerts(alertsRes.alerts || []);
      } catch (e) {
        console.error('Failed to load data:', e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAcknowledge = async (id: string) => {
    await acknowledgeAlert(id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-500';
      case 'offline': return 'text-red-500';
      case 'warning': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'info': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">加载中...</div>;
  }

  const onlineCount = servers.filter(s => s.status === 'online').length;
  const offlineCount = servers.filter(s => s.status === 'offline').length;
  const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged).length;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">服务器监控仪表盘</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center gap-3">
            <ServerIcon className="text-blue-500" />
            <div>
              <p className="text-sm text-gray-500">服务器总数</p>
              <p className="text-2xl font-bold">{servers.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center gap-3">
            <CheckCircle className="text-green-500" />
            <div>
              <p className="text-sm text-gray-500">在线</p>
              <p className="text-2xl font-bold text-green-500">{onlineCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center gap-3">
            <Clock className="text-red-500" />
            <div>
              <p className="text-sm text-gray-500">离线</p>
              <p className="text-2xl font-bold text-red-500">{offlineCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-yellow-500" />
            <div>
              <p className="text-sm text-gray-500">未确认告警</p>
              <p className="text-2xl font-bold text-yellow-500">{unacknowledgedAlerts}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">服务器列表</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {servers.length === 0 ? (
              <p className="text-gray-500 text-center py-4">暂无服务器数据</p>
            ) : (
              servers.map(server => (
                <div key={server.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${server.status === 'online' ? 'bg-green-500' : server.status === 'offline' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                    <div>
                      <p className="font-medium">{server.name}</p>
                      <p className="text-sm text-gray-500">{server.id} | {server.platform}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-medium ${getStatusColor(server.status)}`}>
                    {server.status === 'online' ? '在线' : server.status === 'offline' ? '离线' : '警告'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">告警列表</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="text-gray-500 text-center py-4">暂无告警</p>
            ) : (
              alerts.map(alert => (
                <div key={alert.id} className="p-3 bg-gray-50 rounded">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <span className={`inline-block px-2 py-1 text-xs rounded ${getLevelColor(alert.level)}`}>
                        {alert.level === 'critical' ? '严重' : alert.level === 'warning' ? '警告' : '信息'}
                      </span>
                      <p className="mt-2 text-sm">{alert.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(alert.createdAt).toLocaleString()} | {alert.serverId}
                      </p>
                    </div>
                    {!alert.acknowledged && (
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        className="ml-3 text-sm text-blue-500 hover:text-blue-700"
                      >
                        确认
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

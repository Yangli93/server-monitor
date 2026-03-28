import { useEffect, useState, useRef } from 'react';
import type { MonitorData, Alert } from '../types';

const API_BASE = 'http://localhost:3001';

export function useSSELocalhost(serverId: string, onData?: (data: MonitorData) => void) {
  const [connected, setConnected] = useState(false);
  const [lastData, setLastData] = useState<MonitorData | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!serverId) return;

    const eventSource = new EventSource(`${API_BASE}/sse/frontend/${serverId}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastData(data);
        onData?.(data);
      } catch (e) {
        console.error('Failed to parse SSE data:', e);
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
      eventSource.close();
      setTimeout(() => {
        if (eventSourceRef.current) {
          const newEventSource = new EventSource(`${API_BASE}/sse/frontend/${serverId}`);
          eventSourceRef.current = newEventSource;
        }
      }, 5000);
    };

    return () => {
      eventSource.close();
    };
  }, [serverId]);

  return { connected, lastData };
}

export function useAlerts(onAlert?: (alert: Alert) => void) {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE}/sse/frontend/all`);

    eventSource.addEventListener('alert', (event) => {
      try {
        const alert = JSON.parse(event.data);
        setAlerts(prev => [alert, ...prev].slice(0, 100));
        onAlert?.(alert);
      } catch (e) {
        console.error('Failed to parse alert:', e);
      }
    });

    return () => {
      eventSource.close();
    };
  }, []);

  return alerts;
}

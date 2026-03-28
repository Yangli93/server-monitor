import { FastifyRequest } from 'fastify';
import { SSEResponse } from '../types/index.js';
import { monitorService, serverService, alertService } from './database.js';

interface AgentConnection {
  serverId: string;
  request: FastifyRequest;
  controller: ReadableStreamDefaultController;
}

interface FrontendConnection {
  serverId: string;
  controller: ReadableStreamDefaultController;
}

class SSEService {
  private agentConnections: Map<string, AgentConnection> = new Map();
  private frontendConnections: Map<string, FrontendConnection> = new Map();

  addAgentConnection(serverId: string, request: FastifyRequest, controller: ReadableStreamDefaultController): void {
    this.agentConnections.set(serverId, { serverId, request, controller });
    console.log(`Agent connected: ${serverId}. Total agents: ${this.agentConnections.size}`);
  }

  removeAgentConnection(serverId: string): void {
    this.agentConnections.delete(serverId);
    serverService.updateStatus(serverId, 'offline');
    console.log(`Agent disconnected: ${serverId}. Total agents: ${this.agentConnections.size}`);
  }

  addFrontendConnection(serverId: string, controller: ReadableStreamDefaultController): void {
    this.frontendConnections.set(serverId, { serverId, controller });
    console.log(`Frontend subscribed: ${serverId}. Total subscribers: ${this.frontendConnections.size}`);
  }

  removeFrontendConnection(serverId: string): void {
    this.frontendConnections.delete(serverId);
    console.log(`Frontend unsubscribed: ${serverId}. Total subscribers: ${this.frontendConnections.size}`);
  }

  broadcastToFrontend(serverId: string, event: string, data: unknown): void {
    const connection = this.frontendConnections.get(serverId);
    if (connection) {
      const message: SSEResponse = { event, data: JSON.stringify(data) };
      try {
        connection.controller.enqueue(`event: ${message.event}\ndata: ${message.data}\n\n`);
      } catch (e) {
        this.removeFrontendConnection(serverId);
      }
    }
  }

  broadcastAll(event: string, data: unknown): void {
    const message: SSEResponse = { event, data: JSON.stringify(data) };
    const encoded = `event: ${message.event}\ndata: ${message.data}\n\n`;

    for (const [serverId, connection] of this.frontendConnections) {
      try {
        connection.controller.enqueue(encoded);
      } catch (e) {
        this.removeFrontendConnection(serverId);
      }
    }
  }

  handleAgentData(serverId: string, data: any): void {
    serverService.updateHeartbeat(serverId);
    monitorService.saveData(data);

    const alertEvent = data.type === 'file_change' || data.type === 'connection_change' || data.type === 'resource_alert';
    if (alertEvent) {
      this.broadcastAll('alert', data);
    }

    this.broadcastToFrontend(serverId, 'data', data);
  }

  sendHeartbeatResponse(serverId: string): void {
    const connection = this.agentConnections.get(serverId);
    if (connection) {
      try {
        connection.controller.enqueue(`event: heartbeat\ndata: ${JSON.stringify({ serverId, timestamp: Date.now() })}\n\n`);
      } catch (e) {
        this.removeAgentConnection(serverId);
      }
    }
  }

  getConnectedAgents(): string[] {
    return Array.from(this.agentConnections.keys());
  }
}

export const sseService = new SSEService();

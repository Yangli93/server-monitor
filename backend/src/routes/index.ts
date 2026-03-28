import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sseService } from '../services/sse.js';
import { serverService, alertService } from '../services/database.js';
import { Server, Alert } from '../types/index.js';

export async function agentRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/sse/agent/:serverId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { serverId } = request.params as { serverId: string };

    const server = serverService.findById(serverId);
    if (!server) {
      const newServer: Server = {
        id: serverId,
        name: serverId,
        platform: 'linux',
        status: 'online',
        lastHeartbeat: Date.now(),
        createdAt: Date.now()
      };
      serverService.create(newServer);
    } else {
      serverService.updateHeartbeat(serverId);
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    const encoder = new TextEncoder();
    const controller = new ReadableStreamDefaultController({
      enqueue: (chunk) => {
        reply.raw.write(chunk);
      },
      close: () => {
        reply.raw.end();
      },
      error: (e) => {
        console.error('SSE error:', e);
        reply.raw.end();
      }
    } as ReadableStreamDefaultController);

    sseService.addAgentConnection(serverId, request, controller);

    reply.raw.on('close', () => {
      sseService.removeAgentConnection(serverId);
    });

    const heartbeatInterval = setInterval(() => {
      sseService.sendHeartbeatResponse(serverId);
    }, 30000);

    request.raw.on('close', () => {
      clearInterval(heartbeatInterval);
      sseService.removeAgentConnection(serverId);
    });

    return reply;
  });
}

export async function frontendRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/sse/frontend/:serverId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { serverId } = request.params as { serverId: string };

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    const controller = new ReadableStreamDefaultController({
      enqueue: (chunk) => {
        reply.raw.write(chunk);
      },
      close: () => {
        reply.raw.end();
      },
      error: (e) => {
        console.error('SSE error:', e);
        reply.raw.end();
      }
    } as ReadableStreamDefaultController);

    sseService.addFrontendConnection(serverId, controller);

    reply.raw.on('close', () => {
      sseService.removeFrontendConnection(serverId);
    });

    return reply;
  });
}

export async function apiRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/servers', async (request, reply) => {
    const servers = serverService.findAll();
    return reply.send({ servers });
  });

  fastify.get('/api/servers/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const server = serverService.findById(id);
    if (!server) {
      return reply.status(404).send({ error: 'Server not found' });
    }
    return reply.send({ server });
  });

  fastify.get('/api/alerts', async (request, reply) => {
    const alerts = alertService.findAll();
    return reply.send({ alerts });
  });

  fastify.post('/api/alerts/:id/ack', async (request, reply) => {
    const { id } = request.params as { id: string };
    alertService.acknowledge(id);
    return reply.send({ success: true });
  });

  fastify.post('/api/data', async (request, reply) => {
    const data = request.body;
    console.log('Received data:', data);
    return reply.send({ success: true });
  });
}

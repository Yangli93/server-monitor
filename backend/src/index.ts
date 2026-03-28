import Fastify from 'fastify';
import cors from '@fastify/cors';
import { agentRoutes, frontendRoutes, apiRoutes } from './routes/index.js';

const fastify = Fastify({
  logger: true
});

await fastify.register(cors, {
  origin: true
});

await fastify.register(agentRoutes);
await fastify.register(frontendRoutes);
await fastify.register(apiRoutes);

const start = async () => {
  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    console.log('Server running at http://localhost:3001');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

import type { FastifyInstance } from 'fastify'

export function healthController(app: FastifyInstance) {
  app.get('/health', async () => ({ status: 'ok' }))
}

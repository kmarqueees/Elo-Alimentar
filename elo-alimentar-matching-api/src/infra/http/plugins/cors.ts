import type { FastifyInstance } from 'fastify'

/** CORS aberto para o front end local (Vite) e para o arquivo requests.http. */
export function registerCors(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*')

    if (request.method === 'OPTIONS') {
      return reply
        .header('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS')
        .header('Access-Control-Allow-Headers', 'Content-Type')
        .status(204)
        .send()
    }
  })
}

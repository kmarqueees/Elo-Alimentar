import fastify from 'fastify'
import { composeUseCases, type Repositories } from './compose-use-cases'
import { errorHandler } from './error-handler'
import { registerRoutes } from './routes'

export interface AppDependencies extends Repositories {
  clock?: () => Date
  reservationTimeoutMinutes?: number | undefined
  reservationSweepIntervalMs?: number
}

export function buildApp({
  clock = () => new Date(),
  reservationTimeoutMinutes,
  reservationSweepIntervalMs = 0,
  ...repositories
}: AppDependencies) {
  const app = fastify()
  const useCases = composeUseCases(repositories, { reservationTimeoutMinutes })

  app.setErrorHandler(errorHandler)

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

  if (reservationSweepIntervalMs > 0) {
    let timer: NodeJS.Timeout | undefined

    app.addHook('onReady', async () => {
      timer = setInterval(() => {
        useCases.expireReservations
          .execute({ now: clock() })
          .catch((error) => console.error(error))
      }, reservationSweepIntervalMs)
      timer.unref()
    })

    app.addHook('onClose', async () => clearInterval(timer))
  }

  registerRoutes(app, { useCases, clock })

  return app
}

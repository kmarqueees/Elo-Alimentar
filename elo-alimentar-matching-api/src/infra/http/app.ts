import fastify from 'fastify'
import { batchesController } from './controllers/batches.controller'
import { geocodingController } from './controllers/geocoding.controller'
import { healthController } from './controllers/health.controller'
import { institutionsController } from './controllers/institutions.controller'
import { matchingController } from './controllers/matching.controller'
import { notificationsController } from './controllers/notifications.controller'
import { offersController } from './controllers/offers.controller'
import { errorHandler } from './error-handler'
import type { HttpDependencies } from './http-dependencies'
import { registerCors } from './plugins/cors'

/** Monta só a camada HTTP. Quem cria os use cases é o composition root (src/main). */
export function buildHttpApp(dependencies: HttpDependencies) {
  const app = fastify()

  app.setErrorHandler(errorHandler)
  registerCors(app)

  healthController(app)
  institutionsController(app, dependencies)
  batchesController(app, dependencies)
  offersController(app, dependencies)
  matchingController(app, dependencies)
  geocodingController(app, dependencies)
  notificationsController(app, dependencies)

  return app
}

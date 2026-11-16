import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { FOOD_TYPES, STORAGE_CONDITIONS } from '@/matching/types'
import { STRATEGY_KEYS, type UseCases } from './compose-use-cases'
import {
  presentComparison,
  presentInstitution,
  presentMatches,
} from './presenters'

interface RouteDependencies {
  useCases: UseCases
  clock: () => Date
}

const idParams = z.object({ id: z.string().min(1) })

const createInstitutionBody = z.object({
  name: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  hasRefrigeration: z.boolean(),
  availableCapacityKg: z.number(),
  acceptedFoodTypes: z.array(z.enum(FOOD_TYPES)).default([]),
})

const createBatchBody = z.object({
  donorId: z.string().min(1),
  foodType: z.enum(FOOD_TYPES),
  quantityKg: z.number(),
  expiresAt: z.coerce.date(),
  storageCondition: z.enum(STORAGE_CONDITIONS),
  latitude: z.number(),
  longitude: z.number(),
})

const matchesQuery = z.object({
  strategy: z.enum(STRATEGY_KEYS).default('multicriteria'),
  now: z.coerce.date().optional(),
})

const listBatchesQuery = z.object({
  status: z.enum(['AVAILABLE', 'RESERVED', 'COLLECTED', 'EXPIRED', 'ALL']).default('AVAILABLE'),
})

const reserveBody = z.object({ institutionId: z.string().min(1) })

const comparisonQuery = z.object({
  now: z.coerce.date().optional(),
})

export function registerRoutes(
  app: FastifyInstance,
  { useCases, clock }: RouteDependencies,
) {
  app.get('/health', async () => ({ status: 'ok' }))

  app.post('/institutions', async (request, reply) => {
    const body = createInstitutionBody.parse(request.body)

    const { institution } = await useCases.registerInstitution.execute(body)

    return reply.status(201).send({ institution: presentInstitution(institution) })
  })

  app.get('/institutions', async () => {
    const { institutions } = await useCases.listInstitutions.execute()

    return { institutions: institutions.map(presentInstitution) }
  })

  app.patch('/institutions/:id/validate', async (request) => {
    const { id } = idParams.parse(request.params)

    const { institution } = await useCases.validateInstitution.execute({
      institutionId: id,
    })

    return { institution: presentInstitution(institution) }
  })

  app.post('/batches', async (request, reply) => {
    const body = createBatchBody.parse(request.body)

    const { batch } = await useCases.registerFoodBatch.execute({
      ...body,
      now: clock(),
    })

    return reply.status(201).send({ batch })
  })

  app.get('/batches', async (request) => {
    const { status } = listBatchesQuery.parse(request.query)

    return useCases.listBatches.execute(status === 'ALL' ? {} : { status })
  })

  app.get('/batches/:id', async (request) => {
    const { id } = idParams.parse(request.params)

    return useCases.getBatch.execute({ batchId: id })
  })

  app.post('/batches/:id/reservations', async (request, reply) => {
    const { id } = idParams.parse(request.params)
    const { institutionId } = reserveBody.parse(request.body)

    const { reservation } = await useCases.reserveBatch.execute({
      batchId: id,
      institutionId,
      now: clock(),
    })

    return reply.status(201).send({ reservation })
  })

  app.get('/batches/:id/reservations', async (request) => {
    const { id } = idParams.parse(request.params)

    return useCases.listBatchReservations.execute({ batchId: id })
  })

  app.patch('/reservations/:id/confirm', async (request) => {
    const { id } = idParams.parse(request.params)

    return useCases.confirmReservation.execute({ reservationId: id, now: clock() })
  })

  app.patch('/reservations/:id/reject', async (request) => {
    const { id } = idParams.parse(request.params)

    return useCases.rejectReservation.execute({ reservationId: id })
  })

  app.patch('/reservations/:id/pickup', async (request) => {
    const { id } = idParams.parse(request.params)

    return useCases.completePickup.execute({ reservationId: id })
  })

  app.get('/batches/:id/matches', async (request) => {
    const { id } = idParams.parse(request.params)
    const query = matchesQuery.parse(request.query)
    const now = query.now ?? clock()

    const { batch, ranking } = await useCases.matchBatch[query.strategy].execute({
      batchId: id,
      now,
    })

    return presentMatches({ strategy: query.strategy, now, batch, ranking })
  })

  app.get('/comparison', async (request) => {
    const query = comparisonQuery.parse(request.query)
    const now = query.now ?? clock()

    const result = await useCases.compareStrategies.execute({ now })

    return presentComparison(result, now)
  })
}

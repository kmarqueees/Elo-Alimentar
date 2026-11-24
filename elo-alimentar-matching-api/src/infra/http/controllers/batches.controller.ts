import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { BATCH_STATUSES } from '@/domain/food-batch/food-batch'
import { FOOD_TYPES, STORAGE_CONDITIONS } from '@/domain/shared/food'
import type { HttpDependencies } from '../http-dependencies'
import { presentFoodBatch } from '../presenters/food-batch-presenter'
import { idParams } from './schemas'

const createBatchBody = z.object({
  donorId: z.string().min(1),
  foodType: z.enum(FOOD_TYPES),
  quantityKg: z.number(),
  expiresAt: z.coerce.date(),
  storageCondition: z.enum(STORAGE_CONDITIONS),
  latitude: z.number(),
  longitude: z.number(),
})

const listBatchesQuery = z.object({
  status: z.enum([...BATCH_STATUSES, 'ALL']).default('AVAILABLE'),
})

export function batchesController(
  app: FastifyInstance,
  { useCases, clock }: HttpDependencies,
) {
  app.post('/batches', async (request, reply) => {
    const body = createBatchBody.parse(request.body)

    const { batch } = await useCases.registerFoodBatch.execute({
      ...body,
      now: clock(),
    })

    return reply.status(201).send({ batch: presentFoodBatch(batch) })
  })

  app.get('/batches', async (request) => {
    const { status } = listBatchesQuery.parse(request.query)

    const { batches } = await useCases.listBatches.execute(
      status === 'ALL' ? {} : { status },
    )

    return { batches: batches.map(presentFoodBatch) }
  })

  app.get('/batches/:id', async (request) => {
    const { id } = idParams.parse(request.params)

    const { batch } = await useCases.getBatch.execute({ batchId: id })

    return { batch: presentFoodBatch(batch) }
  })
}

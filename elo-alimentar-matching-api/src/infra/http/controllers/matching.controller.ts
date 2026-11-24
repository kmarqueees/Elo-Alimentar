import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { STRATEGY_KEYS, type HttpDependencies } from '../http-dependencies'
import { presentComparison, presentMatches } from '../presenters/matching-presenter'
import { idParams } from './schemas'

const matchesQuery = z.object({
  strategy: z.enum(STRATEGY_KEYS).default('multicriteria'),
  now: z.coerce.date().optional(),
})

const comparisonQuery = z.object({
  now: z.coerce.date().optional(),
})

export function matchingController(
  app: FastifyInstance,
  { useCases, clock }: HttpDependencies,
) {
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

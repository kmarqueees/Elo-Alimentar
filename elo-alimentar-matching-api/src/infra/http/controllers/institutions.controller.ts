import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { FOOD_TYPES } from '@/domain/shared/food'
import type { HttpDependencies } from '../http-dependencies'
import { presentInstitution } from '../presenters/institution-presenter'
import { idParams } from './schemas'

const createInstitutionBody = z.object({
  name: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  hasRefrigeration: z.boolean(),
  storageCapacityKg: z.number(),
  peopleServed: z.number(),
  stockKg: z.number().default(0),
  acceptedFoodTypes: z.array(z.enum(FOOD_TYPES)).default([]),
})

const updateStockBody = z.object({ stockKg: z.number() })

export function institutionsController(
  app: FastifyInstance,
  { useCases, clock }: HttpDependencies,
) {
  app.post('/institutions', async (request, reply) => {
    const body = createInstitutionBody.parse(request.body)
    const now = clock()

    const { institution } = await useCases.registerInstitution.execute({ ...body, now })

    return reply.status(201).send({ institution: presentInstitution(institution, now) })
  })

  app.get('/institutions', async () => {
    const now = clock()
    const { institutions } = await useCases.listInstitutions.execute()

    return { institutions: institutions.map((item) => presentInstitution(item, now)) }
  })

  app.patch('/institutions/:id/validate', async (request) => {
    const { id } = idParams.parse(request.params)

    const { institution } = await useCases.validateInstitution.execute({
      institutionId: id,
    })

    return { institution: presentInstitution(institution, clock()) }
  })

  /** A instituição informa o estoque real; o sistema volta a estimar a partir dele. */
  app.patch('/institutions/:id/stock', async (request) => {
    const { id } = idParams.parse(request.params)
    const { stockKg } = updateStockBody.parse(request.body)
    const now = clock()

    const { institution } = await useCases.updateInstitutionStock.execute({
      institutionId: id,
      stockKg,
      now,
    })

    return { institution: presentInstitution(institution, now) }
  })
}

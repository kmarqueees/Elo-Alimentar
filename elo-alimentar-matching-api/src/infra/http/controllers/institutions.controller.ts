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
  availableCapacityKg: z.number(),
  acceptedFoodTypes: z.array(z.enum(FOOD_TYPES)).default([]),
})

export function institutionsController(
  app: FastifyInstance,
  { useCases }: HttpDependencies,
) {
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
}

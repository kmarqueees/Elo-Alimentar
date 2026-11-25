import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { HttpDependencies } from '../http-dependencies'

const postalCodeParams = z.object({ cep: z.string().min(1) })
const searchQuery = z.object({ q: z.string().default('') })

/** Ajuda o doador a preencher o endereço de retirada (ViaCEP e Nominatim, via API). */
export function geocodingController(app: FastifyInstance, { useCases }: HttpDependencies) {
  app.get('/geocoding/postal-code/:cep', async (request) => {
    const { cep } = postalCodeParams.parse(request.params)

    return useCases.lookupPostalCode.execute({ postalCode: cep })
  })

  app.get('/geocoding/search', async (request) => {
    const { q } = searchQuery.parse(request.query)

    return useCases.searchAddress.execute({ query: q })
  })
}

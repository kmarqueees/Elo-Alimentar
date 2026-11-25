import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { HttpDependencies } from '../http-dependencies'
import { presentInstitutionOffer, presentOffer } from '../presenters/offer-presenter'
import { idParams } from './schemas'

/**
 * Login ainda é de demonstração: a instituição se identifica no corpo da
 * requisição. O domínio garante que só a instituição ofertada responde.
 */
const institutionBody = z.object({ institutionId: z.string().min(1) })

export function offersController(
  app: FastifyInstance,
  { useCases, clock }: HttpDependencies,
) {
  /** Doador: histórico de ofertas do lote. */
  app.get('/batches/:id/offers', async (request) => {
    const { id } = idParams.parse(request.params)

    const { offers } = await useCases.listBatchOffers.execute({ batchId: id })

    return { offers: offers.map(presentOffer) }
  })

  /** Instituição: ofertas que ela recebeu (sem ranking nem dados de terceiros). */
  app.get('/institutions/:id/offers', async (request) => {
    const { id } = idParams.parse(request.params)

    const { offers } = await useCases.listInstitutionOffers.execute({
      institutionId: id,
    })

    return { offers: offers.map(presentInstitutionOffer) }
  })

  app.patch('/offers/:id/accept', async (request) => {
    const { id } = idParams.parse(request.params)
    const { institutionId } = institutionBody.parse(request.body)

    const { offer } = await useCases.acceptOffer.execute({
      offerId: id,
      institutionId,
      now: clock(),
    })

    return { offer: presentOffer(offer) }
  })

  app.patch('/offers/:id/decline', async (request) => {
    const { id } = idParams.parse(request.params)
    const { institutionId } = institutionBody.parse(request.body)

    const { offer, nextOffer } = await useCases.declineOffer.execute({
      offerId: id,
      institutionId,
      now: clock(),
    })

    // A instituição que recusou não fica sabendo para quem o lote foi depois.
    return { offer: presentOffer(offer), offeredToNext: nextOffer !== null }
  })

  app.patch('/offers/:id/pickup', async (request) => {
    const { id } = idParams.parse(request.params)
    const { institutionId } = institutionBody.parse(request.body)

    const { offer } = await useCases.completePickup.execute({
      offerId: id,
      institutionId,
      now: clock(),
    })

    return { offer: presentOffer(offer) }
  })
}

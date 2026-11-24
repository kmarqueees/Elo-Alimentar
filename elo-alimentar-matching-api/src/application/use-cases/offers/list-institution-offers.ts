import { ResourceNotFoundError } from '@/core/errors/resource-not-found-error'
import type { FoodBatch } from '@/domain/food-batch/food-batch'
import type { FoodBatchesRepository } from '@/domain/food-batch/food-batches-repository'
import type { Offer } from '@/domain/food-batch/offer'
import type { InstitutionsRepository } from '@/domain/institution/institutions-repository'

interface ListInstitutionOffersUseCaseRequest {
  institutionId: string
}

export interface InstitutionOffer {
  offer: Offer
  batch: FoodBatch
}

/**
 * Ofertas recebidas por uma instituição, das mais recentes para as mais
 * antigas. A instituição só vê o que foi oferecido a ELA: sem ranking, sem
 * posição e sem dados de outras instituições.
 */
export class ListInstitutionOffersUseCase {
  constructor(
    private batchesRepository: FoodBatchesRepository,
    private institutionsRepository: InstitutionsRepository,
  ) {}

  async execute({
    institutionId,
  }: ListInstitutionOffersUseCaseRequest): Promise<{ offers: InstitutionOffer[] }> {
    const institution = await this.institutionsRepository.findById(institutionId)

    if (!institution) {
      throw new ResourceNotFoundError()
    }

    const batches = await this.batchesRepository.findManyOfferedTo(institutionId)

    const offers = batches
      .flatMap((batch) =>
        batch.offers
          .filter((offer) => offer.institutionId === institutionId)
          .map((offer) => ({ offer, batch })),
      )
      .sort((a, b) => b.offer.createdAt.getTime() - a.offer.createdAt.getTime())

    return { offers }
  }
}

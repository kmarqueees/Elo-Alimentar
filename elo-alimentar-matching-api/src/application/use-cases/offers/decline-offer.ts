import { ResourceNotFoundError } from '@/core/errors/resource-not-found-error'
import type { FoodBatchesRepository } from '@/domain/food-batch/food-batches-repository'
import type { Offer } from '@/domain/food-batch/offer'
import type { InstitutionsRepository } from '@/domain/institution/institutions-repository'
import type { SequentialOfferService } from '@/domain/matching/sequential-offer-service'

interface DeclineOfferUseCaseRequest {
  offerId: string
  institutionId: string
  now: Date
}

interface DeclineOfferUseCaseResponse {
  offer: Offer
  /** Oferta feita em seguida à próxima instituição do ranking, se houver. */
  nextOffer: Offer | null
}

/** A instituição recusa: o lote segue na hora para a próxima do ranking (RN08). */
export class DeclineOfferUseCase {
  constructor(
    private batchesRepository: FoodBatchesRepository,
    private institutionsRepository: InstitutionsRepository,
    private offers: SequentialOfferService,
  ) {}

  async execute({
    offerId,
    institutionId,
    now,
  }: DeclineOfferUseCaseRequest): Promise<DeclineOfferUseCaseResponse> {
    const batch = await this.batchesRepository.findByOfferId(offerId)

    if (!batch) {
      throw new ResourceNotFoundError()
    }

    const offer = batch.declineOffer(offerId, institutionId, now)

    const institutions = await this.institutionsRepository.findManyValidated()
    const nextOffer = this.offers.offerToNext(batch, institutions, now)

    await this.batchesRepository.save(batch)

    return { offer, nextOffer }
  }
}

import { ResourceNotFoundError } from '@/core/errors/resource-not-found-error'
import type { FoodBatchesRepository } from '@/domain/food-batch/food-batches-repository'
import type { Offer } from '@/domain/food-batch/offer'

interface AcceptOfferUseCaseRequest {
  offerId: string
  institutionId: string
  now: Date
}

/** A instituição ofertada aceita o lote dentro do prazo e passa a ser responsável pela retirada. */
export class AcceptOfferUseCase {
  constructor(private batchesRepository: FoodBatchesRepository) {}

  async execute({
    offerId,
    institutionId,
    now,
  }: AcceptOfferUseCaseRequest): Promise<{ offer: Offer }> {
    const batch = await this.batchesRepository.findByOfferId(offerId)

    if (!batch) {
      throw new ResourceNotFoundError()
    }

    const offer = batch.acceptOffer(offerId, institutionId, now)

    await this.batchesRepository.save(batch)

    return { offer }
  }
}

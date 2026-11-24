import { ResourceNotFoundError } from '@/core/errors/resource-not-found-error'
import type { FoodBatchesRepository } from '@/domain/food-batch/food-batches-repository'
import type { Offer } from '@/domain/food-batch/offer'

interface CompletePickupUseCaseRequest {
  offerId: string
  institutionId: string
}

/** A instituição que aceitou registra a retirada do lote. */
export class CompletePickupUseCase {
  constructor(private batchesRepository: FoodBatchesRepository) {}

  async execute({
    offerId,
    institutionId,
  }: CompletePickupUseCaseRequest): Promise<{ offer: Offer }> {
    const batch = await this.batchesRepository.findByOfferId(offerId)

    if (!batch) {
      throw new ResourceNotFoundError()
    }

    const offer = batch.completePickup(offerId, institutionId)

    await this.batchesRepository.save(batch)

    return { offer }
  }
}

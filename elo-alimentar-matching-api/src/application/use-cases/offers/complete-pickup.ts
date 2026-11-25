import type { DomainEventPublisher } from '@/core/events/domain-event-publisher'
import { ResourceNotFoundError } from '@/core/errors/resource-not-found-error'
import type { FoodBatchesRepository } from '@/domain/food-batch/food-batches-repository'
import type { Offer } from '@/domain/food-batch/offer'

interface CompletePickupUseCaseRequest {
  offerId: string
  institutionId: string
  now: Date
}

/**
 * A instituição que aceitou registra a retirada do lote. O evento gerado
 * (DonationCollected) soma o lote ao estoque da instituição.
 */
export class CompletePickupUseCase {
  constructor(
    private batchesRepository: FoodBatchesRepository,
    private events: DomainEventPublisher,
  ) {}

  async execute({
    offerId,
    institutionId,
    now,
  }: CompletePickupUseCaseRequest): Promise<{ offer: Offer }> {
    const batch = await this.batchesRepository.findByOfferId(offerId)

    if (!batch) {
      throw new ResourceNotFoundError()
    }

    const offer = batch.completePickup(offerId, institutionId, now)

    await this.batchesRepository.save(batch)
    await this.events.publish(batch.pullDomainEvents())

    return { offer }
  }
}
